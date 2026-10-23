import { useEffect, useState } from 'react'
import { Armchair, BellRing, Check, ChefHat, CircleAlert, Clock, HandPlatter, MessageCircle, House, Navigation, Pause, PenLine, Play, Plus, Send, ShoppingBag, Timer, Users } from 'lucide-react'
import { Sheet, useT } from './Owner'
import { OfferButton, OfferSent, OfferSheet } from './Offer'
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
export function useOps() {
  const [boot] = useState(() => Date.now())
  const ago = (m: number) => boot - m * min
  const [orders, setOrders] = useState<Order[]>(() => [
    { code: 'A31', kind: 'seat', where: 'here', placed: ago(1), seat: SEATS[0], ppl: 2, lines: [['Spanish latte', 1], ['Iced latte', 1], ['San Sebastián cheesecake', 1]], pay: 'apple', status: 'new' },
    { code: 'A30', kind: 'pickup', where: 'way', eta: ago(-6), placed: ago(3), ppl: 1, lines: [['Flat white', 1], ['Butter croissant', 1]], note: 'حليب شوفان من فضلكم', pay: 'google', status: 'new' },
    { code: 'A28', kind: 'seat', where: 'here', placed: ago(7), started: ago(5), seat: SEATS[2], ppl: 1, lines: [['V60', 1], ['Cookie', 1]], pay: 'apple', status: 'prep' },
    { code: 'A27', kind: 'pre', where: 'way', eta: ago(-4), placed: ago(140), due: ago(-4), started: ago(12), ppl: 3, lines: [['Latte', 2], ['Cortado', 1]], pay: 'apple', status: 'prep' },
    { code: 'A26', kind: 'pickup', where: 'here', placed: ago(11), started: ago(9), readyAt: ago(2), ppl: 1, lines: [['Iced Spanish latte', 1]], pay: 'apple', status: 'ready' },
    { code: 'A25', kind: 'seat', placed: ago(24), started: ago(22), readyAt: ago(14), doneAt: ago(13), seat: SEATS[1], ppl: 4, lines: [['Spanish latte', 3], ['Honey cake', 2]], pay: 'google', status: 'done' },
    { code: 'A24', kind: 'pickup', placed: ago(38), started: ago(37), readyAt: ago(30), doneAt: ago(27), ppl: 1, lines: [['Cold brew', 1]], pay: 'apple', status: 'done' },
    { code: 'A23', kind: 'pre', placed: ago(300), due: ago(52), started: ago(60), readyAt: ago(53), doneAt: ago(50), ppl: 2, lines: [['Matcha latte', 1], ['Zaatar croissant', 2]], pay: 'apple', status: 'done' },
    { code: 'A33', kind: 'pre', where: 'home', placed: ago(90), due: ago(-35), ppl: 2, lines: [['Spanish latte', 2], ['Lotus cheesecake', 1]], note: 'سنجلس في الخارج', pay: 'apple', status: 'scheduled' },
    { code: 'A34', kind: 'pre', where: 'home', placed: ago(55), due: ago(-70), ppl: 1, lines: [['Cortado', 1], ['Chocolate croissant', 1]], pay: 'google', status: 'scheduled' },
  ])
  const [tables, setTables] = useState<Table[]>(() => [
    { id: 'w1', name: ['نافذة 1', 'Window 1'], area: AREAS[0], seats: 2, limit: 60, bookable: true, seatedAt: ago(48), ppl: 2 },
    { id: 'w2', name: ['نافذة 2', 'Window 2'], area: AREAS[0], seats: 2, limit: 60, bookable: true },
    { id: 'long', name: ['الطاولة الطويلة', 'Long table'], area: AREAS[1], seats: 8, limit: 90, bookable: true },
    { id: 'in1', name: ['داخل 1', 'Inside 1'], area: AREAS[1], seats: 4, limit: 60, bookable: false, seatedAt: ago(12), ppl: 3 },
    { id: 'q1', name: ['هادئة 1', 'Quiet 1'], area: AREAS[2], seats: 1, limit: 120, bookable: true, seatedAt: ago(20), ppl: 1, booking: 'B13' },
    { id: 'q2', name: ['هادئة 2', 'Quiet 2'], area: AREAS[2], seats: 2, limit: 120, bookable: true },
    { id: 'o1', name: ['خارجية 1', 'Outside 1'], area: AREAS[3], seats: 4, limit: 60, bookable: true, seatedAt: ago(65), ppl: 3 },
    { id: 'o2', name: ['خارجية 2', 'Outside 2'], area: AREAS[3], seats: 2, limit: 60, bookable: true },
  ])
  const [bookings, setBookings] = useState<Booking[]>(() => [
    { code: 'B12', at: ago(50), table: 'long', ppl: 4, tag: ['لقاء أصدقاء', 'Meeting friends'], state: 'left', order: 'A25' },
    { code: 'B13', at: ago(20), table: 'q1', ppl: 1, tag: ['مذاكرة', 'Studying'], state: 'arrived', order: 'A28' },
    { code: 'B14', at: ago(10), table: 'o2', ppl: 2, tag: ['عمل', 'Work'], state: 'upcoming' },
    { code: 'B15', at: ago(-4), table: 'long', ppl: 3, tag: ['اجتماع', 'Meeting'], state: 'upcoming', order: 'A27' },
    { code: 'B16', at: ago(-35), table: 'o1', ppl: 2, tag: ['استرخاء', 'Chilling'], state: 'upcoming', order: 'A33' },
    { code: 'B17', at: ago(-95), table: 'w2', ppl: 2, tag: ['عمل', 'Work'], state: 'upcoming' },
  ])
  const [threads, setThreads] = useState<Thread[]>(() => [
    { code: 'A30', unread: true, msgs: [{ from: 'them', text: 'السلام عليكم، هل يمكن تحضير الفلات وايت بحليب الشوفان؟', at: ago(2) }] },
    { code: 'B14', unread: true, msgs: [{ from: 'them', text: 'سأتأخر نحو عشر دقائق، أرجو ألا تُعطى طاولتي لأحد 🙏', at: ago(6) }] },
    { code: 'A27', unread: false, msgs: [{ from: 'them', text: 'سنصل بعد قليل، جهّزوه من فضلكم', at: ago(15) }, { from: 'me', text: 'أهلًا بكم، طلبكم قيد التحضير', at: ago(12) }] },
    { code: 'A25', unread: false, msgs: [{ from: 'them', text: 'شكرًا، كان التشيز كيك رائعًا', at: ago(10) }, { from: 'me', text: 'بالعافية، سعدنا بزيارتكم 🤍', at: ago(9) }] },
  ])
  // Come-back offers sent to past visitors, keyed by their order code (or booking code when they didn't order).
  const [offers, setOffers] = useState<Record<string, Offer>>(() => ({ A23: { kind: 'off', pct: 15, days: 14, note: '' } }))
  const [paused, setPaused] = useState<number | 'manual' | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(id) }, [])
  useEffect(() => { if (typeof paused === 'number' && now >= paused) setPaused(null) }, [now, paused])
  return { orders, setOrders, tables, setTables, bookings, setBookings, threads, setThreads, offers, setOffers, paused, setPaused, now }
}
export type Ops = ReturnType<typeof useOps>

function useFmt() {
  const { t, lang, tx, sar } = useT()
  const clock = (ms: number) => {
    const d = new Date(ms); const h = d.getHours(), m = d.getMinutes()
    return lang === 'ar' ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
  }
  const mins = (ms: number) => Math.max(0, Math.round(ms / min))
  const dur = (m: number) => t(m < 1 ? 'الآن' : `${m} د`, m < 1 ? 'now' : `${m} min`)
  const pick = (x: T2) => (lang === 'ar' ? x[0] : x[1])
  const people = (p: number) => t(p === 1 ? 'شخص' : p === 2 ? 'شخصين' : `${p} أشخاص`, `${p} ${p === 1 ? 'person' : 'people'}`)
  return { t, lang, tx, sar, clock, mins, dur, pick, people }
}

const total = (o: Order) => o.lines.filter(([en]) => !o.refunded?.includes(en)).reduce((s, [en, q]) => s + (PRICE[en] ?? 15) * q, 0)

/* ---------- Orders ---------- */
export function Orders({ ops, items, notify, openThread }: { ops: Ops; items: Item[]; notify: (s: string) => void; openThread: (code: string) => void }) {
  const { t, tx, sar, clock, mins, dur, pick, people } = useFmt()
  const { orders, setOrders, now, paused, setPaused } = ops
  const [tab, setTab] = useState<Status>('new')
  const [issue, setIssue] = useState<Order | null>(null)
  const [offerFor, setOfferFor] = useState<Order | null>(null)
  const [pauseOpen, setPauseOpen] = useState(false)
  const name = (en: string) => { const it = items.find(i => i.name.en === en); return it ? tx(it.name) : en }
  const count = (s: Status) => orders.filter(o => o.status === s).length
  const set = (code: string, patch: Partial<Order>) => setOrders(l => l.map(o => (o.code === code ? { ...o, ...patch } : o)))

  // A new order lands a little after the owner opens the board, the way it would on a real shift.
  useEffect(() => {
    const id = setTimeout(() => {
      if (paused) return
      setOrders(l => l.some(o => o.code === 'A32') ? l : [{ code: 'A32', kind: 'seat', where: 'here', placed: Date.now(), seat: SEATS[3], ppl: 2, lines: [['Iced Spanish latte', 2], ['Brownie', 1]], pay: 'apple', status: 'new' }, ...l])
      notify(t(`طلب جديد ${hash('A32')} من الجلسات الخارجية`, `New order ${hash('A32')} from outdoor seating`))
    }, 9000)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const shown = orders.filter(o => o.status === tab).sort((a, b) => tab === 'done' ? (b.doneAt ?? 0) - (a.doneAt ?? 0) : tab === 'scheduled' ? (a.due ?? 0) - (b.due ?? 0) : a.placed - b.placed)
  const doneToday = orders.filter(o => o.status === 'done')
  const avgPrep = doneToday.length ? Math.round(doneToday.reduce((s, o) => s + ((o.readyAt ?? 0) - (o.started ?? 0)), 0) / doneToday.length / min) : 0
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
        <div><b>{orders.filter(o => o.status !== 'scheduled').length}</b><small>{t('طلب اليوم', 'orders today')}</small></div>
        <div><b>{t(`${avgPrep} د`, `${avgPrep} min`)}</b><small>{t('متوسط التحضير', 'avg prep')}</small></div>
        <div><b>{sar(doneToday.reduce((s, o) => s + total(o), 0))}</b><small>{t('مبيعات اليوم', 'sales today')}</small></div>
      </div>

      <div className="o-status-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${tab === id ? 'active' : ''} s-${id}`} onClick={() => setTab(id)}>
            {label}<span>{count(id)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="o-empty"><Check /><b>{tab === 'new' ? t('لا توجد طلبات جديدة', 'No new orders') : tab === 'prep' ? t('لا شيء قيد التحضير', 'Nothing being prepared') : tab === 'ready' ? t('سُلّمت كل الطلبات الجاهزة', 'Everything ready was handed over') : t('لا شيء هنا', 'Nothing here')}</b><small>{t('يظهر هنا كل طلب جديد ويصلك تنبيه به.', "New orders show up here and you'll get an alert.")}</small></div>
      )}

      <ul className="o-orders">
        {shown.map(o => {
          const waited = mins(now - o.placed)
          const inPrep = o.started ? mins(now - o.started) : 0
          const slow = o.status === 'prep' && inPrep > PREP_TARGET
          const [label, icon] = action(o)
          return (
            <li key={o.code} className={`o-order s-${o.status} ${slow ? 'slow' : ''}`}>
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
              <p className="o-paid"><Check />{t('مدفوع', 'Paid')} {sar(total(o))} · {o.pay === 'apple' ? 'Apple Pay' : 'Google Pay'}</p>
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
        <OfferSheet onClose={() => setOfferFor(null)} onSend={offer => { ops.setOffers(x => ({ ...x, [offerFor.code]: offer })); setOfferFor(null); notify(t('أرسلنا العرض، وسيصله إشعار «شاهد العرض»', 'Offer sent. They get a “See the offer” notification')) }}
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
  const { t, clock, mins, pick, people } = useFmt()
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
          <button type="button" className="o-dashed" onClick={() => setEditing('new')}><Plus />{t('أضف طاولة', 'Add a table')}</button>
          <p className="o-note"><Timer />{t('لكل طاولة وقت جلسة. يبدأ العدّاد عند إجلاس العملاء، وننبهك عند انتهاء وقتهم.', "Each table has a sitting time. The timer starts when you seat people, and we let you know when it runs out.")}</p>
        </>
      )}

      {tab === 'bookings' && renderBookings()}
      {offerBooking && (
        <OfferSheet onClose={() => setOfferBooking(null)} onSend={offer => { ops.setOffers(x => ({ ...x, [offerBooking.order ?? offerBooking.code]: offer })); setOfferBooking(null); notify(t('أرسلنا العرض، وسيصلهم إشعار «شاهد العرض»', 'Offer sent. They get a “See the offer” notification')) }}
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
