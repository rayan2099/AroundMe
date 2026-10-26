import { useState } from 'react'
import { ArrowDown, ArrowUp, SlidersHorizontal, Check, ChevronLeft, ChevronRight, Clock, Coffee, Gift, HeartHandshake, Lightbulb, Lock, MapPin, MessageCircleHeart, Repeat, Search, ShoppingBag, Sparkles, TrendingUp, UserPlus, Users } from 'lucide-react'
import { Sheet, useT } from './Owner'
import { useCan } from './Staff'
import { BundleSheet, PerkSheet, bundleFull, defaultBundle } from './Grow'
import type { Bundle, Perk } from './Grow'
import { OfferSheet } from './Offer'
import type { Branch, Ops } from './Ops'
import type { Item } from './data'
import { RangePicker, inRange, prevRange, presetRange, rangeAgo, rangeDays, samePeriod, useRangeText } from './Range'
import type { Range } from './Range'
import { visitsFor } from './Tomorrow'

type Period = 'day' | 'week' | 'month'
// Sample numbers for a café's first weeks on AroundMe. A week is the base; a day and a month are scaled from it.
export const WEEK = { revenue: 12840, visits: 214, newShare: 0.38, returnRate: 42, orders: 163, avgOrder: 41, counterAvg: 29, bookings: 57, fee: 5, meetups: 46, stayMin: 108, lostTries: 23 }
// One branch's sample week, before scaling by the branch's size (volume follows size); habits differ a little (a busy branch sells
// bigger orders and brings people back more, a small one keeps them longer), so branches can be compared fairly.
export function weekFor(scale: number) {
  const d = scale - 1
  const avgOrder = Math.round(WEEK.avgOrder + d * 10)
  return {
    ...WEEK, avgOrder,
    revenue: Math.round(WEEK.revenue * (avgOrder / WEEK.avgOrder)),
    newShare: WEEK.newShare - d * 0.1, returnRate: Math.round(WEEK.returnRate + d * 12), stayMin: Math.round(WEEK.stayMin - d * 30),
  }
}
// Change from the previous period (%; return rate in points). Lost orders and prep going down is good.
type Metric = 'revenue' | 'visits' | 'orders' | 'avgOrder' | 'newCust' | 'returnRate' | 'bookings' | 'meetups' | 'stay' | 'lost'
const CHANGE: Record<Metric, Record<Period, number>> = {
  revenue: { day: 9, week: 18, month: 24 }, visits: { day: 6, week: 14, month: 21 }, orders: { day: 11, week: 16, month: 22 },
  avgOrder: { day: -2, week: 3, month: 5 }, newCust: { day: 12, week: 9, month: 17 }, returnRate: { day: 3, week: 4, month: 6 },
  bookings: { day: -8, week: 11, month: 19 }, meetups: { day: 25, week: 21, month: 32 }, stay: { day: -4, week: 2, month: -3 }, lost: { day: 40, week: -15, month: -28 },
}
const LOWER_IS_BETTER: Metric[] = ['lost']
// AroundMe visits by hour, 7am to 11pm. The early afternoon is usually quiet; planned visits fill it.
const HOURS = [6, 14, 16, 11, 8, 7, 12, 15, 16, 13, 10, 14, 20, 22, 18, 8, 4]
const FIRST_HOUR = 7
const QUIET = [13, 14, 15, 16]
type T2 = [string, string]
// Meetups at the café. Owners see what kind of help happened, never who: no names or photos.
// Help is one-way: one person needed help and another helped.
export const MEETUPS: { helper: T2; f?: boolean; helped: T2; topic: T2; tags: T2[]; when: [number, number, number]; mins: number; seat: T2; ordered: number; again?: boolean }[] = [
  { helper: ['مطور تطبيقات', 'App developer'], helped: ['صاحبة مشروع ناشئ', 'Startup founder'], topic: ['تطبيقها يتوقف عند صفحة الدفع', 'Her app froze on the payment page'], tags: [['برمجة', 'Coding'], ['تطبيقات', 'Apps']], when: [0, 16, 10], mins: 25, seat: ['عند النافذة', 'By the window'], ordered: 2, again: true },
  { helper: ['مصممة جرافيك', 'Graphic designer'], f: true, helped: ['صاحب متجر إلكتروني', 'Online store owner'], topic: ['رأي في شعار المتجر الجديد', 'Feedback on a new store logo'], tags: [['تصميم', 'Design'], ['هوية بصرية', 'Branding']], when: [0, 14, 35], mins: 15, seat: ['الطاولة الطويلة', 'Long table'], ordered: 2 },
  { helper: ['محللة مالية', 'Financial analyst'], f: true, helped: ['رائد أعمال', 'Entrepreneur'], topic: ['مراجعة جدول التدفقات النقدية', 'Reviewing a cash-flow sheet'], tags: [['مالية', 'Finance'], ['Excel', 'Excel']], when: [1, 18, 20], mins: 30, seat: ['منطقة الهدوء', 'Quiet area'], ordered: 3, again: true },
  { helper: ['مختص تسويق رقمي', 'Digital marketer'], helped: ['صاحبة مشروع هدايا', 'Gift shop owner'], topic: ['خطة إعلان على سناب شات', 'A Snapchat ad plan'], tags: [['تسويق', 'Marketing']], when: [1, 17, 5], mins: 20, seat: ['الجلسات الخارجية', 'Outdoor seating'], ordered: 2 },
  { helper: ['كاتبة إعلانية', 'Copywriter'], f: true, helped: ['طالب جامعي', 'University student'], topic: ['تدقيق رسالة تقديم وظيفة', 'Proofreading a job cover letter'], tags: [['كتابة', 'Writing']], when: [2, 15, 40], mins: 10, seat: ['قريب من الكاونتر', 'Near the counter'], ordered: 1 },
  { helper: ['مصور منتجات', 'Product photographer'], helped: ['صاحبة متجر عطور', 'Perfume shop owner'], topic: ['تصوير المنتجات بالجوال', 'Shooting products on a phone'], tags: [['تصوير', 'Photography']], when: [3, 13, 15], mins: 25, seat: ['عند النافذة', 'By the window'], ordered: 2 },
]
// What the café's AroundMe customers say they can help with, and what they come needing help with (share of people).
const SKILLS: [T2, number][] = [[['برمجة وتطبيقات', 'Coding and apps'], 31], [['تصميم', 'Design'], 22], [['تسويق', 'Marketing'], 17], [['المالية والجداول', 'Finance and Excel'], 12], [['كتابة وترجمة', 'Writing and translation'], 10], [['تصوير', 'Photography'], 8]]
const NEEDS: [T2, number][] = [[['مراجعة فكرة مشروع', 'Startup idea feedback'], 28], [['حل مشكلة كود', 'Fixing code'], 24], [['تصميم عرض أو شعار', 'Deck or logo design'], 19], [['تسويق وإعلانات', 'Marketing and ads'], 15], [['مذاكرة وواجبات', 'Studying'], 14]]
const PEOPLE: [T2, number][] = [[['موظفين', 'Employees'], 38], [['مستقلين', 'Freelancers'], 27], [['رواد أعمال', 'Founders'], 21], [['طلاب', 'Students'], 14]]

// Tomorrow's AroundMe visits as the owner sees them: time, party size, why they're coming, table and pre-order. No names.
export type Visit = { at: [number, number]; ppl: number; kind: 'visit' | 'need' | 'help'; tag: T2; seat?: T2; order?: [string, number][] }
export const TOMORROW: Visit[] = [
  { at: [8, 30], ppl: 1, kind: 'visit', tag: ['عمل', 'Work'], order: [['Flat white', 1], ['Butter croissant', 1]] },
  { at: [9, 15], ppl: 1, kind: 'visit', tag: ['طلب سريع', 'Grab and go'], order: [['Iced latte', 1]] },
  { at: [10, 0], ppl: 3, kind: 'visit', tag: ['اجتماع', 'Meeting'], seat: ['الطاولة الطويلة', 'Long table'], order: [['Latte', 2], ['Cortado', 1]] },
  { at: [11, 30], ppl: 1, kind: 'need', tag: ['حل مشكلة كود', 'Fixing code'] },
  { at: [12, 0], ppl: 2, kind: 'visit', tag: ['لقاء أصدقاء', 'Meeting friends'], order: [['Spanish latte', 2]] },
  { at: [13, 0], ppl: 1, kind: 'visit', tag: ['مذاكرة', 'Studying'], seat: ['منطقة الهدوء', 'Quiet area'] },
  { at: [13, 45], ppl: 1, kind: 'help', tag: ['تصميم', 'Design'] },
  { at: [14, 30], ppl: 1, kind: 'visit', tag: ['قراءة', 'Reading'], order: [['V60', 1]] },
  { at: [15, 0], ppl: 2, kind: 'visit', tag: ['عمل', 'Work'], seat: ['عند النافذة', 'By the window'], order: [['Iced Spanish latte', 2], ['San Sebastián cheesecake', 1]] },
  { at: [15, 30], ppl: 1, kind: 'need', tag: ['مراجعة فكرة مشروع', 'Startup idea feedback'] },
  { at: [16, 0], ppl: 4, kind: 'visit', tag: ['لقاء أصدقاء', 'Meeting friends'], seat: ['الجلسات الخارجية', 'Outdoor seating'], order: [['Spanish latte', 3], ['San Sebastián cheesecake', 2]] },
  { at: [16, 0], ppl: 1, kind: 'help', tag: ['برمجة', 'Coding'] },
  { at: [16, 15], ppl: 1, kind: 'visit', tag: ['استرخاء', 'Chilling'], order: [['Spanish latte', 1]] },
  { at: [16, 30], ppl: 2, kind: 'visit', tag: ['مذاكرة', 'Studying'], seat: ['منطقة الهدوء', 'Quiet area'] },
  { at: [17, 30], ppl: 1, kind: 'visit', tag: ['طلب سريع', 'Grab and go'], order: [['Cold brew', 1]] },
  { at: [18, 0], ppl: 1, kind: 'need', tag: ['تسويق وإعلانات', 'Marketing and ads'] },
  { at: [19, 30], ppl: 2, kind: 'visit', tag: ['استرخاء', 'Chilling'], seat: ['عند النافذة', 'By the window'], order: [['Lotus cheesecake', 2], ['Iced latte', 2]] },
  { at: [21, 0], ppl: 1, kind: 'visit', tag: ['عمل', 'Work'], order: [['Matcha latte', 1]] },
]

const TOP = [['Spanish latte', 64], ['San Sebastián cheesecake', 41], ['Butter croissant', 33], ['Iced latte', 25]] as const

// «قارن بنفسك»: the owner picks the measures and what to compare them across: two periods, or branches.
const MEASURES: Metric[] = ['revenue', 'visits', 'orders', 'avgOrder', 'newCust', 'returnRate', 'bookings', 'meetups', 'stay', 'lost']
// A measure for one branch over any range of days. Totals follow the number of days; a range further in the past
// is lower by the usual growth for a period that long, so «last week» against «this week» matches the comparison cards.
const bucketOf = (days: number): Period => (days <= 1 ? 'day' : days <= 14 ? 'week' : 'month')
export function measure(m: Metric, scale: number, r: Range) {
  const w = weekFor(scale), days = rangeDays(r), k = (days / 7) * scale
  const now = m === 'revenue' ? w.revenue * k : m === 'visits' ? w.visits * k : m === 'orders' ? w.orders * k : m === 'avgOrder' ? w.avgOrder
    : m === 'newCust' ? w.visits * w.newShare * k : m === 'returnRate' ? w.returnRate : m === 'bookings' ? w.bookings * k : m === 'meetups' ? w.meetups * k
    : m === 'stay' ? w.stayMin : w.lostTries * k
  const c = CHANGE[m][bucketOf(days)], steps = Math.min(6, rangeAgo(r) / days)
  return Math.max(0, Math.round(m === 'returnRate' ? now - c * steps : now / (1 + c / 100) ** steps))
}

function CompareBuilder({ branch, peers }: { branch?: Branch; peers: Branch[] }) {
  const { t, sar, lang } = useT()
  const multi = peers.length > 1
  const [mode, setMode] = useState<'time' | 'branches'>('time')
  const [picked, setPicked] = useState<Metric[]>(['revenue', 'orders', 'returnRate'])
  const [spans, setSpans] = useState<[Range, Range]>(() => { const w = presetRange('week'); return [w, prevRange(w)] })
  const [span, setSpan] = useState<Range>(() => presetRange('week'))
  const { rangeName } = useRangeText()
  const [shown, setShown] = useState<string[]>(() => peers.map(b => b.id))
  const fmt = (x: number) => x.toLocaleString('en-US')
  const label = (m: Metric) => ({
    revenue: t('الدخل', 'Revenue'), visits: t('الزيارات', 'Visits'), orders: t('الطلبات', 'Orders'), avgOrder: t('متوسط الطلب', 'Average order'),
    newCust: t('عملاء جدد', 'New customers'), returnRate: t('نسبة العودة', 'Return rate'), bookings: t('الحجوزات', 'Bookings'), meetups: t('اللقاءات', 'Meetups'),
    stay: t('متوسط الجلسة', 'Average stay'), lost: t('طلبات فاتتك', 'Missed orders'),
  })[m]
  const show = (m: Metric, x: number) => m === 'revenue' || m === 'avgOrder' ? sar(fmt(x)) : m === 'returnRate' ? `${x}%` : m === 'stay' ? `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}` : fmt(x)
  const val = (m: Metric, b: Branch, r: Range) => measure(m, b.scale, r)
  const branchLabel = (b: Branch) => (lang === 'ar' ? b.area[0] : b.area[1])
  const toggle = <X,>(list: X[], x: X) => (list.includes(x) ? (list.length > 1 ? list.filter(y => y !== x) : list) : [...list, x])
  const daysOf = rangeDays
  // A week against a month: totals are shown per day so the comparison stays fair. Averages and rates already are.
  const uneven = (mode === 'time' || !multi) && daysOf(spans[0]) !== daysOf(spans[1])
  const RATES: Metric[] = ['avgOrder', 'returnRate', 'stay']
  const byBranch = mode === 'branches' && multi

  // Columns: two periods for this branch, or the chosen branches over one period.
  const cols = mode === 'time' || !multi
    ? spans.map((s, i) => ({ key: `${i}`, name: rangeName(s), get: (m: Metric) => (!branch ? 0 : uneven && !RATES.includes(m) ? Math.round(val(m, branch, s) / daysOf(s)) : val(m, branch, s)) }))
    : peers.filter(b => shown.includes(b.id)).map(b => ({ key: b.id, name: branchLabel(b), get: (m: Metric) => val(m, b, span) }))

  return (
    <section className="o-card o-builder">
      <h3><SlidersHorizontal />{t('قارن بنفسك', 'Compare it yourself')}</h3>
      <p className="o-card-sub">{t('اختر المؤشرات وما تريد مقارنته', 'Pick the measures and what to compare')}</p>

      {multi && (
        <div className="o-period o-builder-mode" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'time'} className={mode === 'time' ? 'active' : ''} onClick={() => setMode('time')}>{t('فترتان', 'Two periods')}</button>
          <button type="button" role="tab" aria-selected={mode === 'branches'} className={mode === 'branches' ? 'active' : ''} onClick={() => setMode('branches')}>{t('الفروع', 'Branches')}</button>
        </div>
      )}

      <span className="o-label">{t('المؤشرات', 'Measures')}</span>
      <div className="o-chips wrap">
        {MEASURES.map(m => <button key={m} type="button" aria-pressed={picked.includes(m)} className={`o-chip ${picked.includes(m) ? 'active' : ''}`} onClick={() => setPicked(p => toggle(p, m))}>{picked.includes(m) && <Check />}{label(m)}</button>)}
      </div>

      {mode === 'time' || !multi ? (
        <div className="o-builder-spans">
          {([0, 1] as const).map(i => (
            <div key={i}>
              <span className="o-label">{i === 0 ? t('الفترة الأولى', 'First period') : t('قارنها بـ', 'Compare with')}</span>
              <RangePicker compact value={spans[i]} label={i === 0 ? t('الفترة الأولى', 'First period') : t('قارنها بـ', 'Compare with')} onChange={v => setSpans(s => (i === 0 ? [v, s[1]] : [s[0], v]))} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <span className="o-label">{t('الفروع', 'Branches')}</span>
          <div className="o-chips wrap">
            {peers.map(b => <button key={b.id} type="button" aria-pressed={shown.includes(b.id)} className={`o-chip ${shown.includes(b.id) ? 'active' : ''}`} onClick={() => setShown(l => toggle(l, b.id))}>{shown.includes(b.id) && <Check />}{branchLabel(b)}</button>)}
          </div>
          <span className="o-label">{t('الفترة', 'Period')}</span>
          <RangePicker value={span} onChange={setSpan} />
        </>
      )}

      {!byBranch && samePeriod(spans[0], spans[1]) && <p className="o-note"><Lightbulb />{t('اختر فترتين مختلفتين للمقارنة.', 'Pick two different periods to compare.')}</p>}
      {uneven && <p className="o-note o-note-soft"><Lightbulb />{t('الفترتان بطول مختلف، لذا نعرض المجاميع كمعدل يومي.', 'The periods differ in length, so totals are shown per day.')}</p>}

      <div className="o-builder-out">
        {MEASURES.filter(m => picked.includes(m)).map(m => {
          const vals = cols.map(c => c.get(m))
          const lower = m === 'lost'
          const best = lower ? Math.min(...vals) : Math.max(...vals)
          const max = Math.max(1, ...vals)
          const diff = cols.length === 2 && vals[1] ? Math.round(((vals[0] - vals[1]) / vals[1]) * 100) : null
          const good = diff !== null && (lower ? diff < 0 : diff > 0)
          return (
            <div key={m} className="o-builder-row">
              <header>
                <b>{label(m)}{uneven && !RATES.includes(m) && <small>{t(' · في اليوم', ' · per day')}</small>}</b>
                {byBranch && cols.length > 1 && (() => {
                  // Branches: name the leader and how far ahead it is of the next one.
                  const order = vals.map((v, i) => ({ v, i })).sort((a, b) => (lower ? a.v - b.v : b.v - a.v))
                  const [a, b] = order
                  const gap = m === 'returnRate' ? t(`${Math.abs(a.v - b.v)} نقاط`, `${Math.abs(a.v - b.v)} pts`) : b.v ? `${Math.abs(Math.round(((a.v - b.v) / b.v) * 100))}%` : ''
                  return a.v === b.v ? <em>{t('متساويان', 'Tied')}</em> : <em className="good">{t(`${cols[a.i].name} ${lower ? 'أقل' : 'أعلى'} بـ \u2068${gap}\u2069`, `${cols[a.i].name} ${lower ? 'lower' : 'ahead'} by ${gap}`)}</em>
                })()}
                {!byBranch && diff !== null && diff !== 0 && <em className={good ? 'good' : 'bad'}>{diff > 0 ? <ArrowUp /> : <ArrowDown />}{m === 'returnRate' ? t(`${Math.abs(vals[0] - vals[1])} نقاط`, `${Math.abs(vals[0] - vals[1])} pts`) : `${Math.abs(diff)}%`}</em>}
                {!byBranch && diff === 0 && <em>{t('بلا تغيير', 'No change')}</em>}
              </header>
              <ul className="o-top-items">
                {cols.map((c, i) => (
                  <li key={c.key} className={vals[i] === best && cols.length > 1 ? 'lead' : ''}>
                    <span className="o-top-name">{c.name}</span>
                    <span className="o-top-bar"><i style={{ width: `${(vals[i] / max) * 100}%` }} /></span>
                    <b>{show(m, vals[i])}</b>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function Insights({ items, branch, peers = [] }: { items: Item[]; branch?: Branch; peers?: Branch[] }) {
  const scale = branch?.scale ?? 1
  const W = weekFor(scale)
  const { t, tx, sar, lang } = useT()
  const [range, setRange] = useState<Range>(() => presetRange('week'))
  const { rangeText } = useRangeText()
  const days = rangeDays(range), prev = prevRange(range)
  const [hover, setHover] = useState<number | null>(null)
  const pick = (x: T2) => (lang === 'ar' ? x[0] : x[1])
  const M = (m: Metric, r: Range = range) => measure(m, scale, r)
  // Counts that aren't modelled one by one (hours, items) follow orders for the chosen range.
  const k = M('orders') / W.orders
  const n = (x: number) => Math.max(1, Math.round(x * k))
  const fmt = (x: number) => x.toLocaleString('en-US')

  const visits = M('visits')
  const orders = M('orders')
  const savedMin = Math.round(orders * 3.3)
  const savedH = Math.round(savedMin / 60)
  const saved = savedMin < 120 ? t(`${savedMin} دقيقة`, `${savedMin} min`) : t(`${savedH} ${savedH <= 10 ? 'ساعات' : 'ساعة'}`, `${savedH} hours`)
  const hourly = HOURS.map(v => Math.round(v * k))
  const max = Math.max(...hourly, 1)
  const quietShare = Math.round((QUIET.reduce((a, h) => a + HOURS[h - FIRST_HOUR], 0) / HOURS.reduce((a, b) => a + b, 0)) * 100)
  const hourLabel = (h: number) => (lang === 'ar' ? `${h % 12 || 12} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`)
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  const lost = items.find(i => i.soldOut) ?? items.find(i => i.name.en === 'Lotus cheesecake') ?? items[0]
  const lostTries = M('lost')
  const top = TOP.map(([en, c], i) => ({ item: items.find(x => x.name.en === en) ?? items[i], c: n(c) })).filter(x => x.item)
  const topMax = Math.max(...top.map(x => x.c), 1)

  const stayText = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`

  // Against the previous period: what it is now, what it was, and whether that's better.
  const pct = (x: number) => `${Math.abs(x)}%`
  const cmp: [Metric, string, (x: number) => string][] = [
    ['revenue', t('الدخل', 'Revenue'), x => sar(fmt(x))],
    ['visits', t('الزيارات', 'Visits'), fmt],
    ['orders', t('الطلبات', 'Orders'), fmt],
    ['avgOrder', t('متوسط الطلب', 'Average order'), x => sar(x)],
    ['newCust', t('عملاء جدد', 'New customers'), fmt],
    ['returnRate', t('نسبة العودة', 'Return rate'), x => `${x}%`],
    ['bookings', t('حجوزات الطاولات', 'Table bookings'), fmt],
    ['meetups', t('اللقاءات', 'Meetups'), fmt],
    ['stay', t('متوسط الجلسة', 'Average stay'), stayText],
    ['lost', t('طلبات فاتتك', 'Missed orders'), fmt],
  ]
  const rows = cmp.map(([key, label, show]) => {
    const now = M(key), before = M(key, prev)
    const c = key === 'returnRate' ? now - before : before ? Math.round(((now - before) / before) * 100) : 0
    const lower = LOWER_IS_BETTER.includes(key)
    return { key, label, now: show(now), before: show(before), up: c > 0, flat: c === 0, good: lower ? c < 0 : c > 0, delta: key === 'returnRate' ? t(`${Math.abs(c)} نقاط`, `${Math.abs(c)} pts`) : pct(c), c: lower ? -c : c }
  })
  const revChange = rows[0].c
  const better = rows.slice(1).filter(r => r.good).length
  const best = [...rows].filter(r => r.key !== 'returnRate').sort((a, b) => b.c - a.c)[0]
  const worst = [...rows].filter(r => !r.good).sort((a, b) => a.c - b.c)[0]

  // Against the other branches, same period. Higher is better in every row.
  const peerCols = [...peers].sort((a, b) => (a.id === branch?.id ? -1 : b.id === branch?.id ? 1 : 0)).map(b => ({ b }))
  const peerDefs: [Metric, string, (x: number) => string][] = [
    ['revenue', t('الدخل', 'Revenue'), x => sar(fmt(x))],
    ['orders', t('الطلبات', 'Orders'), fmt],
    ['avgOrder', t('متوسط الطلب', 'Average order'), x => sar(x)],
    ['newCust', t('عملاء جدد', 'New customers'), fmt],
    ['returnRate', t('نسبة العودة', 'Return rate'), x => `${x}%`],
    ['bookings', t('الحجوزات', 'Bookings'), fmt],
    ['meetups', t('اللقاءات', 'Meetups'), fmt],
    ['stay', t('متوسط الجلسة', 'Average stay'), stayText],
  ]
  const peerRows = peerDefs.map(([key, label, show]) => {
    const vals = peerCols.map(c => measure(key, c.b.scale, range))
    return { key, label, vals, show, bestIdx: vals.indexOf(Math.max(...vals)) }
  })
  const branchName = branch ? t(`فرع ${branch.area[0]}`, `The ${branch.area[1]} branch`) : ''
  const firsts = peerRows.filter(r => r.bestIdx === 0).length
  const leaderIdx = peerCols.map((_, i) => peerRows.filter(r => r.bestIdx === i).length).reduce((m, c, i, a) => (c > a[m] ? i : m), 0)
  const leads = peerRows.filter(r => r.bestIdx === leaderIdx).length
  // One practical pointer: where this branch trails the leader on a habit (not size), and by how much.
  const lag = peerRows.filter(r => ['avgOrder', 'returnRate'].includes(r.key) && r.bestIdx !== 0)
    .map(r => ({ r, lead: peerCols[r.bestIdx].b })).at(0)
  const gap = lag ? (lag.r.key === 'avgOrder'
    ? t(`متوسط الطلب في فرع ${lag.lead.area[0]} أعلى بـ ${sar(lag.r.vals[lag.r.bestIdx] - lag.r.vals[0])}. جرّب اقتراح حلى مع القهوة كما يفعلون.`, `Orders at ${lag.lead.area[1]} average ${sar(lag.r.vals[lag.r.bestIdx] - lag.r.vals[0])} more. Try suggesting a dessert with coffee like they do.`)
    : t(`فرع ${lag.lead.area[0]} يعيد ${lag.r.vals[lag.r.bestIdx] - lag.r.vals[0]} نقاط أكثر من عملائه. أرسل عروض العودة من صفحة العروض.`, `${lag.lead.area[1]} brings back ${lag.r.vals[lag.r.bestIdx] - lag.r.vals[0]} points more of its customers. Send come-back offers from the Offers page.`)) : null

  return (
    <div className="o-insights">
      <RangePicker value={range} onChange={setRange} />

      <div className="o-hero-stat">
        <small>{t('دخل جاءك من AroundMe', 'Revenue AroundMe brought you')}</small>
        <b>{sar(fmt(M('revenue')))}</b>
        <span><em>{revChange < 0 ? <ArrowDown /> : <TrendingUp />}{Math.abs(revChange)}%</em>{t(`من ${fmt(visits)} زيارة · ${fmt(orders)} طلب`, `from ${fmt(visits)} visits · ${fmt(orders)} orders`)}</span>
      </div>

      <section className="o-card o-kpi-card">
        <h3>{t(days === 1 ? 'مقارنة باليوم السابق' : 'مقارنة بالفترة السابقة', days === 1 ? 'Compared with the day before' : 'Compared with the previous period')}</h3>
        <p className="o-card-sub">{t(`${rangeText(prev)} · تحسّن ${better} من ${rows.length - 1} مؤشرات`, `${rangeText(prev)} · ${better} of ${rows.length - 1} measures improved`)}</p>
        <div className="o-kpi-grid">
          {rows.slice(1).map(r => (
            <div key={r.key} className="o-kpi">
              <span>{r.label}</span>
              <b>{r.now}</b>
              <small>{r.flat ? <em className="flat">{t('بلا تغيير', 'No change')}</em> : <em className={r.good ? 'good' : 'bad'}>{r.up ? <ArrowUp /> : <ArrowDown />}{r.delta}</em>}{t(`كان \u2068${r.before}\u2069`, `was ${r.before}`)}</small>
            </div>
          ))}
          <div className="o-kpi">
            <span>{t('وفّرنا على الكاشير', 'Saved at the counter')}</span>
            <b>{saved}</b>
            <small>{t(`${fmt(orders)} طلب مدفوع قبل الوصول`, `${fmt(orders)} orders paid ahead`)}</small>
          </div>
        </div>
        {best && <p className="o-note"><TrendingUp />{t(`أكبر تحسّن: ${best.label} (${best.delta}).${worst ? ` راقب ${worst.label}.` : ''}`, `Biggest gain: ${best.label} (${best.delta}).${worst ? ` Keep an eye on ${worst.label.toLowerCase()}.` : ''}`)}</p>}
      </section>

      {lost && (
        <section className="o-card o-lost">
          <h3>{t('طلبات فاتتك', 'Orders you missed')}</h3>
          <p>{t(`${fmt(lostTries)} حاولوا طلب «${tx(lost.name)}» بعد نفاده، بقيمة تقارب ${sar(lostTries * (lost.price ?? 20))}.`, `${fmt(lostTries)} people tried to order “${tx(lost.name)}” while it was sold out, about ${sar(lostTries * (lost.price ?? 20))}.`)}</p>
          <small>{t('فعّله من المنيو فور تجهيزه.', 'Turn it back on in the menu as soon as it is ready.')}</small>
        </section>
      )}

      {peers.length > 1 && branch && (
        <section className="o-card o-compare">
          <h3>{t('مقارنة بفروعك الأخرى', 'Compared with your other branches')}</h3>
          <p className="o-card-sub">{t(`الأفضل في كل مؤشر بالأخضر · ${rangeText(range)}`, `Best in each row in green · ${rangeText(range)}`)}</p>
          <div className="o-cmp-table-wrap">
            <table className="o-cmp-table">
              <thead><tr><th />{peerCols.map(c => <th key={c.b.id} className={c.b.id === branch.id ? 'me' : ''}>{pick(c.b.area)}</th>)}</tr></thead>
              <tbody>
                {peerRows.map(r => (
                  <tr key={r.key}>
                    <th>{r.label}</th>
                    {r.vals.map((v, i) => <td key={peerCols[i].b.id} className={`${peerCols[i].b.id === branch.id ? 'me' : ''} ${i === r.bestIdx ? 'best' : ''}`}>{r.show(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="o-cmp-rank">{firsts ? t(`${branchName} الأول في ${firsts} من ${peerRows.length} مؤشرات`, `${branchName} leads in ${firsts} of ${peerRows.length} measures`) : t(`فرع ${peerCols[leaderIdx].b.area[0]} الأول في ${leads} من ${peerRows.length} مؤشرات`, `${peerCols[leaderIdx].b.area[1]} leads in ${leads} of ${peerRows.length} measures`)}</p>
          {gap && <p className="o-note"><Lightbulb />{gap}</p>}
        </section>
      )}

      <CompareBuilder branch={branch} peers={peers} />

      <section className="o-card o-customers">
        <h3>{t('من هم عملاؤك', 'Who your customers are')}</h3>
        <p className="o-card-sub">{t('من المهارات والاحتياجات التي كتبوها في AroundMe', 'From the skills and needs they shared on AroundMe')}</p>
        <div className="o-people">
          {PEOPLE.map(([l, v]) => <div key={l[1]}><b>{v}%</b><small>{pick(l)}</small></div>)}
        </div>
        <div className="o-skill-needs">
        <div>
        <h4 className="o-sub-h">{t('يستطيعون المساعدة في', 'They can help with')}</h4>
        <ul className="o-top-items">
          {SKILLS.map(([l, v]) => <li key={l[1]}><span className="o-top-name">{pick(l)}</span><span className="o-top-bar"><i style={{ width: `${(v / SKILLS[0][1]) * 100}%` }} /></span><b>{v}%</b></li>)}
        </ul>
        </div>
        <div>
        <h4 className="o-sub-h">{t('يأتون لطلب المساعدة في', 'They come needing help with')}</h4>
        <ul className="o-top-items needs">
          {NEEDS.map(([l, v]) => <li key={l[1]}><span className="o-top-name">{pick(l)}</span><span className="o-top-bar"><i style={{ width: `${(v / NEEDS[0][1]) * 100}%` }} /></span><b>{v}%</b></li>)}
        </ul>
        </div>
        </div>
        <p className="o-note"><Lightbulb />{t('أصبح كافيهك مكانًا للمبرمجين والمصممين ورواد الأعمال. فكّر في ركن هادئ بمقابس كهرباء، أو باقة «جلسة عمل» تضم القهوة والمعجنات بسعر واحد.', 'Your café has become a spot for developers, designers and founders. Think about a quiet corner with sockets, or a “work session” bundle of coffee and a pastry at one price.')}</p>
      </section>

      <section className="o-card">
        <h3>{t('متى يأتيك عملاء AroundMe', 'When AroundMe customers come')}</h3>
        <p className="o-card-sub">{t(`${quietShare}% من زياراتهم في وقتك الهادئ، بين 1 و5 عصرًا`, `${quietShare}% of their visits land in your quiet hours, 1 to 5pm`)}</p>
        <div className="o-hours" dir="ltr" onMouseLeave={() => setHover(null)}>
          {hourly.map((v, i) => {
            const h = FIRST_HOUR + i
            return (
              <button key={h} type="button" className={`o-hour ${QUIET.includes(h) ? 'quiet' : ''} ${hover === i ? 'on' : ''}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)} aria-label={t(`${hourLabel(h)}: ${v} زيارة`, `${hourLabel(h)}: ${v} visits`)}>
                <i style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
                {hover === i && <span className="o-tip" dir={dir}>{hourLabel(h)} · {t(`${v} زيارة`, `${v} visits`)}</span>}
              </button>
            )
          })}
        </div>
        <div className="o-hours-axis" dir="ltr">{[7, 11, 15, 19, 23].map(h => <span key={h} dir={dir}>{hourLabel(h)}</span>)}</div>
        <p className="o-legend"><span className="o-quiet-swatch" />{t('وقتك الهادئ', 'Your quiet hours')}</p>
      </section>

      {top.length > 0 && (
        <section className="o-card">
          <h3>{t('الأكثر طلبًا من AroundMe', 'Most ordered on AroundMe')}</h3>
          <ul className="o-top-items">
            {top.map(({ item, c }) => (
              <li key={item.id}>
                <span className="o-top-name">{tx(item.name)}</span>
                <span className="o-top-bar"><i style={{ width: `${(c / topMax) * 100}%` }} /></span>
                <b>{fmt(c)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  )
}

// Meetups at the café, as their own dashboard section: what kind of help happened, and a come-back offer for pairs who plan to meet here again.
// Sample meetup patterns for a branch: what people meet about, when, where, and how meetup visitors compare with everyone else.
const MEET_TIMES: [T2, number][] = [[['الصباح', 'Morning'], 12], [['الظهر', 'Midday'], 18], [['العصر', 'Afternoon'], 41], [['المساء', 'Evening'], 29]]
// Meetup visitors against everyone else: [meetup, others].
const MEET_VS = { stay: [134, 96], orders: [2.1, 1.3], back: [61, 42] }

// Meetup ideas the owner turned on, per branch (kept while the dashboard is open).
const meetPlays: Record<string, { bundle?: Bundle; perk?: Perk }> = {}

export function Meetups({ ops, notify, items, cafe }: { ops: Ops; notify: (s: string) => void; items: Item[]; cafe: string }) {
  const { t, lang, sar: sar0 } = useT()
  const can = useCan()
  const sar = (x: number) => sar0(x.toLocaleString('en-US'))
  const [offerFor, setOfferFor] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'again'>('all')
  const [range, setRange] = useState<Range>(() => presetRange('week'))
  const pick = (x: T2) => (lang === 'ar' ? x[0] : x[1])
  const loc = lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-US'
  const dayMonth = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'long' })
  const daysAgo = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d }
  const clock = (h: number, m: number) => lang === 'ar' ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
  const an = (x: string) => `${/^[aeio]|^u(?!ni)/i.test(x) ? 'An' : 'A'} ${x.toLowerCase()}`
  // Only meetups inside the chosen period.
  const mine = MEETUPS.map((m, i) => ({ m, i })).filter(({ m, i }) => ops.branch.meetups.includes(i) && inRange(range, daysAgo(m.when[0]).getTime()))
  const again = mine.filter(({ m }) => m.again)
  const todo = again.filter(({ i }) => !ops.offers[`M${i}`])
  const shown = filter === 'again' ? again : mine
  const w = weekFor(ops.branch.scale)
  const count = measure('meetups', ops.branch.scale, range)
  const before = measure('meetups', ops.branch.scale, prevRange(range))
  const change = before ? Math.round(((count - before) / before) * 100) : 0
  const perMeet = Math.round((mine.length ? mine.reduce((a, { m }) => a + m.ordered, 0) / mine.length : 2) * w.avgOrder)
  const days = rangeDays(range)
  const weekly = (n: number) => Math.round((n / days) * 7)
  const topTime = [...MEET_TIMES].sort((x, y) => y[1] - x[1])[0]
  // What meetups bring in, from the sample shares: two people per meetup, 44% of them new to the café, 61% back within two weeks.
  const meetRev = count * perMeet
  const people = count * 2
  const newPeople = Math.round(people * 0.44)
  const backVisits = Math.round(people * (MEET_VS.back[0] / 100))
  const quietRev = Math.round(meetRev * (topTime[1] / 100))
  const tv = visitsFor(ops.branch.scale)
  const tmr = { need: tv.filter(v => v.kind === 'need').length, help: tv.filter(v => v.kind === 'help').length }
  const Fwd = lang === 'ar' ? ChevronLeft : ChevronRight
  const live = meetPlays[ops.branch.id] ?? (meetPlays[ops.branch.id] = {})
  const [, bump] = useState(0)
  const [growing, setGrowing] = useState(false)
  const [gRange, setGRange] = useState<Range>(() => presetRange('week'))
  const [gq, setGq] = useState('')
  const { rangeName } = useRangeText()
  const [gMore, setGMore] = useState(false)
  const [gTarget, setGTarget] = useState<{ id: string; name: T2; sub: T2; n: number; back: number; pair: boolean } | null>(null)
  const [editing, setEditing] = useState<'bundle' | 'perk' | null>(null)
  const tiles: [typeof Clock, string, string, string][] = [
    [Sparkles, t('عملاء جدد', 'New customers'), String(newPeople), t('زاروا كافيهك أول مرة من أجل لقاء', 'visited your café for the first time for a meetup')],
    [Repeat, t('زيارات عودة', 'Return visits'), String(backVisits), t(`عادوا خلال أسبوعين · نحو ${sar(backVisits * w.avgOrder)}`, `came back within two weeks · about ${sar(backVisits * w.avgOrder)}`)],
    [Clock, t('دخل في وقتك الهادئ', 'Quiet-hours sales'), sar(quietRev), t(`\u2066${topTime[1]}%\u2069 من اللقاءات بين 1 و5 عصرًا`, `${topTime[1]}% of meetups land between 1 and 5pm`)],
    [ShoppingBag, t('طلبات أكثر', 'Bigger orders'), `⁦+${Math.round(((MEET_VS.orders[0] - MEET_VS.orders[1]) / MEET_VS.orders[1]) * 100)}%⁩`, t(`${MEET_VS.orders[0]} طلب في الزيارة مقابل ${MEET_VS.orders[1]} لباقي العملاء`, `${MEET_VS.orders[0]} orders a visit vs ${MEET_VS.orders[1]} for other customers`)],
  ]
  // Ways to earn more from meetups, each with a rough weekly gain.
  const perkGain = Math.max(1, weekly(count * 0.15)) * (perMeet - (live.perk?.cap ?? 20))
  const bundleGain = weekly(count * 0.3) * 12
  const ideas = [
    { k: 'perk' as const, icon: HeartHandshake, on: !!live.perk, gain: perkGain,
      title: t('كافئ من يساعد بمشروب مجاني', 'Give helpers a free drink'),
      sub: live.perk ? t(`مفعّلة · مشروب حتى ${sar(live.perk.cap)}`, `On · a drink up to ${sar(live.perk.cap)}`) : t(`غدًا ${tmr.need} يحتاجون مساعدة و${tmr.help} فقط يستطيعون · نحو +${sar(perkGain)} أسبوعيًا`, `Tomorrow ${tmr.need} need help, only ${tmr.help} can help · about +${sar(perkGain)} a week`) },
    { k: 'bundle' as const, icon: Coffee, on: !!live.bundle, gain: bundleGain,
      title: live.bundle?.name || t('أضف «باقة جلسة عمل»', 'Add a “work session” bundle'),
      sub: live.bundle ? t(`مفعّلة · ${sar(live.bundle.price)} بدل ${sar(bundleFull(live.bundle, items))}`, `On · ${sar(live.bundle.price)} instead of ${sar(bundleFull(live.bundle, items))}`) : t(`يجلسون ${MEET_VS.stay[0]} دقيقة في المتوسط · نحو +${sar(bundleGain)} أسبوعيًا`, `They stay ${MEET_VS.stay[0]} min on average · about +${sar(bundleGain)} a week`) },
  ]
  const openIdeas = ideas.filter(x => !x.on)
  // Ready-made groups of people who met here, for one offer each (sample shares of the period's meetups).
  const gCount = measure('meetups', ops.branch.scale, gRange)
  const sentMeet = Object.values(ops.offers).filter(o => o.group && o.src === 'meet' && o.sentAt && inRange(gRange, o.sentAt)).reduce((x, o) => x + (o.group ?? 0), 0)
  const groups: { id: string; icon: typeof Clock; name: T2; sub: T2; n: number; back: number; pair: boolean }[] = [
    { id: 'again', icon: MessageCircleHeart, pair: true, back: 0.45, n: Math.round(gCount * 0.33) * 2, name: ['اتفقوا على اللقاء مجددًا', 'Plan to meet again'], sub: ['عرض يضمن أن يعودوا إلى كافيهك لا إلى غيره', 'An offer makes sure they come back to you'] },
    { id: 'first', icon: UserPlus, pair: false, back: 0.25, n: Math.round(gCount * 2 * 0.44), name: ['زاروا كافيهك أول مرة للقاء', 'First visit was for a meetup'], sub: ['عملاء جدد جاؤوا بسبب لقاء', 'New customers who came for a meetup'] },
    { id: 'helpers', icon: HeartHandshake, pair: false, back: 0.3, n: gCount, name: ['من ساعدوا غيرهم', 'People who helped someone'], sub: ['شكر صغير يجعلهم يختارون كافيهك في اللقاء القادم', 'A small thank-you makes them pick you next time'] },
    { id: 'all', icon: Users, pair: false, back: 0.2, n: Math.max(0, gCount * 2 - sentMeet), name: ['كل من التقوا في الفترة', 'Everyone who met here'], sub: ['عدا من لديه عرض لم ينتهِ', 'Except those with an active offer'] },
  ]
  const weekAgain = Math.round(measure('meetups', ops.branch.scale, presetRange('week')) * 0.33)
  const potential = openIdeas.reduce((x, p) => x + p.gain, 0) + Math.round(weekAgain * 0.45) * perMeet
  const gFound = todo.filter(({ m }) => !gq.trim() || `${m.topic[0]} ${m.topic[1]}`.toLowerCase().includes(gq.trim().toLowerCase()))
  const fmtN = (n: number) => n.toLocaleString('en-US')
  return (
    <div className="o-meetups-page">
      <RangePicker value={range} onChange={setRange} />

      <div className="o-hero-stat o-mt-hero">
        <small>{t('دخل جاءك من اللقاءات', 'Revenue from meetups')}</small>
        <b>{sar(meetRev)}</b>
        <span>{change !== 0 && <em>{change < 0 ? <ArrowDown /> : <TrendingUp />}{Math.abs(change)}%</em>}{t(`${count} لقاء · ${people} عميل · ${sar(perMeet)} لكل لقاء`, `${count} meetups · ${people} customers · ${sar(perMeet)} per meetup`)}</span>
      </div>

      <div className="o-mt-tiles">
        {tiles.map(([Icon, label, val, sub]) => (
          <div key={label}><span><Icon />{label}</span><b>{val}</b><small>{sub}</small></div>
        ))}
      </div>

      {can('meetups.act') && <div className="o-offer-new o-grow">
        <span className="o-offer-new-icon"><TrendingUp /></span>
        <div>
          <b>{t('زِد دخلك', 'Earn more')}</b>
          <small>{t(`${fmtN(weekAgain * 2)} شخص اتفقوا على العودة في آخر 7 أيام · نحو +${sar(potential)} في الأسبوع`, `${fmtN(weekAgain * 2)} people plan to come back (last 7 days) · about +${sar(potential)} a week`)}</small>
        </div>
        <button type="button" className="o-offer-new-btn" onClick={() => setGrowing(true)}><Sparkles />{t('اعرض الفرص', 'See ideas')}</button>
      </div>}

      <div className="o-meet-head">
        <h3>{t('سجل اللقاءات', 'Meetup log')}</h3>
        <div className="o-chips wrap">
          {([['all', t(`الكل · ${mine.length}`, `All · ${mine.length}`)], ['again', t(`سيلتقون مجددًا · ${again.length}`, `Meeting again · ${again.length}`)]] as const).map(([k, l]) => (
            <button key={k} type="button" className={`o-chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <p className="o-empty">{t('لا توجد لقاءات في هذه الفترة. جرّب فترة أطول.', 'No meetups in this period. Try a longer one.')}</p>}
      {shown.length > 0 && (
        <div className="o-mlog">
          <div className="o-mlog-head" aria-hidden>
            <span>{t('الوقت', 'Time')}</span><span>{t('اللقاء', 'Meetup')}</span><span>{t('المكان', 'Spot')}</span><span>{t('المدة', 'Length')}</span><span>{t('الإنفاق', 'Spend')}</span><span>{t('العودة', 'Coming back')}</span>
          </div>
          {[...new Set(shown.map(({ m }) => m.when[0]))].map(ago => {
            const day = shown.filter(({ m }) => m.when[0] === ago)
            const spend = day.reduce((x, { m }) => x + m.ordered * w.avgOrder, 0)
            const d = daysAgo(ago)
            return (
              <section key={ago} className="o-mlog-day">
                <h4><b>{ago === 0 ? t('اليوم', 'Today') : ago === 1 ? t('أمس', 'Yesterday') : d.toLocaleDateString(loc, { weekday: 'long' })}</b><span>{dayMonth(d)}</span><small>{t(`${day.length === 1 ? 'لقاء واحد' : day.length === 2 ? 'لقاءان' : `${day.length} لقاءات`} · ${sar(spend)}`, `${day.length} meetup${day.length === 1 ? '' : 's'} · ${sar(spend)}`)}</small></h4>
                {day.map(({ m, i }) => {
                  const offer = ops.offers[`M${i}`]
                  return (
                    <div key={i} className="o-mlog-row">
                      <span className="o-mlog-time">{clock(m.when[1], m.when[2])}</span>
                      <span className="o-mlog-main"><b>{pick(m.topic)}</b><small>{t(`${pick(m.helper)} ${m.f ? 'ساعدت' : 'ساعد'} ${pick(m.helped)}`, `${an(pick(m.helper))} helped ${an(pick(m.helped)).toLowerCase()}`)}</small></span>
                      <span className="o-mlog-meta">
                        <span className="o-mlog-seat"><MapPin />{pick(m.seat)}</span>
                        <span className="o-mlog-mins"><Clock />{t(`${m.mins} د`, `${m.mins} min`)}</span>
                      </span>
                      <span className="o-mlog-spend"><b>{sar(m.ordered * w.avgOrder)}</b><small>{t(m.ordered === 1 ? 'طلب واحد' : m.ordered === 2 ? 'طلبان' : `${m.ordered} طلبات`, `${m.ordered} order${m.ordered === 1 ? '' : 's'}`)}</small></span>
                      <span className="o-mlog-status">
                        {!m.again ? <i className="none">{t('لم يتفقا', 'Not planned')}</i>
                          : offer?.usedAt ? <i className="used"><Check />{t('عادا بعرضك', 'Came back')}</i>
                          : offer ? <i className="sent"><Gift />{t('أُرسل عرض', 'Offer sent')}</i>
                          : !can('meetups.act') ? <i className="none">{t('بلا عرض', 'No offer')}</i>
                          : <button type="button" className="o-mlog-send" onClick={() => setOfferFor(i)}><Gift />{t('أرسل عرضًا', 'Send offer')}</button>}
                      </span>
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
      )}
      <p className="o-fine"><Lock />{t('لا نعرض الأسماء ولا الصور. يظهر لك موضوع اللقاء ووقته ومكانه فقط.', 'No names or photos. You only see what the meetup was about, when and where.')}</p>

      {growing && (
        <Sheet title={t('كيف تزيد دخلك؟', 'How to earn more?')} onClose={() => setGrowing(false)}>
          <p className="o-sheet-sub">{t('أرسل عرضًا واحدًا لمجموعة كاملة ممن التقوا هنا، أو فعّل فكرة تجذب لقاءات أكثر. لا يظهر لك أي اسم.', 'Send one offer to a whole group of people who met here, or turn on an idea that brings more meetups. You never see a name.')}</p>
          <RangePicker value={gRange} onChange={setGRange} label={t('لقاءات أي فترة؟', 'Meetups from when?')} />
          <section className="o-tm-group">
            <h4>{t('مجموعات جاهزة', 'Ready-made groups')}<small>{t(`${fmtN(gCount)} لقاء · ${rangeName(gRange)}`, `${fmtN(gCount)} meetups · ${rangeName(gRange)}`)}</small></h4>
            <div className="o-offer-pick">
              {groups.map(g => (
                <button key={g.id} type="button" disabled={!g.n} onClick={() => { setGrowing(false); setGTarget(g) }}>
                  <span className="o-offer-kind"><g.icon /></span>
                  <span><b>{pick(g.name)}</b><small>{pick(g.sub)} · {t(`يعود عادةً ⁦${Math.round(g.back * 100)}%⁩`, `usually ${Math.round(g.back * 100)}% come back`)}</small></span>
                  <em className="o-seg-n">{fmtN(g.n)}</em>
                  <Fwd />
                </button>
              ))}
            </div>
          </section>
          {([[false, t('أفكار لجذب لقاءات أكثر', 'Ideas to bring more meetups')], [true, t('مفعّلة', 'Turned on')]] as const).map(([on, title]) => {
            const xs = ideas.filter(x => x.on === on)
            return xs.length > 0 && (
              <section key={String(on)} className="o-tm-group">
                <h4>{title}<small>{xs.length}</small></h4>
                <div className="o-offer-pick">
                  {xs.map(x => (
                    <button key={x.k} type="button" className={x.on ? 'on' : ''} onClick={() => { setGrowing(false); setEditing(x.k) }}>
                      <span className="o-offer-kind"><x.icon /></span>
                      <span><b>{x.title}</b><small>{x.sub}</small></span>
                      {x.on ? <Check /> : <Fwd />}
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
          {todo.length > 0 && (
            <section className="o-tm-group">
              <h4>{t('أو لقاء بعينه', 'Or a single meetup')}<small>{t(`سيلتقون مجددًا · ${todo.length}`, `Meeting again · ${todo.length}`)}</small></h4>
              <label className="o-search"><Search /><input value={gq} onChange={e => setGq(e.target.value)} placeholder={t('ابحث بموضوع اللقاء', 'Search by what the meetup was about')} /></label>
              <div className="o-offer-pick">
                {(gMore || gq ? gFound : gFound.slice(0, 4)).map(({ m, i }) => (
                  <button key={i} type="button" onClick={() => { setGrowing(false); setOfferFor(i) }}>
                    <span className="o-offer-kind"><Gift /></span>
                    <span><b>{pick(m.topic)}</b><small>{t(`اتفقا على اللقاء هنا مرة أخرى · نحو +${sar(perMeet)}`, `Plan to meet here again · about +${sar(perMeet)}`)}</small></span>
                    <Fwd />
                  </button>
                ))}
                {!gFound.length && <p className="o-empty">{t('لا يوجد لقاء بهذا الموضوع.', 'No meetup matches.')}</p>}
                {!gq && !gMore && gFound.length > 4 && <button type="button" className="o-text-btn o-show-more" onClick={() => setGMore(true)}>{t(`اعرض الكل (${gFound.length})`, `Show all (${gFound.length})`)}</button>}
              </div>
            </section>
          )}
        </Sheet>
      )}
      {editing === 'bundle' && (
        <BundleSheet items={items} cafe={cafe} start={live.bundle ?? defaultBundle(items, t('باقة جلسة عمل', 'Work-session bundle'))} onClose={() => setEditing(null)}
          onSave={b => { live.bundle = b; setEditing(null); bump(x => x + 1); notify(t('فعّلنا الباقة، وستصل لمن يلتقون في كافيهك', 'Bundle is on. People meeting at your café will get it')) }} />
      )}
      {editing === 'perk' && (
        <PerkSheet start={live.perk ?? { cap: 20 }} onClose={() => setEditing(null)}
          onSave={p => { live.perk = p; setEditing(null); bump(x => x + 1); notify(t('فعّلنا المكافأة. سيرى المساعدون أن لهم مشروبًا مجانيًا في كافيهك', 'Perk is on. Helpers will see a free drink waiting at your café')) }} />
      )}
      {gTarget && (
        <OfferSheet pair={gTarget.pair} count={gTarget.n} onClose={() => setGTarget(null)}
          onSend={o => {
            ops.sendGroupOffer(`G-meet-${gTarget.id}-${Date.now()}`, { ...o, sentAt: Date.now(), src: 'meet', about: gTarget.name, group: gTarget.n, pair: gTarget.pair }, gTarget.back, w.avgOrder, n => notify(t(`عاد ${fmtN(n)} شخص بعرضك 🎁`, `${fmtN(n)} people came back with your offer 🎁`)))
            notify(t(`أرسلنا العرض إلى ${fmtN(gTarget.n)} شخص، وسيصلهم إشعار «افتح هديتك»`, `Offer sent to ${fmtN(gTarget.n)} people. They get an “Open your gift” notification`))
            setGTarget(null)
          }}
          about={<p className="o-offer-for"><Users /><span><b>{pick(gTarget.name)} · {t(`${fmtN(gTarget.n)} شخص`, `${fmtN(gTarget.n)} people`)}</b><small>{pick(gTarget.sub)}</small></span></p>} />
      )}
      {offerFor != null && (
        <OfferSheet pair onClose={() => setOfferFor(null)}
          onSend={o => { ops.setOffers(x => ({ ...x, [`M${offerFor}`]: { ...o, sentAt: Date.now(), src: 'meet', about: MEETUPS[offerFor].topic, pair: true } })); setOfferFor(null); notify(t('أرسلنا العرض إليهما، وسيصلهما إشعار «افتح هديتك»', 'Offer sent. They get an “Open your gift” notification')) }}
          about={<p className="o-offer-for"><MessageCircleHeart /><span><b>{pick(MEETUPS[offerFor].topic)}</b><small>{t('اتفقا على اللقاء في كافيهك مرة أخرى', 'They agreed to meet at your café again')}</small></span></p>} />
      )}
    </div>
  )
}
