import { useEffect, useState } from 'react'
import { Armchair, BellRing, Check, ChefHat, CircleAlert, Clock, HandPlatter, MessageCircle, Pause, Play, Send, ShoppingBag, Timer, Users } from 'lucide-react'
import { Sheet, useT } from './Owner'
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
}
export type Booking = { code: string; at: number; seat: T2; ppl: number; tag: T2; state: 'upcoming' | 'arrived' | 'noshow' | 'left'; order?: string }
export type Msg = { from: 'them' | 'me'; text: string; at: number }
export type Thread = { code: string; msgs: Msg[]; unread: boolean }

// Unit prices for the sample orders, so totals work even if the owner's menu is still being set up.
const PRICE: Record<string, number> = {
  Latte: 18, 'Spanish latte': 21, 'Flat white': 19, Cortado: 16, V60: 22, 'Iced latte': 20, 'Iced Spanish latte': 23, 'Cold brew': 20,
  'San Sebastián cheesecake': 28, 'Lotus cheesecake': 26, 'Honey cake': 24, Brownie: 14, 'Butter croissant': 12, 'Zaatar croissant': 14,
  'Chocolate croissant': 15, Cookie: 9, 'Matcha latte': 24, 'Orange juice': 15, Water: 3, 'Halloumi sandwich': 26, 'Turkey and cheese sandwich': 29,
}
const PREP_TARGET = 10 // minutes
const SEATS: T2[] = [['عند النافذة', 'By the window'], ['الطاولة الطويلة', 'Long table'], ['منطقة الهدوء', 'Quiet area'], ['الجلسات الخارجية', 'Outdoor seating']]

const min = 60_000
// Order and booking codes are Latin; isolate them so «#A30» doesn't flip to «A30#» inside Arabic text.
const hash = (code: string) => `\u2066#${code}\u2069`
export function useOps() {
  const [boot] = useState(() => Date.now())
  const ago = (m: number) => boot - m * min
  const [orders, setOrders] = useState<Order[]>(() => [
    { code: 'A31', kind: 'seat', placed: ago(1), seat: SEATS[0], ppl: 2, lines: [['Spanish latte', 1], ['Iced latte', 1], ['San Sebastián cheesecake', 1]], pay: 'apple', status: 'new' },
    { code: 'A30', kind: 'pickup', placed: ago(3), ppl: 1, lines: [['Flat white', 1], ['Butter croissant', 1]], note: 'حليب شوفان لو سمحت', pay: 'google', status: 'new' },
    { code: 'A28', kind: 'seat', placed: ago(7), started: ago(5), seat: SEATS[2], ppl: 1, lines: [['V60', 1], ['Cookie', 1]], pay: 'apple', status: 'prep' },
    { code: 'A27', kind: 'pre', placed: ago(140), due: ago(-4), started: ago(12), ppl: 3, lines: [['Latte', 2], ['Cortado', 1]], pay: 'apple', status: 'prep' },
    { code: 'A26', kind: 'pickup', placed: ago(11), started: ago(9), readyAt: ago(2), ppl: 1, lines: [['Iced Spanish latte', 1]], pay: 'apple', status: 'ready' },
    { code: 'A25', kind: 'seat', placed: ago(24), started: ago(22), readyAt: ago(14), doneAt: ago(13), seat: SEATS[1], ppl: 4, lines: [['Spanish latte', 3], ['Honey cake', 2]], pay: 'google', status: 'done' },
    { code: 'A24', kind: 'pickup', placed: ago(38), started: ago(37), readyAt: ago(30), doneAt: ago(27), ppl: 1, lines: [['Cold brew', 1]], pay: 'apple', status: 'done' },
    { code: 'A23', kind: 'pre', placed: ago(300), due: ago(52), started: ago(60), readyAt: ago(53), doneAt: ago(50), ppl: 2, lines: [['Matcha latte', 1], ['Zaatar croissant', 2]], pay: 'apple', status: 'done' },
    { code: 'A33', kind: 'pre', placed: ago(90), due: ago(-35), ppl: 2, lines: [['Spanish latte', 2], ['Lotus cheesecake', 1]], note: 'بنجلس برا', pay: 'apple', status: 'scheduled' },
    { code: 'A34', kind: 'pre', placed: ago(55), due: ago(-70), ppl: 1, lines: [['Cortado', 1], ['Chocolate croissant', 1]], pay: 'google', status: 'scheduled' },
  ])
  const [bookings, setBookings] = useState<Booking[]>(() => [
    { code: 'B12', at: ago(50), seat: SEATS[1], ppl: 4, tag: ['أقابل أصحاب', 'Meeting friends'], state: 'left', order: 'A25' },
    { code: 'B13', at: ago(20), seat: SEATS[2], ppl: 1, tag: ['مذاكرة', 'Studying'], state: 'arrived', order: 'A28' },
    { code: 'B14', at: ago(10), seat: SEATS[3], ppl: 2, tag: ['شغل', 'Work'], state: 'upcoming' },
    { code: 'B15', at: ago(-4), seat: SEATS[1], ppl: 3, tag: ['اجتماع', 'Meeting'], state: 'upcoming', order: 'A27' },
    { code: 'B16', at: ago(-35), seat: SEATS[3], ppl: 2, tag: ['أروّق', 'Chilling'], state: 'upcoming', order: 'A33' },
    { code: 'B17', at: ago(-95), seat: SEATS[0], ppl: 2, tag: ['شغل', 'Work'], state: 'upcoming' },
  ])
  const [threads, setThreads] = useState<Thread[]>(() => [
    { code: 'A30', unread: true, msgs: [{ from: 'them', text: 'السلام عليكم، ممكن الفلات وايت بحليب شوفان؟', at: ago(2) }] },
    { code: 'B14', unread: true, msgs: [{ from: 'them', text: 'بتأخر عشر دقايق تقريبًا، لا تعطون طاولتي أحد 🙏', at: ago(6) }] },
    { code: 'A27', unread: false, msgs: [{ from: 'them', text: 'نوصل بعد شوي، جهزوه لو سمحتوا', at: ago(15) }, { from: 'me', text: 'حياكم، طلبكم صار يتحضّر', at: ago(12) }] },
    { code: 'A25', unread: false, msgs: [{ from: 'them', text: 'شكرًا التشيز كيك كان رهيب', at: ago(10) }, { from: 'me', text: 'بالعافية، نورتونا 🤍', at: ago(9) }] },
  ])
  const [paused, setPaused] = useState<number | 'manual' | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(id) }, [])
  useEffect(() => { if (typeof paused === 'number' && now >= paused) setPaused(null) }, [now, paused])
  return { orders, setOrders, bookings, setBookings, threads, setThreads, paused, setPaused, now }
}
export type Ops = ReturnType<typeof useOps>

function useFmt() {
  const { t, lang, tx, sar } = useT()
  const clock = (ms: number) => {
    const d = new Date(ms); const h = d.getHours(), m = d.getMinutes()
    return lang === 'ar' ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
  }
  const mins = (ms: number) => Math.max(0, Math.round(ms / min))
  const dur = (m: number) => t(m < 1 ? 'الحين' : `${m} د`, m < 1 ? 'now' : `${m} min`)
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
  const [pauseOpen, setPauseOpen] = useState(false)
  const name = (en: string) => { const it = items.find(i => i.name.en === en); return it ? tx(it.name) : en }
  const count = (s: Status) => orders.filter(o => o.status === s).length
  const set = (code: string, patch: Partial<Order>) => setOrders(l => l.map(o => (o.code === code ? { ...o, ...patch } : o)))

  // A new order lands a little after the owner opens the board, the way it would on a real shift.
  useEffect(() => {
    const id = setTimeout(() => {
      if (paused) return
      setOrders(l => l.some(o => o.code === 'A32') ? l : [{ code: 'A32', kind: 'seat', placed: Date.now(), seat: SEATS[3], ppl: 2, lines: [['Iced Spanish latte', 2], ['Brownie', 1]], pay: 'apple', status: 'new' }, ...l])
      notify(t(`طلب جديد ${hash('A32')} من الجلسات الخارجية`, `New order ${hash('A32')} from outdoor seating`))
    }, 9000)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = (o: Order) => {
    if (o.status === 'scheduled' || o.status === 'new') { set(o.code, { status: 'prep', started: Date.now() }); notify(t(`بدأ تحضير ${hash(o.code)}، وصل العميل إشعار`, `Started ${hash(o.code)}. The customer was notified`)) }
    else if (o.status === 'prep') { set(o.code, { status: 'ready', readyAt: Date.now() }); notify(t(`${hash(o.code)} جاهز، أرسلنا للعميل «طلبك جاهز»`, `${hash(o.code)} is ready. We told the customer`)) }
    else if (o.status === 'ready') { set(o.code, { status: 'done', doneAt: Date.now() }); notify(t(`تم تسليم الطلب ${hash(o.code)}`, `Order ${hash(o.code)} handed over`)) }
  }
  const action = (o: Order) =>
    o.status === 'scheduled' ? [t('ابدأ التحضير بدري', 'Start early'), <ChefHat key="i" />] as const
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
          <b>{paused ? t('الطلبات موقفة', 'Orders are paused') : t('تستقبل طلبات الحين', 'Taking orders')}</b>
          <small>{paused ? (paused === 'manual' ? t('لين ترجعها', 'Until you turn them back on') : t(`ترجع ${clock(paused)}`, `Back at ${clock(paused)}`)) : t(`وقت التحضير المتوقع ~${PREP_TARGET} د`, `Expected prep time ~${PREP_TARGET} min`)}</small>
        </div>
        <button type="button" onClick={() => (paused ? (setPaused(null), notify(t('رجعت تستقبل طلبات', 'Taking orders again'))) : setPauseOpen(true))}>{paused ? <><Play />{t('رجّعها', 'Resume')}</> : <><Pause />{t('وقّف مؤقتًا', 'Pause')}</>}</button>
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
        <div className="o-empty"><Check /><b>{tab === 'new' ? t('ما فيه طلبات جديدة', 'No new orders') : tab === 'prep' ? t('ما فيه شي يتحضّر', 'Nothing being prepared') : tab === 'ready' ? t('كل الجاهز انسلّم', 'Everything ready was handed over') : t('ما فيه شي هنا', 'Nothing here')}</b><small>{t('أول ما يجي طلب يطلع هنا ويوصلك تنبيه.', "New orders show up here and you'll get an alert.")}</small></div>
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
                  {o.kind === 'seat' ? <><Armchair />{t('من مكانه', 'At a table')}</> : o.kind === 'pickup' ? <><ShoppingBag />{t('استلام', 'Pickup')}</> : <><Clock />{t('طلب مسبق', 'Pre-order')}</>}
                </span>
                <span className="o-order-time">
                  {o.status === 'done' ? t(`انسلّم ${clock(o.doneAt!)}`, `Handed over ${clock(o.doneAt!)}`)
                    : o.status === 'scheduled' ? t(`يوصل ${clock(o.due!)}`, `Arrives ${clock(o.due!)}`)
                    : o.status === 'ready' ? t(`جاهز من ${dur(mins(now - o.readyAt!))}`, `Ready for ${dur(mins(now - o.readyAt!))}`)
                    : o.status === 'prep' ? <><Timer />{dur(inPrep)}</>
                    : t(`قبل ${dur(waited)}`, `${dur(waited)} ago`)}
                </span>
              </div>
              <p className="o-order-who"><Users />{people(o.ppl)}{o.seat && <> · {pick(o.seat)}</>}{o.kind === 'pre' && o.due && o.status !== 'scheduled' && o.status !== 'done' && <> · {t(`يوصل ${clock(o.due)}`, `arrives ${clock(o.due)}`)}</>}</p>
              <ul className="o-lines">
                {o.lines.map(([en, q]) => <li key={en} className={o.refunded?.includes(en) ? 'gone' : ''}><b>{q}×</b>{name(en)}{o.refunded?.includes(en) && <small>{t('خلص · رجعنا مبلغه', 'Out · refunded')}</small>}</li>)}
              </ul>
              {o.note && <p className="o-order-note">«{o.note}»</p>}
              {o.late && o.status !== 'done' && <p className="o-order-flag"><Clock />{t('بلّغنا العميل إن الطلب بيتأخر 10 دقايق', 'We told the customer it will be 10 minutes late')}</p>}
              {slow && <p className="o-order-flag"><CircleAlert />{t(`تعدّى ${PREP_TARGET} دقايق`, `Over ${PREP_TARGET} minutes`)}</p>}
              <p className="o-paid"><Check />{t('مدفوع', 'Paid')} {sar(total(o))} · {o.pay === 'apple' ? 'Apple Pay' : 'Google Pay'}</p>
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
          <p className="o-sheet-sub">{t('اختر وش صار، ونبلّغ العميل على طول.', "Pick what happened and we'll tell the customer right away.")}</p>
          <h4 className="o-sheet-h">{t('صنف خلص', 'An item ran out')}</h4>
          <div className="o-issue-list">
            {issue.lines.filter(([en]) => !issue.refunded?.includes(en)).map(([en, q]) => (
              <button key={en} type="button" onClick={() => {
                set(issue.code, { refunded: [...(issue.refunded ?? []), en] })
                notify(t(`رجعنا مبلغ «${name(en)}» (${sar((PRICE[en] ?? 15) * q)}) للعميل وبلغناه`, `Refunded “${name(en)}” (${sar((PRICE[en] ?? 15) * q)}) and told the customer`))
                setIssue(null)
              }}><b>{q}× {name(en)}</b><small>{t(`نرجّع ${sar((PRICE[en] ?? 15) * q)}`, `Refund ${sar((PRICE[en] ?? 15) * q)}`)}</small></button>
            ))}
          </div>
          <h4 className="o-sheet-h">{t('تأخير', 'Running late')}</h4>
          <div className="o-issue-list">
            <button type="button" onClick={() => { set(issue.code, { late: true }); notify(t('بلغنا العميل إن طلبه بيتأخر 10 دقايق', 'We told the customer it will be 10 minutes late')); setIssue(null) }}>
              <b>{t('بيتأخر 10 دقايق', '10 more minutes')}</b><small>{t('نرسل للعميل تنبيه بالوقت الجديد', 'We send the customer the new time')}</small>
            </button>
          </div>
          <p className="o-note"><CircleAlert />{t('إذا صنف خلص، نرجّع مبلغه للعميل تلقائيًا. باقي الطلب يكمل عادي.', 'If an item runs out, we refund it to the customer automatically. The rest of the order goes ahead.')}</p>
        </Sheet>
      )}

      {pauseOpen && (
        <Sheet title={t('وقّف الطلبات مؤقتًا', 'Pause orders')} onClose={() => setPauseOpen(false)}>
          <p className="o-sheet-sub">{t('زحمة؟ وقّف الطلبات الجديدة شوي. الطلبات اللي جت قبل تكمل عادي، والحجوزات ما تتأثر.', 'Busy? Stop new orders for a bit. Orders already in keep going, and bookings are not affected.')}</p>
          <div className="o-issue-list">
            {([[15, t('15 دقيقة', '15 minutes')], [30, t('نص ساعة', '30 minutes')], [60, t('ساعة', '1 hour')]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => { setPaused(Date.now() + m * min); setPauseOpen(false); notify(t(`وقفنا الطلبات ${label}`, `Orders paused for ${label}`)) }}><b>{label}</b><small>{t(`ترجع ${clock(Date.now() + m * min)}`, `Back at ${clock(Date.now() + m * min)}`)}</small></button>
            ))}
            <button type="button" onClick={() => { setPaused('manual'); setPauseOpen(false); notify(t('وقفنا الطلبات لين ترجعها', 'Orders paused until you resume')) }}><b>{t('لين أرجعها', 'Until I turn them back on')}</b><small>{t('ما ترجع إلا منك', 'Only you can resume')}</small></button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/* ---------- Today's tables ---------- */
export function Tables({ ops, notify, openThread }: { ops: Ops; notify: (s: string) => void; openThread: (code: string) => void }) {
  const { t, clock, mins, pick, people } = useFmt()
  const { bookings, setBookings, now } = ops
  const [closed, setClosed] = useState<string[]>([])
  const set = (code: string, state: Booking['state']) => setBookings(l => l.map(b => (b.code === code ? { ...b, state } : b)))
  const HOLD = 60
  const groups: [string, Booking[]][] = [
    [t('جالسين الحين', 'Seated now'), bookings.filter(b => b.state === 'arrived')],
    [t('جايين', 'Coming up'), bookings.filter(b => b.state === 'upcoming').sort((a, b) => a.at - b.at)],
    [t('خلصت', 'Finished'), bookings.filter(b => b.state === 'left' || b.state === 'noshow')],
  ]
  return (
    <div className="o-ops">
      <div className="o-ops-stats">
        <div><b>{bookings.length}</b><small>{t('حجز اليوم', 'bookings today')}</small></div>
        <div><b>{bookings.filter(b => b.state === 'arrived').length}</b><small>{t('جالسين الحين', 'seated now')}</small></div>
        <div><b>{bookings.filter(b => b.state === 'upcoming').length}</b><small>{t('جايين', 'coming up')}</small></div>
      </div>
      {groups.map(([title, list]) => list.length > 0 && (
        <section key={title} className="o-tm-group">
          <h4>{title}<small>{list.length}</small></h4>
          <ul className="o-bookings">
            {list.map(b => {
              const holdEnd = b.at + HOLD * min
              const left = mins(holdEnd - now)
              const lateBy = mins(now - b.at)
              const late = b.state === 'upcoming' && now > b.at
              return (
                <li key={b.code} className={`b-${b.state} ${late ? 'late' : ''}`}>
                  <div className="o-booking-main">
                    <span className="o-visit-time">{clock(b.at)}</span>
                    <div>
                      <b>{pick(b.seat)}</b>
                      <small>{people(b.ppl)} · {pick(b.tag)} · {hash(b.code)}{b.order && ` · ${t('معه طلب', 'has an order')} ${hash(b.order)}`}</small>
                    </div>
                    <button type="button" className="o-icon-btn" onClick={() => openThread(b.code)} aria-label={t('راسل العميل', 'Message the customer')}><MessageCircle /></button>
                  </div>
                  {b.state === 'upcoming' && (
                    <>
                      <p className={`o-hold ${late ? 'late' : ''}`}><Timer />{late ? t(`متأخر ${lateBy} د · الطاولة محجوزة له ${left} د باقي`, `${lateBy} min late · table held ${left} more min`) : t(`محجوزة لين ${clock(holdEnd)}`, `Held until ${clock(holdEnd)}`)}</p>
                      <div className="o-order-actions">
                        <button type="button" className={`o-advance ${late || b.at - now < 15 * min ? '' : 'soft'}`} onClick={() => { set(b.code, 'arrived'); notify(t(`وصلوا ${hash(b.code)}، أهلًا فيهم`, `${hash(b.code)} arrived`)) }}><Check />{t('وصلوا', 'Arrived')}</button>
                        {late && <button type="button" className="o-issue" onClick={() => { set(b.code, 'noshow'); notify(t(`${hash(b.code)} ما حضروا. رسوم الحجز لك، والطاولة صارت فاضية`, `${hash(b.code)} didn't show. You keep the booking fee and the table is free`)) }}>{t('ما حضروا', 'No-show')}</button>}
                      </div>
                    </>
                  )}
                  {b.state === 'arrived' && (
                    <div className="o-order-actions">
                      <button type="button" className="o-issue" onClick={() => { set(b.code, 'left'); notify(t(`الطاولة (${pick(b.seat)}) صارت فاضية`, `${pick(b.seat)} is free again`)) }}>{t('قاموا، الطاولة فاضية', 'They left, table is free')}</button>
                    </div>
                  )}
                  {b.state === 'noshow' && <p className="o-hold">{t('ما حضروا · رسوم الحجز 5 ر.س لك', 'No-show · you keep the SAR 5 fee')}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <section className="o-tm-group">
        <h4>{t('تقبل حجز في', 'Take bookings for')}</h4>
        <ul className="o-tm-list">
          {SEATS.map(s => {
            const on = !closed.includes(s[1])
            return (
              <li key={s[1]}>
                <div><b>{pick(s)}</b><small>{on ? t('العملاء يقدرون يحجزونها', 'Customers can book it') : t('مقفولة للحجز اليوم', 'Closed for booking today')}</small></div>
                <button type="button" className="o-toggle" role="switch" aria-checked={on} aria-label={pick(s)} onClick={() => setClosed(c => on ? [...c, s[1]] : c.filter(x => x !== s[1]))}>
                  <em className={on ? 'on' : ''} />
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      <p className="o-note"><Armchair />{t('كل طاولة محجوزة ساعة من وقت الحجز. إذا ما حضروا، رسوم الحجز لك.', "Each table is held for an hour from the booking time. If they don't show, you keep the booking fee.")}</p>
    </div>
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
  const QUICK = [t('طلبك جاهز، حياك ☕', 'Your order is ready ☕'), t('بنتأخر 5 دقايق، نعتذر', "We're 5 minutes behind, sorry"), t('طاولتك محجوزة لك', 'Your table is held for you'), t('وش تحب بدال الصنف اللي خلص؟', 'What would you like instead of the item that ran out?')]
  const sorted = [...threads].sort((a, b) => b.msgs[b.msgs.length - 1].at - a.msgs[a.msgs.length - 1].at)
  return (
    <div className="o-ops">
      <p className="o-note"><MessageCircle />{t('العملاء يراسلونك عن طلباتهم وحجوزاتهم. ما تشوف أسماءهم، بس رقم الطلب أو الحجز.', "Customers message you about their orders and bookings. You don't see their names, only the order or booking number.")}</p>
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
              <input className="o-field" value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('اكتب رد…', 'Write a reply…')} />
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
