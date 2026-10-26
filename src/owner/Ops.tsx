import { useEffect, useState } from 'react'
import { Armchair, BellRing, Check, ChefHat, CircleAlert, Clock, Gift, HandPlatter, LayoutGrid, MessageCircle, House, Navigation, Pause, PenLine, Play, Plus, Rows3, Search, Send, ShoppingBag, Timer, Users } from 'lucide-react'
import { Sheet, useT } from './Owner'
import { OfferButton, OfferSent, OfferSheet, useOfferText } from './Offer'
import type { Offer } from './Offer'
import type { Item } from './data'

// Day-to-day running of the café: incoming AroundMe orders, today's booked tables and messages from customers.
// Customers stay anonymous to the owner: an order code, a party size and a seat, never a name or photo.
type T2 = [string, string]
export type Status = 'scheduled' | 'new' | 'prep' | 'ready' | 'done'
export type Order = {
  code: string
  kind: 'seat' | 'pickup' | 'pre'
  placed: number // ms timestamp
  due?: number // pre-orders: when the customer arrives
  seat?: T2
  ppl: number
  lines: [string, number][]
  note?: string
  pay: 'apple' | 'google'
  status: Status
  started?: number
  readyAt?: number
  doneAt?: number
  refunded?: string[]
  late?: boolean
  // Where the customer is right now: in the café, on the way (with an arrival time), or not left yet.
  where?: 'here' | 'way' | 'home'
  eta?: number
  // Paid with a come-back offer: which one, and what it took off. This order is how the café knows the offer brought them back.
  offer?: { id: string; saved: number }
}
export type Booking = { code: string; at: number; table: string; ppl: number; tag: T2; state: 'upcoming' | 'arrived' | 'noshow' | 'left'; order?: string }
// A table as staff set it up: a name, where it is, how many seats, and how long a sitting lasts (0 = no limit).
export type Table = { id: string; name: T2; area: T2; seats: number; limit: number; bookable: boolean; seatedAt?: number; ppl?: number; booking?: string }
export type Msg = { from: 'them' | 'me'; text: string; at: number }
export type Thread = { code: string; msgs: Msg[]; unread: boolean }

// Unit prices for the sample orders, so totals work even if the owner's menu is still being set up.
const PRICE: Record<string, number> = {
  Latte: 18, 'Spanish latte': 21, 'Flat white': 19, Cortado: 16, V60: 22, 'Iced latte': 20, 'Iced Spanish latte': 23, 'Cold brew': 20,
  'San Sebastián cheesecake': 28, 'Lotus cheesecake': 26, 'Honey cake': 24, Brownie: 14, 'Butter croissant': 12, 'Zaatar croissant': 14,
  'Chocolate croissant': 15, Cookie: 9, 'Matcha latte': 24, 'Orange juice': 15, Water: 3, 'Halloumi sandwich': 26, 'Turkey and cheese sandwich': 29,
}
const PREP_TARGET = 10 // minutes
const AREAS: T2[] = [['عند النافذة', 'By the window'], ['داخل', 'Inside'], ['منطقة الهدوء', 'Quiet area'], ['الجلسات الخارجية', 'Outdoor seating']]
const SEATS: T2[] = [['عند النافذة', 'By the window'], ['الطاولة الطويلة', 'Long table'], ['منطقة الهدوء', 'Quiet area'], ['الجلسات الخارجية', 'Outdoor seating']]

const min = 60_000
// Order and booking codes are Latin; isolate them so «#A30» doesn't flip to «A30#» inside Arabic text.
const hash = (code: string) => `\u2066#${code}\u2069`
// A café can run several branches from one dashboard. Each branch has its own orders, tables, bookings,
// messages, offers and order intake; the menu is shared (see Owner.tsx), with sold-out kept per branch.
// `scale` sizes the sample weekly numbers on the Performance page for this branch.
export type Branch = { id: string; area: T2; hours: [number, number]; prefix: [string, string]; meetups: number[]; scale: number }
export type BranchData = {
  orders: Order[]; tables: Table[]; bookings: Booking[]; threads: Thread[]; offers: Record<string, Offer>
  autoOffer: boolean; paused: number | 'manual' | null; nextCode: number
}
export const BRANCHES: Branch[] = [
  { id: 'b1', area: ['العليا', 'Olaya'], hours: [6, 24], prefix: ['A', 'B'], meetups: [0, 1, 2, 3, 4, 5], scale: 1 },
  { id: 'b2', area: ['الملقا', 'Al Malqa'], hours: [6, 25], prefix: ['M', 'N'], meetups: [1, 2, 4], scale: 1.3 },
  { id: 'b3', area: ['الياسمين', 'Al Yasmin'], hours: [7, 23], prefix: ['Y', 'Z'], meetups: [0, 3], scale: 0.55 },
]
// Order and booking codes start with the branch's letters, so a code is never ambiguous across branches.
export const nextPrefix = (taken: Branch[]): [string, string] => {
  const used = new Set(taken.flatMap(b => b.prefix))
  const pairs: [string, string][] = [['A', 'B'], ['M', 'N'], ['Y', 'Z'], ['C', 'D'], ['E', 'F'], ['G', 'H'], ['J', 'K'], ['P', 'Q'], ['R', 'S'], ['T', 'U']]
  return pairs.find(([o, b]) => !used.has(o) && !used.has(b)) ?? ['X', 'W']
}
export const emptyBranch = (): BranchData => ({ orders: [], tables: [], bookings: [], threads: [], offers: {}, autoOffer: false, paused: null, nextCode: 1 })

// Sample shift for the main branch; the other sample branches are derived from it (busier, or quieter) with their own codes.
function seedMain(boot: number): BranchData {
  const ago = (m: number) => boot - m * min
  const d = (n: number) => boot - n * 86_400_000
  const o = (code: string, ppl: number): T2 => [`طلب ${hash(code)} · ${ppl === 1 ? 'شخص' : ppl === 2 ? 'شخصين' : `${ppl} أشخاص`}`, `Order ${hash(code)} · ${ppl} ${ppl === 1 ? 'person' : 'people'}`]
  const b = (code: string, tag: T2): T2 => [`حجز ${hash(code)} · ${tag[0]}`, `Booking ${hash(code)} · ${tag[1]}`]
  void d; void o; void b
  return {
    orders: [
    { code: 'A31', kind: 'seat', where: 'here', placed: ago(1), seat: SEATS[0], ppl: 2, lines: [['Spanish latte', 1], ['Iced latte', 1], ['San Sebastián cheesecake', 1]], pay: 'apple', status: 'new' },
    { code: 'A30', kind: 'pickup', where: 'way', eta: ago(-6), placed: ago(3), ppl: 1, lines: [['Flat white', 1], ['Butter croissant', 1]], note: 'حليب شوفان من فضلكم', pay: 'google', status: 'new' },
    { code: 'A28', kind: 'seat', where: 'here', placed: ago(7), started: ago(5), seat: SEATS[2], ppl: 1, lines: [['V60', 1], ['Cookie', 1]], pay: 'apple', status: 'prep', offer: { id: 'H9', saved: 22 } },
    { code: 'A27', kind: 'pre', where: 'way', eta: ago(-4), placed: ago(140), due: ago(-4), started: ago(12), ppl: 3, lines: [['Latte', 2], ['Cortado', 1]], pay: 'apple', status: 'prep' },
    { code: 'A26', kind: 'pickup', where: 'here', placed: ago(11), started: ago(9), readyAt: ago(2), ppl: 1, lines: [['Iced Spanish latte', 1]], pay: 'apple', status: 'ready' },
    { code: 'A25', kind: 'seat', placed: ago(24), started: ago(22), readyAt: ago(14), doneAt: ago(13), seat: SEATS[1], ppl: 4, lines: [['Spanish latte', 3], ['Honey cake', 2]], pay: 'google', status: 'done' },
    { code: 'A24', kind: 'pickup', placed: ago(38), started: ago(37), readyAt: ago(30), doneAt: ago(27), ppl: 1, lines: [['Cold brew', 1]], pay: 'apple', status: 'done' },
    { code: 'A23', kind: 'pre', placed: ago(300), due: ago(52), started: ago(60), readyAt: ago(53), doneAt: ago(50), ppl: 2, lines: [['Matcha latte', 1], ['Zaatar croissant', 2]], pay: 'apple', status: 'done' },
    { code: 'A33', kind: 'pre', where: 'home', placed: ago(90), due: ago(-35), ppl: 2, lines: [['Spanish latte', 2], ['Lotus cheesecake', 1]], note: 'سنجلس في الخارج', pay: 'apple', status: 'scheduled' },
    { code: 'A34', kind: 'pre', where: 'home', placed: ago(55), due: ago(-70), ppl: 1, lines: [['Cortado', 1], ['Chocolate croissant', 1]], pay: 'google', status: 'scheduled' },
],
    tables: [
    { id: 'w1', name: ['نافذة 1', 'Window 1'], area: AREAS[0], seats: 2, limit: 60, bookable: true, seatedAt: ago(48), ppl: 2 },
    { id: 'w2', name: ['نافذة 2', 'Window 2'], area: AREAS[0], seats: 2, limit: 60, bookable: true },
    { id: 'long', name: ['الطاولة الطويلة', 'Long table'], area: AREAS[1], seats: 8, limit: 90, bookable: true },
    { id: 'in1', name: ['داخل 1', 'Inside 1'], area: AREAS[1], seats: 4, limit: 60, bookable: false, seatedAt: ago(12), ppl: 3 },
    { id: 'q1', name: ['هادئة 1', 'Quiet 1'], area: AREAS[2], seats: 1, limit: 120, bookable: true, seatedAt: ago(20), ppl: 1, booking: 'B13' },
    { id: 'q2', name: ['هادئة 2', 'Quiet 2'], area: AREAS[2], seats: 2, limit: 120, bookable: true },
    { id: 'o1', name: ['خارجية 1', 'Outside 1'], area: AREAS[3], seats: 4, limit: 60, bookable: true, seatedAt: ago(65), ppl: 3 },
    { id: 'o2', name: ['خارجية 2', 'Outside 2'], area: AREAS[3], seats: 2, limit: 60, bookable: true },
],
    bookings: [
    { code: 'B12', at: ago(50), table: 'long', ppl: 4, tag: ['لقاء أصدقاء', 'Meeting friends'], state: 'left', order: 'A25' },
    { code: 'B13', at: ago(20), table: 'q1', ppl: 1, tag: ['مذاكرة', 'Studying'], state: 'arrived', order: 'A28' },
    { code: 'B14', at: ago(10), table: 'o2', ppl: 2, tag: ['عمل', 'Work'], state: 'upcoming' },
    { code: 'B15', at: ago(-4), table: 'long', ppl: 3, tag: ['اجتماع', 'Meeting'], state: 'upcoming', order: 'A27' },
    { code: 'B16', at: ago(-35), table: 'o1', ppl: 2, tag: ['استرخاء', 'Chilling'], state: 'upcoming', order: 'A33' },
    { code: 'B17', at: ago(-95), table: 'w2', ppl: 2, tag: ['عمل', 'Work'], state: 'upcoming' },
],
    threads: [
    { code: 'A30', unread: true, msgs: [{ from: 'them', text: 'السلام عليكم، هل يمكن تحضير الفلات وايت بحليب الشوفان؟', at: ago(2) }] },
    { code: 'B14', unread: true, msgs: [{ from: 'them', text: 'سأتأخر نحو عشر دقائق، أرجو ألا تُعطى طاولتي لأحد 🙏', at: ago(6) }] },
    { code: 'A27', unread: false, msgs: [{ from: 'them', text: 'سنصل بعد قليل، جهّزوه من فضلكم', at: ago(15) }, { from: 'me', text: 'أهلًا بكم، طلبكم قيد التحضير', at: ago(12) }] },
    { code: 'A25', unread: false, msgs: [{ from: 'them', text: 'شكرًا، كان التشيز كيك رائعًا', at: ago(10) }, { from: 'me', text: 'بالعافية، سعدنا بزيارتكم 🤍', at: ago(9) }] },
],
    offers: {
      A23: { kind: 'off', pct: 15, days: 14, note: '', sentAt: ago(40), src: 'order', about: o('A23', 2) },
      M0: { kind: 'drink', pct: 0, days: 14, note: '', sentAt: d(6), usedAt: d(2), spent: 58, saved: 42, order: 'A12', src: 'meet', pair: true, about: ['تطبيقها يتوقف عند صفحة الدفع', 'Her app froze on the payment page'] },
      H9: { kind: 'drink', pct: 0, days: 14, note: '', sentAt: d(2), usedAt: ago(7), spent: 9, saved: 22, order: 'A28', src: 'order', about: o('A19', 1) },
      H7: { kind: 'drink', pct: 0, days: 30, note: '', sentAt: d(3), src: 'booking', about: b('B09', ['عمل', 'Work']) },
      H6: { kind: 'sweet', pct: 0, days: 14, note: '', sentAt: d(5), usedAt: d(3), spent: 97, saved: 22, order: 'A07', src: 'order', about: o('A11', 3) },
      H3: { kind: 'sweet', pct: 0, days: 14, note: '', sentAt: d(8), src: 'order', about: o('A14', 1) },
      H5: { kind: 'off', pct: 25, days: 14, note: '', sentAt: d(9), usedAt: d(4), spent: 88, saved: 22, order: 'A05', src: 'meet', pair: true, about: ['مراجعة سيرة ذاتية', 'Reviewing a CV'] },
      H2: { kind: 'off', pct: 20, days: 14, note: '', sentAt: d(10), usedAt: d(6), spent: 146, saved: 29, order: 'A02', src: 'booking', about: b('B05', ['اجتماع', 'Meeting']) },
      H1: { kind: 'drink', pct: 0, days: 14, note: '', sentAt: d(12), usedAt: d(9), spent: 0, saved: 21, order: 'A01', src: 'order', about: o('A09', 2) },
      H4: { kind: 'drink', pct: 0, days: 7, note: '', sentAt: d(15), src: 'order', about: o('A03', 1) },
      H8: { kind: 'off', pct: 10, days: 7, note: '', sentAt: d(20), src: 'order', about: o('A06', 1) },
    },
    autoOffer: false, paused: null, nextCode: 35,
  }
}
const recode = (data: BranchData, [op, bp]: [string, string]): BranchData => {
  const c = (x: string) => x.replace(/^A(?=\d)/, op).replace(/^B(?=\d)/, bp)
  const txt = (t: T2): T2 => [t[0].replace(/#A(?=\d)/g, `#${op}`).replace(/#B(?=\d)/g, `#${bp}`), t[1].replace(/#A(?=\d)/g, `#${op}`).replace(/#B(?=\d)/g, `#${bp}`)]
  return {
    ...data,
    orders: data.orders.map(x => ({ ...x, code: c(x.code) })),
    tables: data.tables.map(x => ({ ...x, booking: x.booking && c(x.booking) })),
    bookings: data.bookings.map(x => ({ ...x, code: c(x.code), order: x.order && c(x.order) })),
    threads: data.threads.map(x => ({ ...x, code: c(x.code) })),
    offers: Object.fromEntries(Object.entries(data.offers).map(([k, v]) => [c(k), { ...v, order: v.order && c(v.order), about: v.about && txt(v.about) }])),
  }
}
export function seedBranches(boot: number): Record<string, BranchData> {
  const main = seedMain(boot)
  const ago = (m: number) => boot - m * min
  // Al Malqa: the busiest branch, with a table over its time and a message waiting.
  const malqa: BranchData = {
    ...main,
    orders: [
      ...main.orders,
      { code: 'A29', kind: 'pickup', where: 'here', placed: ago(9), ppl: 2, lines: [['Latte', 2], ['Brownie', 2]], pay: 'google', status: 'new' },
      { code: 'A22', kind: 'seat', placed: ago(70), started: ago(68), readyAt: ago(57), doneAt: ago(55), seat: SEATS[0], ppl: 3, lines: [['Iced latte', 3], ['San Sebastián cheesecake', 1]], pay: 'apple', status: 'done' },
    ],
    tables: main.tables.map(x => (x.id === 'w2' ? { ...x, seatedAt: ago(75), ppl: 2 } : x)),
    threads: [{ code: 'A29', unread: true, msgs: [{ from: 'them', text: 'هل يمكن أن يكون اللاتيه خاليًا من السكر؟', at: ago(12) }] }, ...main.threads],
    offers: Object.fromEntries(Object.entries(main.offers).filter(([k]) => ['H2', 'H5', 'H7', 'H4'].includes(k))),
  }
  // Al Yasmin: a smaller, quieter branch.
  const yasmin: BranchData = {
    ...main,
    orders: main.orders.filter(x => ['A30', 'A26', 'A24', 'A34'].includes(x.code)),
    tables: main.tables.filter(x => ['w1', 'w2', 'in1', 'q2', 'o2'].includes(x.id)).map(x => (x.id === 'w1' ? { ...x, seatedAt: ago(20) } : x)),
    bookings: main.bookings.filter(x => x.code === 'B17'),
    threads: main.threads.filter(x => x.code === 'A30').map(x => ({ ...x, unread: false })),
    offers: Object.fromEntries(Object.entries(main.offers).filter(([k]) => ['H1', 'H8'].includes(k))),
  }
  return { b1: main, b2: recode(malqa, BRANCHES[1].prefix), b3: recode(yasmin, BRANCHES[2].prefix) }
}

// «Busy café» demo: a full day at about 120 visits, so every section can be judged at real volume.
// Deterministic, so the same switch always shows the same day.
function seedBusy(boot: number, size: number, prefix: [string, string], base: BranchData): BranchData {
  let r = 7 + size * 13
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
  const pickOne = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
  const ago = (m: number) => boot - m * min
  const n = (x: number) => Math.max(1, Math.round(x * size))
  const DRINKS = ['Spanish latte', 'Latte', 'Flat white', 'Cortado', 'V60', 'Iced latte', 'Iced Spanish latte', 'Cold brew', 'Matcha latte']
  const FOOD = ['Butter croissant', 'San Sebastián cheesecake', 'Lotus cheesecake', 'Honey cake', 'Cookie', 'Zaatar croissant', 'Brownie', 'Halloumi sandwich']
  let code = 100
  const lines = (ppl: number): [string, number][] => {
    const d = pickOne(DRINKS), d2 = pickOne(DRINKS)
    const out: [string, number][] = d === d2 || ppl === 1 ? [[d, ppl]] : [[d, Math.ceil(ppl / 2)], [d2, Math.floor(ppl / 2)]]
    if (rnd() < 0.55) out.push([pickOne(FOOD), 1])
    return out
  }
  const order = (status: Status, o: Partial<Order>): Order => {
    const ppl = rnd() < 0.55 ? 1 : rnd() < 0.7 ? 2 : 3 + Math.floor(rnd() * 2)
    const kind: Order['kind'] = rnd() < 0.45 ? 'seat' : rnd() < 0.6 ? 'pickup' : 'pre'
    return { code: `${prefix[0]}${code++}`, kind, ppl, lines: lines(ppl), pay: rnd() < 0.7 ? 'apple' : 'google', status, seat: kind === 'seat' ? pickOne(SEATS) : undefined, where: kind === 'seat' ? 'here' : rnd() < 0.5 ? 'here' : 'way', placed: boot, ...o }
  }
  const orders: Order[] = []
  // Handed over earlier today, spread over the last ten hours.
  for (let i = 0; i < n(78); i++) { const t0 = 20 + Math.floor(rnd() * 580); orders.push(order('done', { placed: ago(t0 + 12), started: ago(t0 + 10), readyAt: ago(t0 + 2), doneAt: ago(t0), where: undefined })) }
  for (let i = 0; i < n(7); i++) { const t0 = 2 + Math.floor(rnd() * 16); orders.push(order('ready', { placed: ago(t0 + 12), started: ago(t0 + 10), readyAt: ago(t0) })) }
  for (let i = 0; i < n(11); i++) { const t0 = 1 + Math.floor(rnd() * (i < n(4) ? 25 : 9)); orders.push(order('prep', { placed: ago(t0 + 3), started: ago(t0) })) }
  for (let i = 0; i < n(9); i++) { const t0 = Math.floor(rnd() * (i < n(3) ? 12 : 4)); orders.push(order('new', { placed: ago(t0) })) }
  for (let i = 0; i < n(16); i++) { const due = 20 + Math.floor(rnd() * 200); orders.push(order('scheduled', { kind: 'pre', placed: ago(30 + Math.floor(rnd() * 300)), due: ago(-due), where: 'home', seat: undefined })) }
  // Pre-orders that are already moving get an arrival time.
  orders.forEach(o => { if (o.where === 'way' && o.status !== 'done') { o.eta = ago(-(2 + Math.floor(rnd() * 14))); if (o.kind === 'pre') o.due = o.eta } })
  const tables: Table[] = []
  const per: [number, number][] = [[4, 2], [6, 4], [4, 2], [6, 4]]
  const TNAME: T2[] = [['نافذة', 'Window'], ['داخل', 'Inside'], ['هادئة', 'Quiet'], ['خارجية', 'Outside']]
  AREAS.forEach((a, ai) => {
    for (let i = 0; i < Math.max(2, Math.round(per[ai][0] * Math.min(size, 1.3))); i++) {
      const seated = rnd() < 0.75, over = rnd() < 0.18
      tables.push({ id: `t${ai}${i}`, name: [`${TNAME[ai][0]} ${i + 1}`, `${TNAME[ai][1]} ${i + 1}`], area: a, seats: per[ai][1], limit: ai === 2 ? 120 : 60, bookable: true, ...(seated ? { seatedAt: ago(over ? 65 + Math.floor(rnd() * 40) : 5 + Math.floor(rnd() * 50)), ppl: 1 + Math.floor(rnd() * per[ai][1]) } : {}) })
    }
  })
  const TAGS: T2[] = [['عمل', 'Work'], ['مذاكرة', 'Studying'], ['اجتماع', 'Meeting'], ['لقاء أصدقاء', 'Meeting friends'], ['استرخاء', 'Chilling']]
  const bookings: Booking[] = []
  let bc = 40
  for (let i = 0; i < n(18); i++) {
    const m = 240 - i * 25 + Math.floor(rnd() * 10)
    const state: Booking['state'] = m > 90 ? 'left' : m > 0 ? (rnd() < 0.85 ? 'arrived' : 'noshow') : 'upcoming'
    bookings.push({ code: `${prefix[1]}${bc++}`, at: ago(m), table: pickOne(tables).id, ppl: 1 + Math.floor(rnd() * 4), tag: pickOne(TAGS), state })
  }
  const ASK = ['هل يمكن تحضيره بحليب الشوفان؟', 'سأتأخر عشر دقائق، احجزوا الطاولة من فضلكم', 'هل يوجد مكان قريب من الشاحن؟', 'أريد إضافة كرواسون للطلب', 'هل الطلب جاهز؟', 'هل يمكن أن يكون بدون سكر؟', 'نحن في الطريق', 'شكرًا، كان رائعًا 🤍']
  const active = orders.filter(o => o.status !== 'done' && o.status !== 'scheduled')
  const threads: Thread[] = Array.from({ length: n(22) }, (_, i) => {
    const o = i < active.length ? active[i] : orders[i]
    const unread = i < n(8)
    return { code: o.code, unread, msgs: unread ? [{ from: 'them' as const, text: pickOne(ASK), at: ago(1 + i * 3) }] : [{ from: 'them' as const, text: pickOne(ASK), at: ago(10 + i * 6) }, { from: 'me' as const, text: 'أهلًا بك، تم 👍', at: ago(8 + i * 6) }] }
  })
  return { ...base, orders, tables, bookings, threads, nextCode: code }
}
export function seedBusyBranches(boot: number, branches: Branch[]): Record<string, BranchData> {
  const calm = seedBranches(boot)
  return Object.fromEntries(branches.map(b => [b.id, seedBusy(boot, b.id === 'b2' ? 1.3 : b.id === 'b3' ? 0.6 : 1, b.prefix, calm[b.id] ?? emptyBranch())]))
}

// One branch's slice, with setters that only touch that branch. Every section takes this, whichever branch is open.
type SetAll = (f: (a: Record<string, BranchData>) => Record<string, BranchData>) => void
type Upd<T> = T | ((x: T) => T)
export function branchOps(branch: Branch, data: BranchData, setAll: SetAll, now: number) {
  const id = branch.id
  const up = <K extends keyof BranchData>(k: K) => (v: Upd<BranchData[K]>) =>
    setAll(a => (a[id] ? { ...a, [id]: { ...a[id], [k]: typeof v === 'function' ? (v as (x: BranchData[K]) => BranchData[K])(a[id][k]) : v } } : a))
  const setOrders = up('orders'), setOffers = up('offers')
  // Prototype: a little after an offer goes out, the customer comes back with it, which shows up as a new paid
  // order carrying the offer. Paying with it in the app is the only thing that marks an offer as used.
  const sendOffer = (key: string, offer: Offer, onBack: (code: string) => void) => {
    setOffers(x => ({ ...x, [key]: offer }))
    const code = `${branch.prefix[0]}${data.nextCode}`
    up('nextCode')(n => n + 1)
    setTimeout(() => {
      const ppl = offer.pair ? 2 : 1
      // A single free drink is usually just claimed on its own, at no charge; the rest come with a paid order.
      const lines: [string, number][] = offer.kind === 'drink' && !offer.pair ? [['Spanish latte', 1]] : offer.kind === 'drink' ? [['Spanish latte', ppl], ['Butter croissant', 1]] : offer.kind === 'sweet' ? [['Flat white', ppl], ['San Sebastián cheesecake', ppl]] : [['Latte', ppl + 1], ['Honey cake', 1]]
      const full = lines.reduce((s, [en, q]) => s + (PRICE[en] ?? 15) * q, 0)
      const saved = offer.kind === 'drink' ? PRICE['Spanish latte'] * ppl : offer.kind === 'sweet' ? PRICE['San Sebastián cheesecake'] * ppl : Math.round((full * offer.pct) / 100)
      setOrders(l => [{ code, kind: 'pre', where: 'way', eta: Date.now() + 12 * min, placed: Date.now(), due: Date.now() + 12 * min, ppl, lines, pay: 'apple', status: 'new', offer: { id: key, saved } }, ...l])
      setOffers(x => ({ ...x, [key]: { ...x[key], usedAt: Date.now(), spent: full - saved, saved, order: code } }))
      onBack(code)
    }, 15_000)
  }
  return {
    branch, ...data, now,
    setOrders, setTables: up('tables'), setBookings: up('bookings'), setThreads: up('threads'), setOffers,
    setAutoOffer: up('autoOffer'), setPaused: up('paused'), sendOffer,
    newCode: () => { const c = `${branch.prefix[0]}${data.nextCode}`; up('nextCode')(n => n + 1); return c },
  }
}
export type Ops = ReturnType<typeof branchOps>

export function useBranches() {
  const [boot] = useState(() => Date.now())
  const [branches, setBranches] = useState<Branch[]>(BRANCHES)
  const [all, setAll] = useState<Record<string, BranchData>>(() => seedBranches(boot))
  // «Busy café» demo switch: reloads every branch with a full day at about 120 visits, and sizes the sample numbers to match.
  const [busy, setBusyState] = useState(false)
  const setBusy = (on: boolean) => {
    if (on === busy) return
    setBusyState(on)
    setAll(on ? seedBusyBranches(Date.now(), branches) : seedBranches(boot))
    setBranches(bs => bs.map(b => ({ ...b, scale: +(b.scale * (on ? 4 : 0.25)).toFixed(2) })))
  }
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(id) }, [])
  // A timed pause ends on its own, in whichever branch it was set.
  useEffect(() => {
    if (Object.values(all).some(d => typeof d.paused === 'number' && now >= d.paused))
      setAll(a => Object.fromEntries(Object.entries(a).map(([k, d]) => [k, typeof d.paused === 'number' && now >= d.paused ? { ...d, paused: null } : d])))
  }, [now, all])
  const ops = (id: string) => { const b = branches.find(x => x.id === id)!; return branchOps(b, all[id] ?? emptyBranch(), setAll, now) }
  return { branches, setBranches, all, setAll, ops, now, busy, setBusy }
}
export type Branches = ReturnType<typeof useBranches>

// The same numbers wherever they appear: the branch's own sections and the all-branches overview.
export function opsStats(o: Ops) {
  const done = o.orders.filter(x => x.status === 'done')
  return {
    newOrders: o.orders.filter(x => x.status === 'new').length,
    inPrep: o.orders.filter(x => x.status === 'prep').length,
    ready: o.orders.filter(x => x.status === 'ready').length,
    ordersToday: o.orders.filter(x => x.status !== 'scheduled').length,
    sales: done.reduce((s, x) => s + total(x), 0),
    avgPrep: done.length ? Math.round(done.reduce((s, x) => s + ((x.readyAt ?? 0) - (x.started ?? 0)), 0) / done.length / min) : 0,
    unread: o.threads.filter(x => x.unread).length,
    seated: o.tables.filter(x => x.seatedAt).length,
    tables: o.tables.length,
    overTime: o.tables.filter(x => x.seatedAt && x.limit && o.now - x.seatedAt > x.limit * min).length,
    lateBookings: o.bookings.filter(b => b.state === 'upcoming' && o.now > b.at).length,
    waitingLong: o.orders.filter(x => x.status === 'new' && o.now - x.placed > 5 * min).length,
    returned: Object.values(o.offers).filter(x => x.usedAt && o.now - x.usedAt < 86_400_000).length,
  }
}
// What the badge on a branch counts, everywhere it appears: new orders, unread messages, and tables that need action.
export const attention = (s: ReturnType<typeof opsStats>) => s.newOrders + s.unread + s.lateBookings + s.overTime

function useFmt() {
  const { t, lang, tx, sar } = useT()
  // Shown when a customer comes back and pays with an offer the café sent.
  const backNote = (code: string) => t(`عاد عميل بعرضك 🎁 طلب جديد ${hash(code)}`, `A customer came back with your offer 🎁 New order ${hash(code)}`)
  const clock = (ms: number) => {
    const d = new Date(ms); const h = d.getHours(), m = d.getMinutes()
    return lang === 'ar' ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
  }
  const mins = (ms: number) => Math.max(0, Math.round(ms / min))
  const dur = (m: number) => t(m < 1 ? 'الآن' : `${m} د`, m < 1 ? 'now' : `${m} min`)
  const pick = (x: T2) => (lang === 'ar' ? x[0] : x[1])
  const people = (p: number) => t(p === 1 ? 'شخص' : p === 2 ? 'شخصين' : `${p} أشخاص`, `${p} ${p === 1 ? 'person' : 'people'}`)
  return { t, lang, tx, sar, clock, mins, dur, pick, people, backNote }
}

export const total = (o: Order) => o.lines.filter(([en]) => !o.refunded?.includes(en)).reduce((s, [en, q]) => s + (PRICE[en] ?? 15) * q, 0) - (o.offer?.saved ?? 0)

/* ---------- Orders ---------- */
export function Orders({ ops, items, notify, openThread, startTab = 'new' }: { ops: Ops; items: Item[]; notify: (s: string) => void; openThread: (code: string) => void; startTab?: Status }) {
  const { t, tx, sar, clock, mins, dur, pick, people, backNote: back } = useFmt()
  const backNote = (code: string) => notify(back(code))
  const { offerText } = useOfferText()
  const { orders, setOrders, now, paused, setPaused } = ops
  const [tab, setTab] = useState<Status>(startTab)
  const [issue, setIssue] = useState<Order | null>(null)
  const [offerFor, setOfferFor] = useState<Order | null>(null)
  const [pauseOpen, setPauseOpen] = useState(false)
  // Busy cafés: search by code, compact rows (tap one to open it), and a cap on the handed-over list.
  const [q, setQ] = useState('')
  const [view, setView] = useState<'auto' | 'compact' | 'full'>('auto')
  const [opened, setOpened] = useState<string[]>([])
  const [doneShown, setDoneShown] = useState(20)
  const name = (en: string) => { const it = items.find(i => i.name.en === en); return it ? tx(it.name) : en }
  const count = (s: Status) => orders.filter(o => o.status === s).length
  const set = (code: string, patch: Partial<Order>) => setOrders(l => l.map(o => (o.code === code ? { ...o, ...patch } : o)))


  const advance = (o: Order) => {
    if (o.status === 'scheduled' || o.status === 'new') { set(o.code, { status: 'prep', started: Date.now() }); notify(t(`بدأ تحضير ${hash(o.code)}، ووصل العميل إشعار`, `Started ${hash(o.code)}. The customer was notified`)) }
    else if (o.status === 'prep') { set(o.code, { status: 'ready', readyAt: Date.now() }); notify(t(`${hash(o.code)} جاهز، وأرسلنا للعميل «طلبك جاهز»`, `${hash(o.code)} is ready. We told the customer`)) }
    else if (o.status === 'ready') { set(o.code, { status: 'done', doneAt: Date.now() }); notify(t(`تم تسليم الطلب ${hash(o.code)}`, `Order ${hash(o.code)} handed over`)) }
  }
  const action = (o: Order) =>
    o.status === 'scheduled' ? [t('ابدأ التحضير مبكرًا', 'Start early'), <ChefHat key="i" />] as const
    : o.status === 'new' ? [t('اقبل وابدأ التحضير', 'Accept and start'), <ChefHat key="i" />] as const
    : o.status === 'prep' ? [t('جاهز', 'Mark ready'), <BellRing key="i" />] as const
    : [o.kind === 'seat' ? t('تم التسليم للطاولة', 'Served to the table') : t('تم تسليم الطلب', 'Handed over'), <HandPlatter key="i" />] as const

  // Orders that need a nudge float to the top of their tab: prep over target, new waiting over 5 min, ready over 10 min.
  const lateOf = (o: Order) => o.status === 'prep' ? !!o.started && now - o.started > PREP_TARGET * min : o.status === 'new' ? now - o.placed > 5 * min : o.status === 'ready' ? !!o.readyAt && now - o.readyAt > 10 * min : false
  const lateCount = (st: Status) => orders.filter(o => o.status === st && lateOf(o)).length
  const query = q.trim().toUpperCase().replace('#', '')
  const all = orders.filter(o => (query ? o.code.toUpperCase().includes(query) : o.status === tab)).sort((a, b) => (+lateOf(b) - +lateOf(a)) || (tab === 'done' ? (b.doneAt ?? 0) - (a.doneAt ?? 0) : tab === 'scheduled' ? (a.due ?? 0) - (b.due ?? 0) : a.placed - b.placed))
  const shown = !query && tab === 'done' ? all.slice(0, doneShown) : all
  const compact = view === 'compact' || (view === 'auto' && all.length > 6)
  // What the bar has to make right now, summed across orders, so the barista can batch the same drink.
  const toMake = Object.entries(orders.filter(o => o.status === (tab === 'new' ? 'new' : 'prep')).flatMap(o => o.lines.filter(([en]) => !o.refunded?.includes(en))).reduce<Record<string, number>>((m, [en, n]) => ({ ...m, [en]: (m[en] ?? 0) + n }), {})).sort((a, b) => b[1] - a[1])
  const nOrders = (n: number) => (n === 1 ? 'طلب واحد' : n === 2 ? 'طلبين' : n <= 10 ? `${n} طلبات` : `${n} طلبًا`)
  const acceptAll = () => {
    const xs = orders.filter(o => o.status === 'new')
    setOrders(l => l.map(o => (o.status === 'new' ? { ...o, status: 'prep', started: Date.now() } : o)))
    notify(t(`بدأ تحضير ${nOrders(xs.length)}، ووصل كل عميل إشعار`, `Started ${xs.length} orders. Each customer was notified`))
  }
  const stats = opsStats(ops)
  const TABS: [Status, string][] = [['new', t('جديد', 'New')], ['prep', t('تحضير', 'Preparing')], ['ready', t('جاهز', 'Ready')], ['scheduled', t('مجدولة', 'Scheduled')], ['done', t('تم التسليم', 'Handed over')]]

  return (
    <div className="o-ops">
      <div className={`o-intake ${paused ? 'off' : ''}`}>
        {paused ? <Pause /> : <span className="o-pulse" />}
        <div>
          <b>{paused ? t('الطلبات متوقفة', 'Orders are paused') : t('تستقبل الطلبات الآن', 'Taking orders')}</b>
          <small>{paused ? (paused === 'manual' ? t('حتى تعيد تشغيلها', 'Until you turn them back on') : t(`تعود ${clock(paused)}`, `Back at ${clock(paused)}`)) : t(`وقت التحضير المتوقع ~${PREP_TARGET} د`, `Expected prep time ~${PREP_TARGET} min`)}</small>
        </div>
        <button type="button" onClick={() => (paused ? (setPaused(null), notify(t('عدت لاستقبال الطلبات', 'Taking orders again'))) : setPauseOpen(true))}>{paused ? <><Play />{t('أعد التشغيل', 'Resume')}</> : <><Pause />{t('إيقاف مؤقت', 'Pause')}</>}</button>
      </div>

      <div className="o-ops-stats">
        <div><b>{stats.ordersToday}</b><small>{t('طلب اليوم', 'orders today')}</small></div>
        <div><b>{t(`${stats.avgPrep} د`, `${stats.avgPrep} min`)}</b><small>{t('متوسط التحضير', 'avg prep')}</small></div>
        <div><b>{sar(stats.sales)}</b><small>{t('مبيعات اليوم', 'sales today')}</small></div>
      </div>

      <div className="o-status-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${tab === id ? 'active' : ''} s-${id}`} onClick={() => setTab(id)}>
            {label}<span>{count(id)}</span>{id !== 'done' && id !== 'scheduled' && lateCount(id) > 0 && <em title={t('متأخرة', 'Late')}>{lateCount(id)}</em>}
          </button>
        ))}
      </div>

      <div className="o-orders-tools">
        <label className="o-search"><Search /><input value={q} onChange={e => setQ(e.target.value)} placeholder={t('ابحث برقم الطلب، مثل A105', 'Search by order number, e.g. A105')} /></label>
        <div className="o-seg-mini" role="group" aria-label={t('طريقة العرض', 'View')}>
          <button type="button" className={compact ? 'active' : ''} onClick={() => setView('compact')}><Rows3 />{t('مختصر', 'Compact')}</button>
          <button type="button" className={!compact ? 'active' : ''} onClick={() => setView('full')}><LayoutGrid />{t('مفصّل', 'Detailed')}</button>
        </div>
      </div>

      {!query && (tab === 'new' || tab === 'prep') && toMake.length > 0 && (
        <div className="o-tomake">
          <div className="o-tomake-head">
            <b>{tab === 'new' ? t(count('new') === 1 ? 'طلب واحد ينتظر القبول' : count('new') === 2 ? 'طلبان ينتظران القبول' : `${nOrders(count('new'))} تنتظر القبول`, `${count('new')} order${count('new') === 1 ? '' : 's'} waiting`) : t('حضّر الآن', 'Make now')}</b>
            {tab === 'new' && <button type="button" className="o-advance" onClick={acceptAll}><ChefHat />{t('اقبل الكل وابدأ التحضير', 'Accept all and start')}</button>}
          </div>
          <div className="o-tomake-items">{toMake.slice(0, 8).map(([en, n]) => <span key={en}><b>{`\u2066${n}×\u2069`}</b>{name(en)}</span>)}</div>
        </div>
      )}
      {query && <p className="o-card-sub">{t(`نتائج «${q.trim()}» في كل الحالات · ${all.length}`, `Results for “${q.trim()}” in every status · ${all.length}`)}</p>}

      {shown.length === 0 && (
        <div className="o-empty"><Check /><b>{query ? t('لا يوجد طلب بهذا الرقم', 'No order with that number') : tab === 'new' ? t('لا توجد طلبات جديدة', 'No new orders') : tab === 'prep' ? t('لا شيء قيد التحضير', 'Nothing being prepared') : tab === 'ready' ? t('سُلّمت كل الطلبات الجاهزة', 'Everything ready was handed over') : t('لا شيء هنا', 'Nothing here')}</b><small>{t('يظهر هنا كل طلب جديد ويصلك تنبيه به.', "New orders show up here and you'll get an alert.")}</small></div>
      )}

      <ul className={`o-orders ${compact ? 'compact' : ''}`}>
        {shown.map(o => {
          const late = lateOf(o)
          if (compact && !opened.includes(o.code)) {
            const [lbl, ic] = action(o)
            const when = o.status === 'done' ? clock(o.doneAt!) : o.status === 'scheduled' ? clock(o.due!) : o.status === 'ready' ? dur(mins(now - o.readyAt!)) : o.status === 'prep' ? dur(mins(now - (o.started ?? now))) : dur(mins(now - o.placed))
            return (
              <li key={o.code} className={`o-orow s-${o.status} ${late ? 'late' : ''}`}>
                <button type="button" className="o-orow-main" onClick={() => setOpened(x => [...x, o.code])} aria-expanded={false}>
                  <span className="o-code">{hash(o.code)}</span>
                  <span className={`o-orow-kind k-${o.kind}`}>{o.kind === 'seat' ? <Armchair /> : o.kind === 'pickup' ? <ShoppingBag /> : <Clock />}</span>
                  <span className="o-orow-lines">{o.lines.map(([en, n]) => `${n > 1 ? `\u2066${n}×\u2069 ` : ''}${name(en)}`).join(t('، ', ', '))}</span>
                  <span className={`o-orow-time ${late ? 'late' : ''}`}>{late && <CircleAlert />}{when}</span>
                </button>
                {o.status !== 'done' && <button type="button" className="o-orow-act" onClick={() => advance(o)} aria-label={lbl}>{ic}<span>{o.status === 'new' ? t('اقبل', 'Accept') : o.status === 'prep' ? t('جاهز', 'Ready') : o.status === 'ready' ? t('سُلّم', 'Handed') : t('ابدأ', 'Start')}</span></button>}
              </li>
            )
          }
          const waited = mins(now - o.placed)
          const inPrep = o.started ? mins(now - o.started) : 0
          const slow = o.status === 'prep' && inPrep > PREP_TARGET
          const [label, icon] = action(o)
          return (
            <li key={o.code} className={`o-order s-${o.status} ${slow ? 'slow' : ''}`}>
              {compact && <button type="button" className="o-order-fold" onClick={() => setOpened(x => x.filter(c => c !== o.code))}>{t('اطوِ', 'Collapse')}</button>}
              <div className="o-order-top">
                <span className="o-code">{hash(o.code)}</span>
                <span className={`o-kind-tag k-${o.kind}`}>
                  {o.kind === 'seat' ? <><Armchair />{t('من طاولته', 'At a table')}</> : o.kind === 'pickup' ? <><ShoppingBag />{t('استلام', 'Pickup')}</> : <><Clock />{t('طلب مسبق', 'Pre-order')}</>}
                </span>
                <span className="o-order-time">
                  {o.status === 'done' ? t(`سُلّم ${clock(o.doneAt!)}`, `Handed over ${clock(o.doneAt!)}`)
                    : o.status === 'scheduled' ? t(`يصل ${clock(o.due!)}`, `Arrives ${clock(o.due!)}`)
                    : o.status === 'ready' ? t(`جاهز من ${dur(mins(now - o.readyAt!))}`, `Ready for ${dur(mins(now - o.readyAt!))}`)
                    : o.status === 'prep' ? <><Timer />{dur(inPrep)}</>
                    : t(`قبل ${dur(waited)}`, `${dur(waited)} ago`)}
                </span>
              </div>
              {(() => {
                const at = o.status === 'done' ? 'gone' : o.where === 'way' && o.eta && now >= o.eta ? 'here' : o.where ?? 'here'
                const label = at === 'gone' ? t('استلم طلبه', 'Picked up')
                  : at === 'here' ? (o.status === 'ready' && o.kind !== 'seat' ? t('في الكافيه الآن · ينتظر عند الكاونتر', 'In the café · waiting at the counter') : t('في الكافيه الآن', 'In the café now'))
                  : at === 'way' ? (o.eta! - now < min ? t('يصل الآن', 'Arriving now') : t(`في الطريق · يصل خلال ${dur(mins(o.eta! - now))}`, `On the way · arrives in ${dur(mins(o.eta! - now))}`))
                  : t(`لم يتحرك بعد · موعده ${clock(o.due ?? now)}`, `Not on the way yet · due ${clock(o.due ?? now)}`)
                return <span className={`o-presence p-${at}`}>{at === 'here' ? <i /> : at === 'way' ? <Navigation /> : at === 'home' ? <House /> : <Check />}{label}</span>
              })()}
              <p className="o-order-who"><Users />{people(o.ppl)}{o.seat && <> · {pick(o.seat)}</>}{o.kind === 'pre' && o.due && o.status !== 'scheduled' && o.status !== 'done' && <> · {t(`يصل ${clock(o.due)}`, `arrives ${clock(o.due)}`)}</>}</p>
              <ul className="o-lines">
                {o.lines.map(([en, q]) => <li key={en} className={o.refunded?.includes(en) ? 'gone' : ''}><b>{q}×</b>{name(en)}{o.refunded?.includes(en) && <small>{t('نفد · أُعيد مبلغه', 'Out · refunded')}</small>}</li>)}
              </ul>
              {o.note && <p className="o-order-note">«{o.note}»</p>}
              {o.late && o.status !== 'done' && <p className="o-order-flag"><Clock />{t('أبلغنا العميل بأن الطلب سيتأخر 10 دقائق', 'We told the customer it will be 10 minutes late')}</p>}
              {slow && <p className="o-order-flag"><CircleAlert />{t(`تجاوز ${PREP_TARGET} دقائق`, `Over ${PREP_TARGET} minutes`)}</p>}
              {o.offer && <p className="o-order-offer"><Gift />{t(`${total(o) === 0 ? 'استلم هديته' : 'طلب بعرضك'}: ${offerText(ops.offers[o.offer.id] ?? { kind: 'drink', pct: 0, days: 0, note: '' }, ops.offers[o.offer.id]?.pair)}`, `${total(o) === 0 ? 'Claimed' : 'Ordered with your offer'}: ${offerText(ops.offers[o.offer.id] ?? { kind: 'drink', pct: 0, days: 0, note: '' }, ops.offers[o.offer.id]?.pair)}`)}<b>{`− ${sar(o.offer.saved)}`}</b></p>}
              {o.offer && total(o) === 0 ? <p className="o-paid"><Gift />{t('مجاني بالكامل بعرضك، لا شيء للدفع', 'Free with your offer, nothing to pay')}</p> : <p className="o-paid"><Check />{t('مدفوع', 'Paid')} {sar(total(o))} · {o.pay === 'apple' ? 'Apple Pay' : 'Google Pay'}</p>}
              {o.status === 'done' && (ops.offers[o.code] ? <OfferSent offer={ops.offers[o.code]} /> : <OfferButton onClick={() => setOfferFor(o)} />)}
              <div className="o-order-actions">
                {o.status !== 'done' && <button type="button" className="o-advance" onClick={() => advance(o)}>{icon}{label}</button>}
                {o.status !== 'ready' && o.status !== 'done' && <button type="button" className="o-issue" onClick={() => setIssue(o)}>{t('مشكلة؟', 'Problem?')}</button>}
                <button type="button" className="o-icon-btn o-chat-btn" onClick={() => openThread(o.code)} aria-label={t('راسل العميل', 'Message the customer')}><MessageCircle />{o.status === 'done' && t('راسل العميل', 'Message')}</button>
              </div>
            </li>
          )
        })}
      </ul>

      {!query && tab === 'done' && all.length > doneShown && <button type="button" className="o-text-btn o-show-more" onClick={() => setDoneShown(n => n + 20)}>{t(`اعرض 20 أخرى · بقي ${all.length - doneShown}`, `Show 20 more · ${all.length - doneShown} left`)}</button>}

      {issue && (
        <Sheet title={t(`مشكلة في ${hash(issue.code)}`, `Problem with ${hash(issue.code)}`)} onClose={() => setIssue(null)}>
          <p className="o-sheet-sub">{t('اختر ما حدث، وسنبلغ العميل فورًا.', "Pick what happened and we'll tell the customer right away.")}</p>
          <h4 className="o-sheet-h">{t('نفد صنف', 'An item ran out')}</h4>
          <div className="o-issue-list">
            {issue.lines.filter(([en]) => !issue.refunded?.includes(en)).map(([en, q]) => (
              <button key={en} type="button" onClick={() => {
                set(issue.code, { refunded: [...(issue.refunded ?? []), en] })
                notify(t(`أعدنا مبلغ «${name(en)}» (${sar((PRICE[en] ?? 15) * q)}) إلى العميل وأبلغناه`, `Refunded “${name(en)}” (${sar((PRICE[en] ?? 15) * q)}) and told the customer`))
                setIssue(null)
              }}><b>{q}× {name(en)}</b><small>{t(`إعادة ${sar((PRICE[en] ?? 15) * q)}`, `Refund ${sar((PRICE[en] ?? 15) * q)}`)}</small></button>
            ))}
          </div>
          <h4 className="o-sheet-h">{t('تأخير', 'Running late')}</h4>
          <div className="o-issue-list">
            <button type="button" onClick={() => { set(issue.code, { late: true }); notify(t('أبلغنا العميل بأن طلبه سيتأخر 10 دقائق', 'We told the customer it will be 10 minutes late')); setIssue(null) }}>
              <b>{t('سيتأخر 10 دقائق', '10 more minutes')}</b><small>{t('نرسل للعميل تنبيهًا بالوقت الجديد', 'We send the customer the new time')}</small>
            </button>
          </div>
          <p className="o-note"><CircleAlert />{t('إذا نفد صنف، نعيد مبلغه إلى العميل تلقائيًا، ويكتمل باقي الطلب كالمعتاد.', 'If an item runs out, we refund it to the customer automatically. The rest of the order goes ahead.')}</p>
        </Sheet>
      )}

      {offerFor && (
        <OfferSheet onClose={() => setOfferFor(null)} onSend={offer => { ops.sendOffer(offerFor.code, { ...offer, sentAt: Date.now(), src: 'order', about: [`طلب ${hash(offerFor.code)} · ${people(offerFor.ppl)}`, `Order ${hash(offerFor.code)} · ${offerFor.ppl} ${offerFor.ppl === 1 ? 'person' : 'people'}`] }, backNote); setOfferFor(null); notify(t('أرسلنا العرض، وسيصله إشعار «افتح هديتك»', 'Offer sent. They get an “Open your gift” notification')) }}
          about={<p className="o-offer-for"><ShoppingBag /><span><b>{t(`طلب ${hash(offerFor.code)} · ${people(offerFor.ppl)}`, `Order ${hash(offerFor.code)} · ${people(offerFor.ppl)}`)}</b><small>{offerFor.lines.map(([en, q]) => `${q}× ${name(en)}`).join(t('، ', ', '))}</small></span></p>} />
      )}

      {pauseOpen && (
        <Sheet title={t('أوقف الطلبات مؤقتًا', 'Pause orders')} onClose={() => setPauseOpen(false)}>
          <p className="o-sheet-sub">{t('ازدحام؟ أوقف الطلبات الجديدة قليلًا. تكتمل الطلبات السابقة كالمعتاد، ولا تتأثر الحجوزات.', 'Busy? Stop new orders for a bit. Orders already in keep going, and bookings are not affected.')}</p>
          <div className="o-issue-list">
            {([[15, t('15 دقيقة', '15 minutes')], [30, t('نصف ساعة', '30 minutes')], [60, t('ساعة', '1 hour')]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => { setPaused(Date.now() + m * min); setPauseOpen(false); notify(t(`أوقفنا الطلبات ${label}`, `Orders paused for ${label}`)) }}><b>{label}</b><small>{t(`تعود ${clock(Date.now() + m * min)}`, `Back at ${clock(Date.now() + m * min)}`)}</small></button>
            ))}
            <button type="button" onClick={() => { setPaused('manual'); setPauseOpen(false); notify(t('أوقفنا الطلبات حتى تعيد تشغيلها', 'Orders paused until you resume')) }}><b>{t('حتى أعيد تشغيلها', 'Until I turn them back on')}</b><small>{t('لا تعود إلا بتشغيلك', 'Only you can resume')}</small></button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/* ---------- Tables: the floor and today's bookings ---------- */
const LIMITS = [30, 45, 60, 90, 120, 0]
export function Tables({ ops, notify, openThread }: { ops: Ops; notify: (s: string) => void; openThread: (code: string) => void }) {
  const { t, clock, mins, pick, people, backNote: back } = useFmt()
  const backNote = (code: string) => notify(back(code))
  const { tables, setTables, bookings, setBookings, now } = ops
  const [tab, setTab] = useState<'floor' | 'bookings'>('floor')
  const [open, setOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<Table | 'new' | null>(null)
  const [ppl, setPpl] = useState(2)
  const [offerBooking, setOfferBooking] = useState<Booking | null>(null)
  const HOLD = 60
  const nTables = (n: number) => t(n === 1 ? 'طاولة' : n === 2 ? 'طاولتين' : n <= 10 ? `${n} طاولات` : `${n} طاولة`, `${n} table${n === 1 ? '' : 's'}`)
  const table = (id: string) => tables.find(x => x.id === id)
  const tName = (id: string) => { const x = table(id); return x ? `${pick(x.name)} · ${pick(x.area)}` : '' }
  const patch = (id: string, p: Partial<Table>) => setTables(l => l.map(x => (x.id === id ? { ...x, ...p } : x)))
  const seat = (id: string, n: number, booking?: string) => patch(id, { seatedAt: Date.now(), ppl: n, booking })
  const free = (id: string) => {
    const x = table(id); patch(id, { seatedAt: undefined, ppl: undefined, booking: undefined })
    if (x?.booking) setBookings(l => l.map(b => (b.code === x.booking ? { ...b, state: 'left' } : b)))
  }
  const setB = (code: string, state: Booking['state']) => setBookings(l => l.map(b => (b.code === code ? { ...b, state } : b)))
  const nextBooking = (id: string) => bookings.filter(b => b.table === id && b.state === 'upcoming').sort((a, b) => a.at - b.at)[0]
  const status = (x: Table) => {
    if (x.seatedAt) {
      const sat = mins(now - x.seatedAt)
      if (x.limit && sat > x.limit) return { k: 'over', sat, left: 0 }
      return { k: 'seated', sat, left: x.limit ? x.limit - sat : 0 }
    }
    const nb = nextBooking(x.id)
    if (nb && nb.at - now < 30 * min) return { k: 'soon', sat: 0, left: 0, nb }
    return { k: 'free', sat: 0, left: 0, nb }
  }
  const areas = tables.reduce<T2[]>((acc, x) => (acc.some(a => a[1] === x.area[1]) ? acc : [...acc, x.area]), [])
  const sel = open ? table(open) : undefined
  const counts = { free: tables.filter(x => !x.seatedAt).length, seated: tables.filter(x => x.seatedAt).length, over: tables.filter(x => status(x).k === 'over').length }

  return (
    <div className="o-ops">
      <div className="o-segmented o-tm-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'floor'} className={tab === 'floor' ? 'active' : ''} onClick={() => setTab('floor')}>{t('الطاولات', 'Tables')}<span className="o-count">{tables.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'bookings'} className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>{t('حجوزات اليوم', "Today's bookings")}<span className="o-count">{bookings.length}</span></button>
      </div>

      {tab === 'floor' && (
        <>
          <div className="o-floor-head">
            <span><b>{nTables(tables.length)}</b><small>{t(`في ${areas.length === 1 ? 'موقع واحد' : areas.length === 2 ? 'موقعين' : `${areas.length} مواقع`}`, `in ${areas.length} location${areas.length === 1 ? '' : 's'}`)}</small></span>
            <button type="button" className="o-offer-new-btn" onClick={() => setEditing('new')}><Plus />{t('أضف طاولة', 'Add a table')}</button>
          </div>
          <div className="o-ops-stats">
            <div><b>{counts.free}</b><small>{t('شاغرة', 'free')}</small></div>
            <div><b>{counts.seated}</b><small>{t('مشغولة', 'seated')}</small></div>
            <div className={counts.over ? 'warn' : ''}><b>{counts.over}</b><small>{t('انتهى وقتها', 'over time')}</small></div>
          </div>
          {areas.map(area => (
            <section key={area[1]} className="o-tm-group">
              <h4>{pick(area)}<small>{nTables(tables.filter(x => x.area[1] === area[1]).length)}</small></h4>
              <div className="o-floor">
                {tables.filter(x => x.area[1] === area[1]).map(x => {
                  const st = status(x)
                  return (
                    <button key={x.id} type="button" className={`o-tbl s-${st.k}`} onClick={() => { setOpen(x.id); setPpl(Math.min(2, x.seats)) }}>
                      <span className="o-tbl-top"><b>{pick(x.name)}</b><small><Users />{x.seats}</small></span>
                      <span className="o-tbl-state">
                        {st.k === 'free' ? t('شاغرة', 'Free') : st.k === 'soon' ? t(`محجوزة ${clock(st.nb!.at)}`, `Booked ${clock(st.nb!.at)}`) : st.k === 'over' ? t(`تجاوزت الوقت ${st.sat - x.limit} د`, `${st.sat - x.limit} min over`) : x.limit ? t(`باقي ${st.left} د`, `${st.left} min left`) : t(`من ${st.sat} د`, `${st.sat} min`)}
                      </span>
                      {x.seatedAt && <span className="o-tbl-bar"><i style={{ width: `${x.limit ? Math.min(100, (st.sat / x.limit) * 100) : 100}%` }} /></span>}
                      <span className="o-tbl-meta"><Timer />{x.limit ? t(`${x.limit} د`, `${x.limit} min`) : t('بدون وقت', 'No limit')}{x.seatedAt && <> · {people(x.ppl!)}</>}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
          <p className="o-note"><Timer />{t('لكل طاولة وقت جلسة. يبدأ العدّاد عند إجلاس العملاء، وننبهك عند انتهاء وقتهم.', "Each table has a sitting time. The timer starts when you seat people, and we let you know when it runs out.")}</p>
        </>
      )}

      {tab === 'bookings' && renderBookings()}
      {offerBooking && (
        <OfferSheet onClose={() => setOfferBooking(null)} onSend={offer => { ops.sendOffer(offerBooking.order ?? offerBooking.code, { ...offer, sentAt: Date.now(), src: 'booking', about: [`حجز ${hash(offerBooking.code)} · ${pick(offerBooking.tag)}`, `Booking ${hash(offerBooking.code)} · ${offerBooking.tag[1]}`] }, backNote); setOfferBooking(null); notify(t('أرسلنا العرض، وسيصلهم إشعار «افتح هديتك»', 'Offer sent. They get an “Open your gift” notification')) }}
          about={<p className="o-offer-for"><Armchair /><span><b>{t(`حجز ${hash(offerBooking.code)} · ${people(offerBooking.ppl)}`, `Booking ${hash(offerBooking.code)} · ${people(offerBooking.ppl)}`)}</b><small>{`${tName(offerBooking.table)} · ${pick(offerBooking.tag)}`}</small></span></p>} />
      )}

      {sel && !editing && (() => {
        const st = status(sel)
        return (
          <Sheet title={pick(sel.name)} onClose={() => setOpen(null)}>
            <p className="o-sheet-sub">{pick(sel.area)} · {t(`${sel.seats} مقاعد`, `${sel.seats} seats`)} · {sel.limit ? t(`جلسة ${sel.limit} د`, `${sel.limit} min sitting`) : t('بدون وقت', 'No time limit')}{sel.bookable ? '' : t(' · لا تُحجز', ' · walk-in only')}</p>
            {sel.seatedAt ? (
              <>
                <div className={`o-timer-card ${st.k === 'over' ? 'over' : ''}`}>
                  <Timer />
                  <div>
                    <b>{st.k === 'over' ? t(`تجاوزوا الوقت بـ ${st.sat - sel.limit} د`, `${st.sat - sel.limit} min over time`) : sel.limit ? t(`باقي ${st.left} دقيقة`, `${st.left} minutes left`) : t(`جالسون منذ ${st.sat} د`, `Seated for ${st.sat} min`)}</b>
                    <small>{t(`جلسوا ${clock(sel.seatedAt)}`, `Seated at ${clock(sel.seatedAt)}`)} · {people(sel.ppl!)}{sel.booking && ` · ${t('حجز', 'booking')} ${hash(sel.booking)}`}</small>
                  </div>
                </div>
                {sel.limit > 0 && <span className="o-tbl-bar big"><i style={{ width: `${Math.min(100, (st.sat / sel.limit) * 100)}%` }} /></span>}
                <div className="o-order-actions">
                  {sel.limit > 0 && <button type="button" className="o-issue" onClick={() => { patch(sel.id, { limit: sel.limit + 15 }); notify(t(`أضفنا 15 دقيقة إلى ${pick(sel.name)}`, `Added 15 minutes to ${pick(sel.name)}`)) }}>{t('+15 د', '+15 min')}</button>}
                  <button type="button" className="o-advance" onClick={() => { free(sel.id); setOpen(null); notify(t(`${pick(sel.name)} أصبحت شاغرة`, `${pick(sel.name)} is free`)) }}><Check />{t('غادروا، فرّغ الطاولة', 'They left, free it')}</button>
                </div>
              </>
            ) : (
              <>
                {st.nb && <p className={`o-note ${st.k === 'soon' ? 'warn' : ''}`}><Clock />{t(`عليها حجز ${clock(st.nb.at)} · ${people(st.nb.ppl)} · ${hash(st.nb.code)}`, `Booked at ${clock(st.nb.at)} · ${people(st.nb.ppl)} · ${hash(st.nb.code)}`)}</p>}
                <h4 className="o-sheet-h">{t('كم عدد الأشخاص؟', 'How many people?')}</h4>
                <div className="o-stepper">
                  <button type="button" onClick={() => setPpl(n => Math.max(1, n - 1))} aria-label={t('أقل', 'Fewer')}>−</button>
                  <b>{people(ppl)}</b>
                  <button type="button" onClick={() => setPpl(n => Math.min(sel.seats + 2, n + 1))} aria-label={t('أكثر', 'More')}>+</button>
                </div>
                <div className="o-order-actions">
                  <button type="button" className="o-advance" onClick={() => { seat(sel.id, ppl); setOpen(null); notify(t(`أجلسنا ${people(ppl)} على ${pick(sel.name)}، وبدأ العدّاد`, `Seated ${people(ppl)} at ${pick(sel.name)}. Timer started`)) }}><Play />{t('أجلسهم وابدأ العدّاد', 'Seat and start timer')}</button>
                </div>
              </>
            )}
            <button type="button" className="o-text-btn o-edit-table" onClick={() => setEditing(sel)}><PenLine />{t('عدّل الطاولة', 'Edit table')}</button>
          </Sheet>
        )
      })()}

      {editing && <TableForm table={editing === 'new' ? null : editing} areas={areas} onClose={() => setEditing(null)}
        onSave={x => {
          setTables(l => (l.some(y => y.id === x.id) ? l.map(y => (y.id === x.id ? { ...y, ...x } : y)) : [...l, x]))
          notify(editing === 'new' ? t(`أضفنا ${pick(x.name)}`, `Added ${pick(x.name)}`) : t(`حفظنا ${pick(x.name)}`, `Saved ${pick(x.name)}`))
          setEditing(null)
        }}
        onDelete={x => { setTables(l => l.filter(y => y.id !== x.id)); setEditing(null); setOpen(null); notify(t(`حذفنا ${pick(x.name)}`, `Removed ${pick(x.name)}`)) }} />}
    </div>
  )

  function renderBookings() {
    const groups: [string, Booking[]][] = [
      [t('جالسون الآن', 'Seated now'), bookings.filter(b => b.state === 'arrived')],
      [t('قادمون', 'Coming up'), bookings.filter(b => b.state === 'upcoming').sort((a, b) => a.at - b.at)],
      [t('انتهت', 'Finished'), bookings.filter(b => b.state === 'left' || b.state === 'noshow')],
    ]
    return (
      <>
        {groups.map(([title, list]) => list.length > 0 && (
          <section key={title} className="o-tm-group">
            <h4>{title}<small>{list.length}</small></h4>
            <ul className="o-bookings">
              {list.map(b => {
                const holdEnd = b.at + HOLD * min
                const late = b.state === 'upcoming' && now > b.at
                const busy = table(b.table)?.seatedAt && !table(b.table)?.booking
                return (
                  <li key={b.code} className={`b-${b.state} ${late ? 'late' : ''}`}>
                    <div className="o-booking-main">
                      <span className="o-visit-time">{clock(b.at)}</span>
                      <div>
                        <b>{tName(b.table)}</b>
                        <small>{people(b.ppl)} · {pick(b.tag)} · {hash(b.code)}{b.order && ` · ${t('لديه طلب', 'has an order')} ${hash(b.order)}`}</small>
                      </div>
                      <button type="button" className="o-icon-btn" onClick={() => openThread(b.code)} aria-label={t('راسل العميل', 'Message the customer')}><MessageCircle /></button>
                    </div>
                    {b.state === 'upcoming' && (
                      <>
                        <p className={`o-hold ${late ? 'late' : ''}`}><Timer />{late ? t(`متأخر ${mins(now - b.at)} د · الطاولة محجوزة له ${mins(holdEnd - now)} د أخرى`, `${mins(now - b.at)} min late · table held ${mins(holdEnd - now)} more min`) : t(`محجوزة حتى ${clock(holdEnd)}`, `Held until ${clock(holdEnd)}`)}</p>
                        {busy && <p className="o-hold late"><CircleAlert />{t('الطاولة مشغولة الآن، فرّغها قبل وصولهم', 'The table is taken right now. Free it before they arrive')}</p>}
                        <div className="o-order-actions">
                          <button type="button" className={`o-advance ${late || b.at - now < 15 * min ? '' : 'soft'}`} onClick={() => { setB(b.code, 'arrived'); seat(b.table, b.ppl, b.code); notify(t(`وصل ${hash(b.code)}، وبدأ عدّاد ${tName(b.table)}`, `${hash(b.code)} arrived. Timer started on ${tName(b.table)}`)) }}><Check />{t('وصلوا، أجلسهم', 'Arrived, seat them')}</button>
                          {late && <button type="button" className="o-issue" onClick={() => { setB(b.code, 'noshow'); notify(t(`${hash(b.code)} لم يحضروا. رسوم الحجز لك، والطاولة أصبحت شاغرة`, `${hash(b.code)} didn't show. You keep the booking fee and the table is free`)) }}>{t('لم يحضروا', 'No-show')}</button>}
                        </div>
                      </>
                    )}
                    {b.state === 'arrived' && (
                      <div className="o-order-actions">
                        <button type="button" className="o-issue" onClick={() => { free(b.table); setB(b.code, 'left'); notify(t(`${tName(b.table)} أصبحت شاغرة`, `${tName(b.table)} is free again`)) }}>{t('غادروا، الطاولة شاغرة', 'They left, table is free')}</button>
                      </div>
                    )}
                    {b.state === 'left' && (ops.offers[b.order ?? b.code] ? <OfferSent offer={ops.offers[b.order ?? b.code]} /> : <OfferButton onClick={() => setOfferBooking(b)} />)}
                    {b.state === 'noshow' && <p className="o-hold">{t('لم يحضروا · رسوم الحجز 5 ر.س لك', 'No-show · you keep the SAR 5 fee')}</p>}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        <p className="o-note"><Armchair />{t('نحجز الطاولة ساعة من وقت الحجز. وإذا لم يحضروا، رسوم الحجز لك.', "Each booking is held for an hour. If they don't show, you keep the booking fee.")}</p>
      </>
    )
  }
}

function TableForm({ table, areas, onSave, onDelete, onClose }: { table: Table | null; areas: T2[]; onSave: (x: Table) => void; onDelete: (x: Table) => void; onClose: () => void }) {
  const { t, pick } = useFmt()
  const [name, setName] = useState(table ? pick(table.name) : '')
  const [area, setArea] = useState<T2 | null>(table?.area ?? areas[0] ?? null)
  const [newArea, setNewArea] = useState('')
  const [adding, setAdding] = useState(areas.length === 0)
  const [seats, setSeats] = useState(table?.seats ?? 2)
  const [limit, setLimit] = useState(table?.limit ?? 60)
  const [custom, setCustom] = useState(!LIMITS.includes(table?.limit ?? 60))
  const [bookable, setBookable] = useState(table?.bookable ?? true)
  const where = adding ? (newArea.trim() ? [newArea.trim(), newArea.trim()] as T2 : null) : area
  const ok = name.trim() && where
  const keepName = table && name === pick(table.name)
  return (
    <Sheet title={table ? t('عدّل الطاولة', 'Edit table') : t('طاولة جديدة', 'New table')} onClose={onClose} footer={
      <>
        <button type="button" className="o-primary" disabled={!ok} onClick={() => ok && onSave({ ...(table ?? { id: `t${Date.now()}` }), name: keepName ? table!.name : [name.trim(), name.trim()], area: where!, seats, limit, bookable } as Table)}>{table ? t('احفظ', 'Save') : t('أضف الطاولة', 'Add table')}</button>
        {table && <button type="button" className="o-text-btn danger" onClick={() => onDelete(table)}>{t('احذف الطاولة', 'Delete table')}</button>}
      </>
    }>
      <label className="o-label" htmlFor="o-tname">{t('اسم الطاولة', 'Table name')}</label>
      <input id="o-tname" className="o-field" value={name} onChange={e => setName(e.target.value)} placeholder={t('مثلًا: نافذة 3', 'e.g. Window 3')} />

      <span className="o-label">{t('الموقع', 'Location')}</span>
      <div className="o-chips wrap">
        {areas.map(a => <button key={a[1]} type="button" className={`o-chip ${!adding && area?.[1] === a[1] ? 'active' : ''}`} onClick={() => { setArea(a); setAdding(false) }}>{pick(a)}</button>)}
        <button type="button" className={`o-chip ${adding ? 'active' : ''}`} onClick={() => setAdding(true)}><Plus />{t('موقع جديد', 'New location')}</button>
      </div>
      {adding && <input className="o-field o-mt" value={newArea} onChange={e => setNewArea(e.target.value)} placeholder={t('مثلًا: الدور الثاني', 'e.g. Upstairs')} autoFocus />}

      <span className="o-label">{t('عدد المقاعد', 'Seats')}</span>
      <div className="o-stepper">
        <button type="button" onClick={() => setSeats(n => Math.max(1, n - 1))} aria-label={t('أقل', 'Fewer')}>−</button>
        <b>{seats}</b>
        <button type="button" onClick={() => setSeats(n => Math.min(20, n + 1))} aria-label={t('أكثر', 'More')}>+</button>
      </div>

      <span className="o-label">{t('وقت الجلسة', 'Sitting time')}</span>
      <div className="o-chips wrap">
        {LIMITS.map(m => <button key={m} type="button" className={`o-chip ${!custom && limit === m ? 'active' : ''}`} onClick={() => { setLimit(m); setCustom(false) }}>{m ? t(m === 60 ? 'ساعة' : m === 120 ? 'ساعتين' : m === 90 ? 'ساعة ونصف' : `${m} د`, m >= 60 ? `${m / 60} h` : `${m} min`) : t('بدون وقت', 'No limit')}</button>)}
        <button type="button" className={`o-chip ${custom ? 'active' : ''}`} onClick={() => setCustom(true)}>{t('وقت آخر', 'Custom')}</button>
      </div>
      {custom && <div className="o-inline-field o-mt"><input className="o-field" type="number" inputMode="numeric" min={5} value={limit || ''} onChange={e => setLimit(Math.max(0, +e.target.value))} /><span>{t('دقيقة', 'minutes')}</span></div>}

      <button type="button" className="o-switch-row" role="switch" aria-checked={bookable} onClick={() => setBookable(b => !b)}>
        <span><b>{t('متاحة للحجز', 'Customers can book it')}</b><small>{bookable ? t('تظهر للحجز في تطبيق AroundMe', 'Shows up for booking in the AroundMe app') : t('للحضور دون حجز فقط', 'Walk-ins only')}</small></span>
        <em className={bookable ? 'on' : ''} />
      </button>
    </Sheet>
  )
}

/* ---------- Messages ---------- */
export function Messages({ ops, open, setOpen }: { ops: Ops; open: string | null; setOpen: (c: string | null) => void }) {
  const { t, clock } = useFmt()
  const { threads, setThreads, orders, bookings } = ops
  const [draft, setDraft] = useState('')
  const about = (code: string) => {
    const o = orders.find(x => x.code === code); if (o) return t(`طلب ${hash(code)}`, `Order ${hash(code)}`)
    const b = bookings.find(x => x.code === code); if (b) return t(`حجز ${hash(code)}`, `Booking ${hash(code)}`)
    return `${hash(code)}`
  }
  const thread = threads.find(x => x.code === open)
  useEffect(() => { if (open) setThreads(l => l.map(x => (x.code === open ? { ...x, unread: false } : x))) }, [open, setThreads])
  const send = (text: string) => {
    if (!text.trim() || !open) return
    setThreads(l => {
      const has = l.some(x => x.code === open)
      const msg: Msg = { from: 'me', text: text.trim(), at: Date.now() }
      return has ? l.map(x => (x.code === open ? { ...x, msgs: [...x.msgs, msg] } : x)) : [{ code: open, unread: false, msgs: [msg] }, ...l]
    })
    setDraft('')
  }
  const QUICK = [t('طلبك جاهز، أهلًا بك ☕', 'Your order is ready ☕'), t('سنتأخر 5 دقائق، نعتذر', "We're 5 minutes behind, sorry"), t('طاولتك محجوزة لك', 'Your table is held for you'), t('ماذا تفضّل بدل الصنف الذي نفد؟', 'What would you like instead of the item that ran out?')]
  const sorted = [...threads].sort((a, b) => b.msgs[b.msgs.length - 1].at - a.msgs[a.msgs.length - 1].at)
  return (
    <div className="o-ops">
      <p className="o-note"><MessageCircle />{t('يراسلك العملاء بشأن طلباتهم وحجوزاتهم. لا تظهر أسماؤهم، بل رقم الطلب أو الحجز فقط.', "Customers message you about their orders and bookings. You don't see their names, only the order or booking number.")}</p>
      <ul className="o-threads">
        {sorted.map(th => {
          const last = th.msgs[th.msgs.length - 1]
          return (
            <li key={th.code}>
              <button type="button" onClick={() => setOpen(th.code)} className={th.unread ? 'unread' : ''}>
                <span className="o-avatar">{hash(th.code)}</span>
                <div><b>{about(th.code)}</b><small>{last.from === 'me' ? t('أنت: ', 'You: ') : ''}{last.text}</small></div>
                <span className="o-thread-time">{clock(last.at)}{th.unread && <i />}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {open && (
        <Sheet title={about(open)} onClose={() => setOpen(null)} footer={
          <div className="o-composer">
            <div className="o-quick">{QUICK.map(q => <button key={q} type="button" className="o-chip" onClick={() => send(q)}>{q}</button>)}</div>
            <form onSubmit={e => { e.preventDefault(); send(draft) }}>
              <input className="o-field" value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('اكتب ردًا…', 'Write a reply…')} />
              <button type="submit" className="o-send" aria-label={t('أرسل', 'Send')}><Send /></button>
            </form>
          </div>
        }>
          <div className="o-chat">
            {(thread?.msgs ?? []).map((m, i) => <div key={i} className={`o-bubble ${m.from}`}>{m.text}<small>{clock(m.at)}</small></div>)}
            {!thread && <p className="o-sheet-sub">{t('ابدأ المحادثة مع العميل.', 'Start the conversation with the customer.')}</p>}
          </div>
        </Sheet>
      )}
    </div>
  )
}
