import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Armchair, SlidersHorizontal, CalendarClock, Check, CalendarDays, ChevronLeft, ChevronRight, Clock, HeartHandshake, Lightbulb, Lock, MessageCircleHeart, Repeat, ShoppingBag, Sparkles, TrendingUp, UserPlus, Wallet, Zap } from 'lucide-react'
import { Sheet, useT } from './Owner'
import { OfferButton, OfferSent, OfferSheet } from './Offer'
import type { Branch, Ops } from './Ops'
import type { Item } from './data'

type Period = 'day' | 'week' | 'month'
// Sample numbers for a café's first weeks on AroundMe. A week is the base; a day and a month are scaled from it.
const SCALE: Record<Period, number> = { day: 1 / 7, week: 1, month: 4.3 }
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
type Visit = { at: [number, number]; ppl: number; kind: 'visit' | 'need' | 'help'; tag: T2; seat?: T2; order?: [string, number][] }
const TOMORROW: Visit[] = [
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
// A measure for one branch over one period; `prev` is the period before it (yesterday, last week, last month).
function measure(m: Metric, scale: number, period: Period, prev = false) {
  const w = weekFor(scale), k = SCALE[period] * scale
  const now = m === 'revenue' ? w.revenue * k : m === 'visits' ? w.visits * k : m === 'orders' ? w.orders * k : m === 'avgOrder' ? w.avgOrder
    : m === 'newCust' ? w.visits * w.newShare * k : m === 'returnRate' ? w.returnRate : m === 'bookings' ? w.bookings * k : m === 'meetups' ? w.meetups * k
    : m === 'stay' ? w.stayMin : w.lostTries * k
  const c = CHANGE[m][period]
  return Math.round(!prev ? now : m === 'returnRate' ? now - c : now / (1 + c / 100))
}
type Span = `${Period}${'' | '-prev'}`
const SPANS: Span[] = ['day', 'day-prev', 'week', 'week-prev', 'month', 'month-prev']

function CompareBuilder({ branch, peers }: { branch?: Branch; peers: Branch[] }) {
  const { t, sar, lang } = useT()
  const multi = peers.length > 1
  const [mode, setMode] = useState<'time' | 'branches'>('time')
  const [picked, setPicked] = useState<Metric[]>(['revenue', 'orders', 'returnRate'])
  const [spans, setSpans] = useState<[Span, Span]>(['week', 'week-prev'])
  const [span, setSpan] = useState<Span>('week')
  const [shown, setShown] = useState<string[]>(() => peers.map(b => b.id))
  const fmt = (x: number) => x.toLocaleString('en-US')
  const label = (m: Metric) => ({
    revenue: t('الدخل', 'Revenue'), visits: t('الزيارات', 'Visits'), orders: t('الطلبات', 'Orders'), avgOrder: t('متوسط الطلب', 'Average order'),
    newCust: t('عملاء جدد', 'New customers'), returnRate: t('نسبة العودة', 'Return rate'), bookings: t('الحجوزات', 'Bookings'), meetups: t('اللقاءات', 'Meetups'),
    stay: t('متوسط الجلسة', 'Average stay'), lost: t('طلبات فاتتك', 'Missed orders'),
  })[m]
  const show = (m: Metric, x: number) => m === 'revenue' || m === 'avgOrder' ? sar(fmt(x)) : m === 'returnRate' ? `${x}%` : m === 'stay' ? `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}` : fmt(x)
  const spanLabel = (s: Span) => ({
    day: t('اليوم', 'Today'), 'day-prev': t('أمس', 'Yesterday'), week: t('هذا الأسبوع', 'This week'), 'week-prev': t('الأسبوع الماضي', 'Last week'),
    month: t('هذا الشهر', 'This month'), 'month-prev': t('الشهر الماضي', 'Last month'),
  })[s]
  const val = (m: Metric, b: Branch, s: Span) => measure(m, b.scale, s.split('-')[0] as Period, s.endsWith('-prev'))
  const branchLabel = (b: Branch) => (lang === 'ar' ? b.area[0] : b.area[1])
  const toggle = <X,>(list: X[], x: X) => (list.includes(x) ? (list.length > 1 ? list.filter(y => y !== x) : list) : [...list, x])
  const daysOf = (s: Span) => (s.startsWith('day') ? 1 : s.startsWith('week') ? 7 : 30)
  // A week against a month: totals are shown per day so the comparison stays fair. Averages and rates already are.
  const uneven = (mode === 'time' || !multi) && daysOf(spans[0]) !== daysOf(spans[1])
  const RATES: Metric[] = ['avgOrder', 'returnRate', 'stay']
  const byBranch = mode === 'branches' && multi

  // Columns: two periods for this branch, or the chosen branches over one period.
  const cols = mode === 'time' || !multi
    ? spans.map(s => ({ key: s, name: spanLabel(s), get: (m: Metric) => (!branch ? 0 : uneven && !RATES.includes(m) ? Math.round(val(m, branch, s) / daysOf(s)) : val(m, branch, s)) }))
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
            <label key={i}>
              <span className="o-label">{i === 0 ? t('الفترة الأولى', 'First period') : t('قارنها بـ', 'Compare with')}</span>
              <select className="o-field" value={spans[i]} onChange={e => { const v = e.target.value as Span; setSpans(s => (i === 0 ? [v, s[1]] : [s[0], v])) }}>
                {SPANS.map(s => <option key={s} value={s}>{spanLabel(s)}</option>)}
              </select>
            </label>
          ))}
        </div>
      ) : (
        <>
          <span className="o-label">{t('الفروع', 'Branches')}</span>
          <div className="o-chips wrap">
            {peers.map(b => <button key={b.id} type="button" aria-pressed={shown.includes(b.id)} className={`o-chip ${shown.includes(b.id) ? 'active' : ''}`} onClick={() => setShown(l => toggle(l, b.id))}>{shown.includes(b.id) && <Check />}{branchLabel(b)}</button>)}
          </div>
          <span className="o-label">{t('الفترة', 'Period')}</span>
          <div className="o-chips wrap">
            {SPANS.map(s => <button key={s} type="button" className={`o-chip ${span === s ? 'active' : ''}`} onClick={() => setSpan(s)}>{spanLabel(s)}</button>)}
          </div>
        </>
      )}

      {!byBranch && spans[0] === spans[1] && <p className="o-note"><Lightbulb />{t('اختر فترتين مختلفتين للمقارنة.', 'Pick two different periods to compare.')}</p>}
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

export default function Insights({ items, onMeetups, branch, peers = [] }: { items: Item[]; onMeetups: () => void; branch?: Branch; peers?: Branch[] }) {
  const scale = branch?.scale ?? 1
  const W = weekFor(scale)
  const { t, tx, sar, lang } = useT()
  const [period, setPeriod] = useState<Period>('week')
  const [hover, setHover] = useState<number | null>(null)
  const [tomorrowTab, setTomorrowTab] = useState<'visits' | 'orders' | 'tables' | null>(null)
  const pick = (x: T2) => (lang === 'ar' ? x[0] : x[1])
  const Fwd = lang === 'ar' ? ChevronLeft : ChevronRight
  // Gregorian dates with Western digits in both languages (plain 'ar' could fall back to the Hijri calendar on some devices).
  const loc = lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-US'
  const dayMonth = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'long' })
  const daysAgo = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d }
  const today = daysAgo(0)
  const rangeFrom = period === 'day' ? today : period === 'week' ? daysAgo(6) : new Date(today.getFullYear(), today.getMonth(), 1)
  const range = period === 'day' ? `${today.toLocaleDateString(loc, { weekday: 'long' })} ${dayMonth(today)}` : `${dayMonth(rangeFrom)} – ${dayMonth(today)}`
  const clock = (h: number, m: number) => lang === 'ar' ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
  const meetWhen = ([ago, h, m]: [number, number, number]) => {
    const d = daysAgo(ago); d.setHours(h, m)
    const day = ago === 0 ? t('اليوم', 'Today') : ago === 1 ? t('أمس', 'Yesterday') : d.toLocaleDateString(loc, { weekday: 'long' })
    return `${day} ${dayMonth(d)} · ${clock(h, m)}`
  }
  const tomorrow = daysAgo(-1)
  // Pre-ordered items for tomorrow, summed, with the time the first one is needed.
  const itemName = (en: string) => { const it = items.find(i => i.name.en === en); return it ? tx(it.name) : en }
  const prep = Object.values(TOMORROW.reduce<Record<string, { en: string; qty: number; at: [number, number] }>>((acc, v) => {
    v.order?.forEach(([en, q]) => { acc[en] ??= { en, qty: 0, at: v.at }; acc[en].qty += q })
    return acc
  }, {})).sort((a, b) => b.qty - a.qty)
  const people = (p: number) => t(p === 1 ? 'شخص' : p === 2 ? 'شخصين' : `${p} أشخاص`, `${p} ${p === 1 ? 'person' : 'people'}`)
  const PARTS: [T2, number][] = [[['الصباح', 'Morning'], 12], [['الظهر', 'Midday'], 15], [['العصر', 'Afternoon'], 18], [['المساء', 'Evening'], 24]]
  const parts = PARTS.map(([label, end], i) => ({ label, visits: TOMORROW.filter(v => v.at[0] < end && v.at[0] >= (i ? PARTS[i - 1][1] : 0)) })).filter(g => g.visits.length)
  const orderText = (o: [string, number][]) => o.map(([en, q]) => `${q > 1 ? `${q}× ` : ''}${itemName(en)}`).join(t('، ', ', '))
  const kindLabel = (k: Visit['kind']) => k === 'visit' ? t('زيارة فقط', 'Just visiting') : k === 'need' ? t('يحتاج مساعدة', 'Needs help') : t('يستطيع المساعدة', 'Can help')
  const an = (x: string) => `${/^[aeio]|^u(?!ni)/i.test(x) ? 'An' : 'A'} ${x.toLowerCase()}`
  const k = SCALE[period] * scale
  const n = (x: number) => Math.max(1, Math.round(x * k))
  const fmt = (x: number) => x.toLocaleString('en-US')
  const money = (x: number) => sar(fmt(Math.round(x * k)))

  const visits = n(W.visits)
  const orders = n(W.orders)
  const savedMin = Math.round(orders * 3.3)
  const savedH = Math.round(savedMin / 60)
  const saved = savedMin < 120 ? t(`${savedMin} دقيقة`, `${savedMin} min`) : t(`${savedH} ${savedH <= 10 ? 'ساعات' : 'ساعة'}`, `${savedH} hours`)
  const hourly = HOURS.map(v => Math.round(v * k))
  const max = Math.max(...hourly, 1)
  const quietShare = Math.round((QUIET.reduce((a, h) => a + HOURS[h - FIRST_HOUR], 0) / HOURS.reduce((a, b) => a + b, 0)) * 100)
  const hourLabel = (h: number) => (lang === 'ar' ? `${h % 12 || 12} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`)
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  const lost = items.find(i => i.soldOut) ?? items.find(i => i.name.en === 'Lotus cheesecake') ?? items[0]
  const lostTries = n(W.lostTries)
  const top = TOP.map(([en, c], i) => ({ item: items.find(x => x.name.en === en) ?? items[i], c: n(c) })).filter(x => x.item)
  const topMax = Math.max(...top.map(x => x.c), 1)

  const tiles: [ReactNode, string, string, string][] = [
    [<UserPlus />, fmt(n(W.visits * W.newShare)), t('عملاء جدد', 'New customers'), t('يزورونك لأول مرة عن طريق AroundMe', 'First visit ever, found you on AroundMe')],
    [<Repeat />, `${W.returnRate}%`, t('عادوا إليك', 'Came back'), t('زاروك مرة أخرى خلال أسبوعين', 'Visited again within two weeks')],
    [<Wallet />, sar(W.avgOrder), t('متوسط الطلب', 'Average order'), t(`أعلى بـ ${sar(W.avgOrder - W.counterAvg)} من الكاونتر`, `${sar(W.avgOrder - W.counterAvg)} more than at the counter`)],
    [<Zap />, saved, t('وفّرنا على الكاشير', 'Saved at the counter'), t(`${fmt(orders)} طلب جاهز ومدفوع قبل وصولهم`, `${fmt(orders)} orders ready and paid before arrival`)],
    [<Armchair />, fmt(n(W.bookings)), t('طاولات محجوزة', 'Tables booked'), t(`${money(W.bookings * W.fee)} رسوم حجز لك`, `${money(W.bookings * W.fee)} in booking fees to you`)],
    [<Clock />, `${Math.floor(W.stayMin / 60)}:${String(W.stayMin % 60).padStart(2, '0')}`, t('متوسط الجلسة', 'Average stay'), t(`ساعة و${W.stayMin % 60} دقيقة، ويطلبون أكثر من مرة`, `${W.stayMin} minutes, and they order more than once`)],
  ]

  // Against the previous period: what it is now, what it was, and whether that's better.
  const pct = (x: number) => `${Math.abs(x)}%`
  const stayText = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`
  const cmp: [Metric, string, number, (x: number) => string][] = [
    ['revenue', t('الدخل', 'Revenue'), W.revenue * k, x => sar(fmt(Math.round(x)))],
    ['visits', t('الزيارات', 'Visits'), visits, x => fmt(Math.round(x))],
    ['orders', t('الطلبات', 'Orders'), orders, x => fmt(Math.round(x))],
    ['avgOrder', t('متوسط الطلب', 'Average order'), W.avgOrder, x => sar(Math.round(x))],
    ['newCust', t('عملاء جدد', 'New customers'), n(W.visits * W.newShare), x => fmt(Math.round(x))],
    ['returnRate', t('نسبة العودة', 'Return rate'), W.returnRate, x => `${Math.round(x)}%`],
    ['bookings', t('حجوزات الطاولات', 'Table bookings'), n(W.bookings), x => fmt(Math.round(x))],
    ['meetups', t('اللقاءات', 'Meetups'), n(W.meetups), x => fmt(Math.round(x))],
    ['stay', t('متوسط الجلسة', 'Average stay'), W.stayMin, stayText],
    ['lost', t('طلبات فاتتك', 'Missed orders'), lostTries, x => fmt(Math.round(x))],
  ]
  const rows = cmp.map(([key, label, now, show]) => {
    const c = CHANGE[key][period]
    const before = key === 'returnRate' ? now - c : now / (1 + c / 100)
    return { key, label, now: show(now), before: show(before), up: c > 0, good: LOWER_IS_BETTER.includes(key) ? c < 0 : c > 0, delta: key === 'returnRate' ? t(`${Math.abs(c)} نقاط`, `${Math.abs(c)} pts`) : pct(c), c: LOWER_IS_BETTER.includes(key) ? -c : c }
  })
  const better = rows.filter(r => r.good).length
  const best = [...rows].filter(r => r.key !== 'returnRate').sort((a, b) => b.c - a.c)[0]
  const worst = [...rows].filter(r => !r.good).sort((a, b) => a.c - b.c)[0]

  // Against the other branches, same period. Higher is better in every row.
  const peerCols = [...peers].sort((a, b) => (a.id === branch?.id ? -1 : b.id === branch?.id ? 1 : 0)).map(b => ({ b, w: weekFor(b.scale) }))
  const per = (c: typeof peerCols[number], x: number) => Math.round(x * SCALE[period] * c.b.scale)
  const peerDefs: [string, string, (c: typeof peerCols[number]) => number, (x: number) => string][] = [
    ['revenue', t('الدخل', 'Revenue'), c => per(c, c.w.revenue), x => sar(fmt(x))],
    ['orders', t('الطلبات', 'Orders'), c => per(c, WEEK.orders), fmt],
    ['avgOrder', t('متوسط الطلب', 'Average order'), c => c.w.avgOrder, x => sar(x)],
    ['newCust', t('عملاء جدد', 'New customers'), c => per(c, c.w.visits * c.w.newShare), fmt],
    ['returnRate', t('نسبة العودة', 'Return rate'), c => c.w.returnRate, x => `${x}%`],
    ['bookings', t('الحجوزات', 'Bookings'), c => per(c, WEEK.bookings), fmt],
    ['meetups', t('اللقاءات', 'Meetups'), c => per(c, WEEK.meetups), fmt],
    ['stay', t('متوسط الجلسة', 'Average stay'), c => c.w.stayMin, stayText],
  ]
  const peerRows = peerDefs.map(([key, label, get, show]) => {
    const vals = peerCols.map(get)
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
      <div className="o-period" role="tablist" aria-label={t('الفترة', 'Period')}>
        {(['day', 'week', 'month'] as Period[]).map(p => (
          <button key={p} type="button" role="tab" aria-selected={period === p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>
            {p === 'day' ? t('اليوم', 'Today') : p === 'week' ? t('هذا الأسبوع', 'This week') : t('هذا الشهر', 'This month')}
          </button>
        ))}
      </div>
      <p className="o-range"><CalendarDays />{range}</p>

      <div className="o-hero-stat">
        <small>{t('دخل جاءك من AroundMe', 'Revenue AroundMe brought you')}</small>
        <b>{money(W.revenue)}</b>
        <span><em><TrendingUp />{CHANGE.revenue[period]}%</em>{t(`من ${fmt(visits)} زيارة · ${fmt(orders)} طلب`, `from ${fmt(visits)} visits · ${fmt(orders)} orders`)}</span>
      </div>

      <button type="button" className="o-meetups" onClick={onMeetups}>
        <span className="o-meetups-icon"><HeartHandshake /></span>
        <div>
          <b>{t(`${fmt(n(W.meetups))} لقاءً تم في كافيهك`, `${fmt(n(W.meetups))} meetups happened at your café`)}</b>
          <small>{t('أشخاص ساعدوا بعضهم على طاولاتك. وهذا ما يجعلهم يختارونك دون غيرك.', 'People helped each other at your tables. This is why they pick you over the café next door.')}</small>
          <em>{t('عرض التفاصيل', 'See details')}<Fwd /></em>
        </div>
      </button>

      <div className="o-tiles">
        {tiles.map(([icon, v, label, sub]) => (
          <div key={label} className="o-tile">
            <span className="o-tile-head"><span className="o-tile-icon">{icon}</span><b>{v}</b></span>
            <span className="o-tile-label">{label}</span>
            <small>{sub}</small>
          </div>
        ))}
      </div>

      <section className="o-card o-compare">
        <h3>{t(`مقارنة ${period === 'day' ? 'بالأمس' : period === 'week' ? 'بالأسبوع الماضي' : 'بالشهر الماضي'}`, `Compared with ${period === 'day' ? 'yesterday' : period === 'week' ? 'last week' : 'last month'}`)}</h3>
        <p className="o-card-sub">{t(`تحسّن ${better} من ${rows.length} مؤشرات`, `${better} of ${rows.length} measures improved`)}</p>
        <ul className="o-cmp-list">
          {rows.map(r => (
            <li key={r.key}>
              <span className="o-cmp-name">{r.label}<small>{t(`كان \u2068${r.before}\u2069`, `was ${r.before}`)}</small></span>
              <b>{r.now}</b>
              <em className={r.good ? 'good' : 'bad'}>{r.up ? <ArrowUp /> : <ArrowDown />}{r.delta}</em>
            </li>
          ))}
        </ul>
        {best && <p className="o-note"><TrendingUp />{t(`أكبر تحسّن: ${best.label} (${best.delta}).${worst ? ` راقب ${worst.label}.` : ''}`, `Biggest gain: ${best.label} (${best.delta}).${worst ? ` Keep an eye on ${worst.label.toLowerCase()}.` : ''}`)}</p>}
      </section>

      {peers.length > 1 && branch && (
        <section className="o-card o-compare">
          <h3>{t('مقارنة بفروعك الأخرى', 'Compared with your other branches')}</h3>
          <p className="o-card-sub">{t(`الأفضل في كل مؤشر بالأخضر · ${period === 'day' ? 'اليوم' : period === 'week' ? 'هذا الأسبوع' : 'هذا الشهر'}`, `Best in each row in green · ${period === 'day' ? 'today' : period === 'week' ? 'this week' : 'this month'}`)}</p>
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

      <section className="o-card o-tomorrow">
        <h3><CalendarClock />{t('غدًا لديك', 'Tomorrow')}</h3>
        <div className="o-tomorrow-row">
          <button type="button" onClick={() => setTomorrowTab('visits')}><b>{TOMORROW.length}</b><small>{t('زيارة مجدولة', 'planned visits')}</small></button>
          <button type="button" onClick={() => setTomorrowTab('orders')}><b>{TOMORROW.filter(v => v.order).length}</b><small>{t('طلب مسبق', 'pre-orders')}</small></button>
          <button type="button" onClick={() => setTomorrowTab('tables')}><b>{TOMORROW.filter(v => v.seat).length}</b><small>{t('طاولات', 'tables')}</small></button>
        </div>
        <p className="o-note"><Sparkles />{t(`وقت الذروة 4 م، والصنف الأكثر طلبًا مسبقًا ${top[0] ? tx(top[0].item.name) : ''}. جهّزه مبكرًا.`, `Busiest at 4pm, and the most pre-ordered item is ${top[0] ? tx(top[0].item.name) : ''}. Get it ready early.`)}</p>
        <button type="button" className="o-more" onClick={() => setTomorrowTab('visits')}>{t('عرض التفاصيل', 'See details')}<Fwd /></button>
      </section>

      {lost && (
        <section className="o-card o-lost">
          <h3>{t('طلبات فاتتك', 'Orders you missed')}</h3>
          <p>{t(`${fmt(lostTries)} حاولوا طلب «${tx(lost.name)}» بعد نفاده، بقيمة تقارب ${sar(lostTries * (lost.price ?? 20))}.`, `${fmt(lostTries)} people tried to order “${tx(lost.name)}” while it was sold out, about ${sar(lostTries * (lost.price ?? 20))}.`)}</p>
          <small>{t('فعّله من المنيو فور تجهيزه.', 'Turn it back on in the menu as soon as it is ready.')}</small>
        </section>
      )}

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

      {tomorrowTab && (
        <Sheet title={t('زيارات الغد', "Tomorrow's visits")} onClose={() => setTomorrowTab(null)}>
          <p className="o-range"><CalendarDays />{`${tomorrow.toLocaleDateString(loc, { weekday: 'long' })} ${dayMonth(tomorrow)}`}</p>
          <div className="o-segmented o-tm-tabs" role="tablist">
            {([['visits', t('الزيارات', 'Visits'), TOMORROW.length], ['orders', t('الطلبات', 'Orders'), TOMORROW.filter(v => v.order).length], ['tables', t('الطاولات', 'Tables'), TOMORROW.filter(v => v.seat).length]] as const).map(([id, label, c]) => (
              <button key={id} type="button" role="tab" aria-selected={tomorrowTab === id} className={tomorrowTab === id ? 'active' : ''} onClick={() => setTomorrowTab(id)}>{label}<span className="o-count">{c}</span></button>
            ))}
          </div>

          {tomorrowTab === 'visits' && (
            <>
              <div className="o-tm-mix">
                {(['visit', 'need', 'help'] as const).map(k => <span key={k} className={`o-kind o-kind-${k}`}>{kindLabel(k)} <b>{TOMORROW.filter(v => v.kind === k).length}</b></span>)}
              </div>
              {parts.map(g => (
                <section key={g.label[1]} className="o-tm-group">
                  <h4>{pick(g.label)}<small>{t(`${g.visits.length} زيارات`, `${g.visits.length} visits`)}</small></h4>
                  <ul className="o-tm-list">
                    {g.visits.map((v, i) => (
                      <li key={i}>
                        <span className="o-visit-time">{clock(...v.at)}</span>
                        <i className={`o-kdot o-kind-${v.kind}`} />
                        <div>
                          <b>{pick(v.tag)}</b>
                          <small>{kindLabel(v.kind)} · {people(v.ppl)}</small>
                        </div>
                        <span className="o-tm-icons">
                          {v.seat && <Armchair aria-label={t('طاولة محجوزة', 'Table booked')} />}
                          {v.order && <ShoppingBag className="o-bag" aria-label={t('طلب مسبق', 'Pre-order')} />}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <p className="o-note"><Lock />{t('لا نعرض الأسماء ولا الصور. يظهر لك الوقت والعدد وسبب الزيارة فقط.', 'No names or photos. You only see the time, party size and reason for the visit.')}</p>
            </>
          )}

          {tomorrowTab === 'orders' && (
            <>
              <h4 className="o-sheet-h">{t('جهّز هذه', 'Get these ready')}</h4>
              <div className="o-prep-grid">
                {prep.map(p => <div key={p.en}><b>{p.qty}</b><span>{itemName(p.en)}</span></div>)}
              </div>
              <h4 className="o-sheet-h">{t('حسب وقت الاستلام', 'By pickup time')}</h4>
              <ul className="o-tm-list">
                {TOMORROW.filter(v => v.order).map((v, i) => (
                  <li key={i}>
                    <span className="o-visit-time">{clock(...v.at)}</span>
                    <div><b>{orderText(v.order!)}</b><small>{people(v.ppl)}{v.seat ? ` · ${pick(v.seat)}` : ''}</small></div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tomorrowTab === 'tables' && (
            <>
              <ul className="o-tm-list o-tm-tables">
                {TOMORROW.filter(v => v.seat).map((v, i) => (
                  <li key={i}>
                    <span className="o-visit-time">{clock(...v.at)}</span>
                    <div><b>{pick(v.seat!)}</b><small>{people(v.ppl)} · {pick(v.tag)}</small></div>
                    <span className="o-held">{t(`محجوزة حتى ${clock(v.at[0] + 1, v.at[1])}`, `held till ${clock(v.at[0] + 1, v.at[1])}`)}</span>
                  </li>
                ))}
              </ul>
              <p className="o-note"><Armchair />{t('كل طاولة محجوزة ساعة من وقت الزيارة، ورسوم الحجز مدفوعة مقدمًا.', 'Each table is held for an hour from the visit time, and the booking fee is paid ahead.')}</p>
            </>
          )}
        </Sheet>
      )}

      <p className="o-fine">{t('أرقام تجريبية توضح شكل لوحتك بعد أسابيعك الأولى على AroundMe', 'Sample numbers showing how your dashboard looks after your first weeks on AroundMe')}</p>
    </div>
  )
}

// Meetups at the café, as their own dashboard section: what kind of help happened, and a come-back offer for pairs who plan to meet here again.
// Sample meetup patterns for a branch: what people meet about, when, where, and how meetup visitors compare with everyone else.
const MEET_TOPICS: [T2, number][] = [[['برمجة وتطبيقات', 'Coding and apps'], 28], [['تصميم', 'Design'], 22], [['تسويق', 'Marketing'], 18], [['المالية والجداول', 'Finance and Excel'], 14], [['كتابة', 'Writing'], 10], [['تصوير', 'Photography'], 8]]
const MEET_TIMES: [T2, number][] = [[['الصباح', 'Morning'], 12], [['الظهر', 'Midday'], 18], [['العصر', 'Afternoon'], 41], [['المساء', 'Evening'], 29]]
const MEET_SEATS: [T2, number][] = [[['عند النافذة', 'By the window'], 34], [['منطقة الهدوء', 'Quiet area'], 26], [['الطاولة الطويلة', 'Long table'], 22], [['الجلسات الخارجية', 'Outdoor seating'], 18]]
// Meetup visitors against everyone else: [meetup, others].
const MEET_VS = { stay: [134, 96], orders: [2.1, 1.3], back: [61, 42] }

export function Meetups({ ops, notify }: { ops: Ops; notify: (s: string) => void }) {
  const { t, lang, sar } = useT()
  const [offerFor, setOfferFor] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'again' | 'todo'>('all')
  const pick = (x: T2) => (lang === 'ar' ? x[0] : x[1])
  const loc = lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-US'
  const dayMonth = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'long' })
  const daysAgo = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d }
  const clock = (h: number, m: number) => lang === 'ar' ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
  const meetWhen = ([ago, h, m]: [number, number, number]) => {
    const d = daysAgo(ago)
    const day = ago === 0 ? t('اليوم', 'Today') : ago === 1 ? t('أمس', 'Yesterday') : d.toLocaleDateString(loc, { weekday: 'long' })
    return `${day} ${dayMonth(d)} · ${clock(h, m)}`
  }
  const an = (x: string) => `${/^[aeio]|^u(?!ni)/i.test(x) ? 'An' : 'A'} ${x.toLowerCase()}`
  const mine = MEETUPS.map((m, i) => ({ m, i })).filter(({ i }) => ops.branch.meetups.includes(i))
  const again = mine.filter(({ m }) => m.again)
  const todo = again.filter(({ i }) => !ops.offers[`M${i}`])
  const shown = filter === 'again' ? again : filter === 'todo' ? todo : mine
  const w = weekFor(ops.branch.scale)
  const count = Math.round(w.meetups * ops.branch.scale)
  const avgMins = mine.length ? Math.round(mine.reduce((a, { m }) => a + m.mins, 0) / mine.length) : 21
  const perMeet = Math.round((mine.length ? mine.reduce((a, { m }) => a + m.ordered, 0) / mine.length : 2) * w.avgOrder)
  const againRate = mine.length ? Math.round((again.length / mine.length) * 100) : 0
  const tmr = { need: TOMORROW.filter(v => v.kind === 'need').length, help: TOMORROW.filter(v => v.kind === 'help').length }
  const bars = (rows: [T2, number][], cls = '') => (
    <ul className={`o-top-items ${cls}`}>
      {rows.map(([l, v]) => <li key={l[1]}><span className="o-top-name">{pick(l)}</span><span className="o-top-bar"><i style={{ width: `${(v / Math.max(...rows.map(r => r[1]))) * 100}%` }} /></span><b>{v}%</b></li>)}
    </ul>
  )
  const vs = (label: string, [a, b]: number[], show: (x: number) => string) => (
    <div className="o-meet-vs-row">
      <span>{label}</span>
      <div><i className="me" style={{ width: `${(a / Math.max(a, b)) * 100}%` }} /><b>{show(a)}</b></div>
      <div><i style={{ width: `${(b / Math.max(a, b)) * 100}%` }} /><b>{show(b)}</b></div>
    </div>
  )
  return (
    <div className="o-meetups-page">
      <p className="o-range"><CalendarDays />{`${dayMonth(daysAgo(6))} – ${dayMonth(daysAgo(0))}`}</p>
      <div className="o-meet-stats">
        <div><b>{count}</b><small>{t('لقاء هذا الأسبوع', 'meetups this week')}</small><em><TrendingUp />{CHANGE.meetups.week}%</em></div>
        <div><b>{t(`${avgMins} د`, `${avgMins} min`)}</b><small>{t('متوسط اللقاء', 'average length')}</small></div>
        <div><b>{againRate}%</b><small>{t('اتفقوا على لقاء جديد هنا', 'plan to meet here again')}</small></div>
        <div><b>{sar(perMeet)}</b><small>{t('ينفقه كل لقاء في المتوسط', 'spent per meetup on average')}</small></div>
      </div>
      <p className="o-note"><Lock />{t('لا نعرض الأسماء ولا الصور. يظهر لك نوع المساعدة ووقتها ومكانها فقط.', 'No names or photos. You only see the kind of help, when and where.')}</p>

      <div className="o-meet-grid">
        <section className="o-card o-meet-vs">
          <h3>{t('ماذا تضيف اللقاءات إلى كافيهك', 'What meetups add to your café')}</h3>
          <p className="o-card-sub"><span className="o-meet-key me" />{t('من التقوا هنا', 'People who met here')}<span className="o-meet-key" />{t('باقي العملاء', 'Other customers')}</p>
          {vs(t('مدة الجلسة', 'Time spent'), MEET_VS.stay, x => t(`${x} د`, `${x} min`))}
          {vs(t('طلبات في الزيارة', 'Orders per visit'), MEET_VS.orders, x => x.toFixed(1))}
          {vs(t('عادوا خلال أسبوعين', 'Back within two weeks'), MEET_VS.back, x => `${x}%`)}
        </section>

        <section className="o-card">
          <h3>{t('عن ماذا يلتقون', 'What they meet about')}</h3>
          <p className="o-card-sub">{t('نوع المساعدة في لقاءات هذا الأسبوع', 'The kind of help in this week’s meetups')}</p>
          {bars(MEET_TOPICS)}
        </section>

        <section className="o-card">
          <h3>{t('متى وأين يلتقون', 'When and where they meet')}</h3>
          <h4 className="o-sub-h">{t('وقت اللقاء', 'Time of day')}</h4>
          {bars(MEET_TIMES)}
          <h4 className="o-sub-h">{t('المكان المفضّل', 'Favourite spot')}</h4>
          {bars(MEET_SEATS, 'needs')}
          <p className="o-note"><Lightbulb />{t(`أغلب اللقاءات ${pick(MEET_TIMES[2][0])} ${pick(MEET_SEATS[0][0])}. أبقِ هذه الطاولات متاحة للحجز في ذلك الوقت.`, `Most meetups happen in the ${pick(MEET_TIMES[2][0]).toLowerCase()}, ${pick(MEET_SEATS[0][0]).toLowerCase()}. Keep those tables open for booking then.`)}</p>
        </section>

        <section className="o-card o-meet-tmr">
          <h3><CalendarClock />{t('غدًا في كافيهك', 'Tomorrow at your café')}</h3>
          <div className="o-tomorrow-row">
            <div><b>{tmr.need}</b><small>{t('يحتاجون مساعدة', 'need help')}</small></div>
            <div><b>{tmr.help}</b><small>{t('يستطيعون المساعدة', 'can help')}</small></div>
            <div><b>{again.length}</b><small>{t('لقاءات متكررة متوقعة', 'repeat meetups expected')}</small></div>
          </div>
          <p className="o-note"><Sparkles />{tmr.need > tmr.help ? t(`من يحتاجون المساعدة أكثر ممن يستطيعون بـ ${tmr.need - tmr.help}. عرض صغير لمن يساعد قد يحسم اختياره لكافيهك.`, `${tmr.need - tmr.help} more ${tmr.need - tmr.help === 1 ? 'person needs' : 'people need'} help than can help. A small perk for helpers could make them pick your café.`) : t('العدد متوازن بين من يحتاج المساعدة ومن يستطيعها.', 'Those who need help and those who can are evenly matched.')}</p>
        </section>
      </div>

      <div className="o-meet-head">
        <h3>{t('اللقاءات', 'Meetups')}</h3>
        <div className="o-chips wrap">
          {([['all', t(`الكل · ${mine.length}`, `All · ${mine.length}`)], ['again', t(`سيلتقون مجددًا · ${again.length}`, `Meeting again · ${again.length}`)], ['todo', t(`بلا عرض · ${todo.length}`, `No offer yet · ${todo.length}`)]] as const).map(([k, l]) => (
            <button key={k} type="button" className={`o-chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <p className="o-empty">{filter === 'todo' ? t('أرسلت عرضًا لكل من اتفقوا على اللقاء مجددًا.', 'You sent an offer to everyone meeting again.') : t('لا توجد لقاءات هنا بعد.', 'No meetups here yet.')}</p>}
      <ul className="o-meet-list">
        {shown.map(({ m, i }) => (
          <li key={i}>
            <div className="o-meet-top"><span>{meetWhen(m.when)}</span><span>{pick(m.seat)}</span></div>
            <b>{pick(m.topic)}</b>
            <p>{t(`${pick(m.helper)} ${m.f ? 'ساعدت' : 'ساعد'} ${pick(m.helped)}`, `${an(pick(m.helper))} helped ${an(pick(m.helped)).toLowerCase()}`)}</p>
            <div className="o-meet-facts">
              <span><Clock />{t(`${m.mins} دقيقة`, `${m.mins} min`)}</span>
              <span><ShoppingBag />{t(`${m.ordered === 1 ? 'طلب واحد' : m.ordered === 2 ? 'طلبان' : `${m.ordered} طلبات`} · ${sar(m.ordered * w.avgOrder)}`, `${m.ordered} order${m.ordered === 1 ? '' : 's'} · ${sar(m.ordered * w.avgOrder)}`)}</span>
            </div>
            <div className="o-meet-tags">
              {m.tags.map(tag => <span key={tag[1]}>{pick(tag)}</span>)}
              {m.again && <span className="o-meet-again"><MessageCircleHeart />{t('اتفقوا على اللقاء هنا مرة أخرى', 'Plan to meet here again')}</span>}
            </div>
            {m.again && (ops.offers[`M${i}`] ? <OfferSent offer={ops.offers[`M${i}`]} pair /> : <OfferButton pair onClick={() => setOfferFor(i)} />)}
          </li>
        ))}
      </ul>
      {offerFor != null && (
        <OfferSheet pair onClose={() => setOfferFor(null)}
          onSend={o => { ops.setOffers(x => ({ ...x, [`M${offerFor}`]: { ...o, sentAt: Date.now(), src: 'meet', about: MEETUPS[offerFor].topic, pair: true } })); setOfferFor(null); notify(t('أرسلنا العرض إليهما، وسيصلهما إشعار «افتح هديتك»', 'Offer sent. They get an “Open your gift” notification')) }}
          about={<p className="o-offer-for"><MessageCircleHeart /><span><b>{pick(MEETUPS[offerFor].topic)}</b><small>{t('اتفقا على اللقاء في كافيهك مرة أخرى', 'They agreed to meet at your café again')}</small></span></p>} />
      )}
    </div>
  )
}
