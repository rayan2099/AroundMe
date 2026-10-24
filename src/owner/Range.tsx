import { useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Sheet, useT } from './Owner'

// A period on the dashboard: whole days, from the start of `from` to the end of `to` (both local midnights).
export type Range = { from: number; to: number }
export const DAY = 86_400_000
export const dayStart = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime() }
const addDays = (ms: number, n: number) => { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime() }
export const today = () => dayStart(Date.now())
export const rangeDays = (r: Range) => Math.round((r.to - r.from) / DAY) + 1
// Whole days between the end of the range and today (0 when it ends today).
export const rangeAgo = (r: Range) => Math.max(0, Math.round((today() - r.to) / DAY))
// The same number of days, right before.
export const prevRange = (r: Range): Range => ({ from: addDays(r.from, -rangeDays(r)), to: addDays(r.from, -1) })
export const inRange = (r: Range, ms: number) => ms >= r.from && ms < addDays(r.to, 1)

export type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'd30' | 'd90'
export function presetRange(p: Preset): Range {
  const t0 = today(), d = new Date(t0)
  switch (p) {
    case 'today': return { from: t0, to: t0 }
    case 'yesterday': return { from: addDays(t0, -1), to: addDays(t0, -1) }
    case 'week': return { from: addDays(t0, -6), to: t0 }
    case 'month': return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: t0 }
    case 'lastMonth': return { from: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), to: new Date(d.getFullYear(), d.getMonth(), 0).getTime() }
    case 'd30': return { from: addDays(t0, -29), to: t0 }
    case 'd90': return { from: addDays(t0, -89), to: t0 }
  }
}
const PRESETS: Preset[] = ['today', 'yesterday', 'week', 'month', 'lastMonth', 'd30', 'd90']
export const samePeriod = (a: Range, b: Range) => a.from === b.from && a.to === b.to
export const matchPreset = (r: Range) => PRESETS.find(p => samePeriod(presetRange(p), r))

export function useRangeText() {
  const { t, lang } = useT()
  // Gregorian dates with Western digits in both languages.
  const loc = lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-US'
  const presetLabel = (p: Preset) => ({
    today: t('اليوم', 'Today'), yesterday: t('أمس', 'Yesterday'), week: t('آخر 7 أيام', 'Last 7 days'), month: t('هذا الشهر', 'This month'),
    lastMonth: t('الشهر الماضي', 'Last month'), d30: t('آخر 30 يومًا', 'Last 30 days'), d90: t('آخر 90 يومًا', 'Last 90 days'),
  })[p]
  const rangeText = (r: Range) => {
    const a = new Date(r.from), b = new Date(r.to), thisYear = new Date().getFullYear()
    const yr = a.getFullYear() !== thisYear || b.getFullYear() !== thisYear
    const full = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'long', ...(yr ? { year: 'numeric' } : {}) })
    if (r.from === r.to) return `${a.toLocaleDateString(loc, { weekday: 'long' })} ${full(a)}`
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return lang === 'ar' ? `${a.getDate()} – ${full(b)}` : `${full(a)} – ${b.getDate()}${yr ? `, ${b.getFullYear()}` : ''}`
    return `${full(a)} – ${full(b)}`
  }
  // A preset's name when the range is one, otherwise the dates.
  const rangeName = (r: Range) => { const p = matchPreset(r); return p ? presetLabel(p) : rangeText(r) }
  const daysText = (n: number) => t(n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n <= 10 ? `${n} أيام` : `${n} يومًا`, `${n} day${n === 1 ? '' : 's'}`)
  return { loc, presetLabel, rangeText, rangeName, daysText }
}

// The period button: shows the chosen dates and opens the calendar.
export function RangePicker({ value, onChange, label, compact }: { value: Range; onChange: (r: Range) => void; label?: string; compact?: boolean }) {
  const { rangeText, rangeName } = useRangeText()
  const [open, setOpen] = useState(false)
  const preset = matchPreset(value)
  return (
    <>
      <button type="button" className={`o-range-btn ${compact ? 'compact' : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <CalendarDays />
        <span>{preset && !compact ? <><b>{rangeName(value)}</b><small>{rangeText(value)}</small></> : <b>{compact ? rangeName(value) : rangeText(value)}</b>}</span>
        <ChevronDown />
      </button>
      {open && <RangeSheet title={label} value={value} onClose={() => setOpen(false)} onApply={r => { onChange(r); setOpen(false) }} />}
    </>
  )
}

function RangeSheet({ title, value, onClose, onApply }: { title?: string; value: Range; onClose: () => void; onApply: (r: Range) => void }) {
  const { t, lang } = useT()
  const { loc, presetLabel, rangeText, daysText } = useRangeText()
  const [from, setFrom] = useState<number>(value.from)
  const [to, setTo] = useState<number | null>(value.to)
  const [month, setMonth] = useState(() => { const d = new Date(value.to); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() })
  const t0 = today(), earliest = addDays(t0, -365)
  const m = new Date(month)
  const first = new Date(m.getFullYear(), m.getMonth(), 1)
  const total = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
  // The week starts on Sunday, as it does in Saudi Arabia.
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: total }, (_, i) => new Date(m.getFullYear(), m.getMonth(), i + 1).getTime())]
  const weekdays = lang === 'ar' ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const shift = (n: number) => setMonth(new Date(m.getFullYear(), m.getMonth() + n, 1).getTime())
  const canPrev = new Date(m.getFullYear(), m.getMonth(), 0).getTime() >= earliest
  const canNext = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime() <= t0
  // First tap picks the start, the second the end (either order). A third tap starts over.
  const tap = (d: number) => {
    if (to !== null || d < from) { setFrom(d); setTo(null) } else setTo(d)
  }
  const end = to ?? from
  const Prev = lang === 'ar' ? ChevronRight : ChevronLeft
  const Next = lang === 'ar' ? ChevronLeft : ChevronRight
  const chosen = { from, to: end }
  return (
    <Sheet title={title ?? t('اختر الفترة', 'Choose a period')} onClose={onClose} footer={
      <>
        <button type="button" className="o-primary" onClick={() => onApply(chosen)}>{t(`تطبيق · ${daysText(rangeDays(chosen))}`, `Apply · ${daysText(rangeDays(chosen))}`)}</button>
        <button type="button" className="o-text-btn" onClick={onClose}>{t('رجوع', 'Back')}</button>
      </>
    }>
      <div className="o-chips wrap o-range-presets">
        {PRESETS.map(p => { const r = presetRange(p); const on = samePeriod(r, chosen); return <button key={p} type="button" className={`o-chip ${on ? 'active' : ''}`} onClick={() => { setFrom(r.from); setTo(r.to); const d = new Date(r.to); setMonth(new Date(d.getFullYear(), d.getMonth(), 1).getTime()) }}>{presetLabel(p)}</button> })}
      </div>
      <div className="o-cal">
        <div className="o-cal-head">
          <button type="button" onClick={() => shift(-1)} disabled={!canPrev} aria-label={t('الشهر السابق', 'Previous month')}><Prev /></button>
          <b>{m.toLocaleDateString(loc, { month: 'long', year: 'numeric' })}</b>
          <button type="button" onClick={() => shift(1)} disabled={!canNext} aria-label={t('الشهر التالي', 'Next month')}><Next /></button>
        </div>
        <div className="o-cal-grid" role="grid">
          {weekdays.map(w => <span key={w} className="o-cal-wd">{w}</span>)}
          {cells.map((d, i) => d === null ? <span key={`e${i}`} /> : (
            <button key={d} type="button" disabled={d > t0 || d < earliest}
              className={['o-cal-day', d === from && 'start', d === end && 'end', d > from && d < end && 'in', d === t0 && 'today'].filter(Boolean).join(' ')}
              aria-pressed={d >= from && d <= end} onClick={() => tap(d)}>{new Date(d).getDate()}</button>
          ))}
        </div>
      </div>
      <p className="o-range-sel">{to === null ? t('اختر يوم النهاية، أو طبّق على يوم واحد', 'Pick the end day, or apply to one day') : rangeText(chosen)}</p>
    </Sheet>
  )
}
