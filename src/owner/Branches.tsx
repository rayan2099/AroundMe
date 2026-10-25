import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, Clock, Copy, LayoutGrid, MessageCircle, PenLine, Plus, Receipt, Trash2, TrendingUp } from 'lucide-react'
import { Sheet, useT } from './Owner'
import { measure } from './Insights'
import { visitsFor } from './Tomorrow'
import { RangePicker, presetRange, useRangeText } from './Range'
import type { Range } from './Range'
import { attention, emptyBranch, nextPrefix, opsStats } from './Ops'
import type { Branch, Branches as BranchStore, Ops } from './Ops'
import type { Place } from './data'

// Running several branches from one dashboard.
// Rules, so nothing is ambiguous: «كل الفروع» is for the overview, the shared menu and managing branches.
// Orders, tables, messages, offers, meetups and performance always belong to one branch, so those sections
// ask which branch first. Sold-out is per branch; the menu itself (items, prices, sections) is shared.
type T2 = [string, string]
type CmpKey = 'sales' | 'orders' | 'avgOrder' | 'prep' | 'seated' | 'returned'
export type BranchView = 'orders' | 'tables' | 'messages' | 'tomorrow' | 'offers' | 'meetups' | 'insights'

export function useBranchText() {
  const { t, lang } = useT()
  const pick = (x: T2) => (lang === 'ar' ? x[0] : x[1])
  const branchName = (b: Branch) => t(`فرع ${b.area[0]}`, `${b.area[1]} branch`)
  const hour = (h: number) => { const x = h % 24; return lang === 'ar' ? `${x % 12 || 12} ${x < 12 ? 'ص' : 'م'}` : `${x % 12 || 12}${x < 12 ? 'am' : 'pm'}` }
  const hoursText = (b: Branch) => `${hour(b.hours[0])} – ${hour(b.hours[1])}`
  const openNow = (b: Branch, now: number) => { const h = new Date(now).getHours() + new Date(now).getMinutes() / 60; return (h >= b.hours[0] && h < b.hours[1]) || (b.hours[1] > 24 && h < b.hours[1] - 24) }
  return { t, lang, pick, branchName, hoursText, openNow, hour }
}

// The branch switcher: in the side nav and behind the branch chip at the top of every section.
export function BranchSwitcher({ B, place, current, onPick }: { B: BranchStore; place: Place; current: string; onPick: (id: string) => void }) {
  const { t, branchName, hoursText, openNow } = useBranchText()
  const { tx } = useT()
  const sum = B.branches.reduce((a, b) => a + attention(opsStats(B.ops(b.id))), 0)
  return (
    <div className="o-branches-menu" role="listbox" aria-label={t('الفروع', 'Branches')}>
      <button type="button" role="option" aria-selected={current === 'all'} className={current === 'all' ? 'active' : ''} onClick={() => onPick('all')}>
        <span className="o-branch-mark all"><LayoutGrid /></span>
        <span><b>{t('كل الفروع', 'All branches')}</b><small>{t(`${B.branches.length} فروع · ${tx(place.name)}`, `${B.branches.length} branches · ${tx(place.name)}`)}</small></span>
        {sum > 0 && <i>{sum}</i>}
        {current === 'all' && <Check />}
      </button>
      {B.branches.map(b => {
        const s = opsStats(B.ops(b.id))
        const d = B.all[b.id]
        const open = openNow(b, B.now)
        return (
          <button key={b.id} type="button" role="option" aria-selected={current === b.id} className={current === b.id ? 'active' : ''} onClick={() => onPick(b.id)}>
            <span className={`o-branch-mark ${d?.paused ? 'paused' : open ? 'open' : 'closed'}`}>{b.prefix[0]}</span>
            <span><b>{branchName(b)}</b><small>{d?.paused ? t('الطلبات متوقفة مؤقتًا', 'Orders paused') : open ? t(`مفتوح · ${hoursText(b)}`, `Open · ${hoursText(b)}`) : t(`مغلق · ${hoursText(b)}`, `Closed · ${hoursText(b)}`)}</small></span>
            {attention(s) > 0 && <i>{attention(s)}</i>}
            {current === b.id && <Check />}
          </button>
        )
      })}
    </div>
  )
}

// Opening a branch-only section while «كل الفروع» is selected: pick the branch, with the number that matters for that section.
export function BranchPick({ B, view, onPick }: { B: BranchStore; view: BranchView; onPick: (id: string) => void }) {
  const { t, branchName, hoursText } = useBranchText()
  const { sar, lang } = useT()
  const Fwd = lang === 'ar' ? ChevronLeft : ChevronRight
  const metric = (o: Ops): [ReactNode, string, boolean] => {
    const s = opsStats(o)
    switch (view) {
      case 'orders': return [s.newOrders, t('طلبات جديدة', 'new orders'), s.newOrders > 0]
      case 'tables': return [`${s.seated}/${s.tables}`, t(s.overTime ? `مشغولة · ${s.overTime} تجاوزت الوقت` : 'مشغولة', s.overTime ? `seated · ${s.overTime} over time` : 'seated'), s.overTime + s.lateBookings > 0]
      case 'messages': return [s.unread, t('غير مقروءة', 'unread'), s.unread > 0]
      case 'offers': return [s.returned, t('عادوا بعرض اليوم', 'came back today'), false]
      case 'tomorrow': { const v = visitsFor(o.branch.scale); return [v.length, t(`زيارة مجدولة · ${v.filter(x => x.order).length} طلبات مسبقة`, `planned visits · ${v.filter(x => x.order).length} pre-orders`), false] }
      case 'meetups': return [o.branch.meetups.length, t('لقاءات هذا الأسبوع', 'meetups this week'), false]
      default: return [sar(s.sales), t('مبيعات اليوم', 'sales today'), false]
    }
  }
  return (
    <div className="o-branch-pick">
      <p className="o-sheet-sub">{t('هذا القسم خاص بكل فرع. اختر الفرع:', 'This section is per branch. Pick one:')}</p>
      {B.branches.map(b => {
        const [value, label, warn] = metric(B.ops(b.id))
        return (
          <button key={b.id} type="button" onClick={() => onPick(b.id)}>
            <span className="o-branch-mark open">{b.prefix[0]}</span>
            <span><b>{branchName(b)}</b><small>{hoursText(b)}</small></span>
            <span className={`o-branch-metric ${warn ? 'warn' : ''}`}><b>{value}</b><small>{label}</small></span>
            <Fwd />
          </button>
        )
      })}
    </div>
  )
}

// «كل الفروع»: today across every branch, each branch at a glance, and how the branches compare.
export function Overview({ B, open }: { B: BranchStore; open: (id: string, view: BranchView) => void }) {
  const { t, branchName, hoursText, openNow } = useBranchText()
  const { sar, lang } = useT()
  const Fwd = lang === 'ar' ? ChevronLeft : ChevronRight
  const rows = B.branches.map(b => ({ b, o: B.ops(b.id), s: opsStats(B.ops(b.id)), d: B.all[b.id] }))
  const tot = rows.reduce((a, { s }) => ({ sales: a.sales + s.sales, orders: a.orders + s.ordersToday, active: a.active + s.newOrders + s.inPrep + s.ready, seated: a.seated + s.seated, tables: a.tables + s.tables, unread: a.unread + s.unread }), { sales: 0, orders: 0, active: 0, seated: 0, tables: 0, unread: 0 })
  const fmt = (x: number) => x.toLocaleString('en-US')
  const [metric, setMetric] = useState<CmpKey>('sales')
  // Today's numbers per branch, for the comparison bars. Prep time is the one where lower wins.
  const cmpVal = (r: typeof rows[number], key: CmpKey) => {
    const done = r.o.orders.filter(x => x.status === 'done').length
    return key === 'sales' ? r.s.sales : key === 'orders' ? r.s.ordersToday : key === 'avgOrder' ? (done ? Math.round(r.s.sales / done) : 0)
      : key === 'prep' ? r.s.avgPrep : key === 'seated' ? (r.s.tables ? Math.round((r.s.seated / r.s.tables) * 100) : 0) : r.s.returned
  }
  const CMP: [CmpKey, string, string, (x: number) => string][] = [
    ['sales', t('المبيعات', 'Sales'), t('مبيعات اليوم من AroundMe', 'Sales today from AroundMe'), x => sar(fmt(x))],
    ['orders', t('الطلبات', 'Orders'), t('عدد طلبات اليوم', 'Orders placed today'), fmt],
    ['avgOrder', t('متوسط الطلب', 'Average order'), t('متوسط قيمة الطلب المُسلّم اليوم', 'Average value of orders delivered today'), x => sar(x)],
    ['prep', t('سرعة التحضير', 'Prep speed'), t('متوسط دقائق التحضير اليوم، الأقل أفضل', 'Average prep minutes today, lower is better'), x => t(`${x} د`, `${x} min`)],
    ['seated', t('إشغال الطاولات', 'Table use'), t('نسبة الطاولات المشغولة الآن', 'Share of tables seated now'), x => `${x}%`],
    ['returned', t('عادوا بعروضك', 'Came back'), t('عملاء عادوا بعرض خلال آخر 24 ساعة', 'Customers who came back with an offer in the last 24 hours'), fmt],
  ]
  const cur = CMP.find(c => c[0] === metric)!
  const lowerWins = metric === 'prep'
  const ranked = rows.map(r => ({ ...r, v: cmpVal(r, metric) })).sort((a, b) => (lowerWins ? (a.v || 1e9) - (b.v || 1e9) : b.v - a.v))
  const maxV = Math.max(1, ...ranked.map(r => r.v))
  const [range, setRange] = useState<Range>(() => presetRange('week'))
  const { rangeName } = useRangeText()
  const week = rows.map(({ b }) => ({ b, rev: measure('revenue', b.scale, range) }))
  const weekTot = week.reduce((a, w) => a + w.rev, 0)
  const fastest = [...rows].filter(r => r.s.avgPrep > 0).sort((a, b) => a.s.avgPrep - b.s.avgPrep)[0]

  return (
    <div className="o-overview">
      <div className="o-ov-kpis">
        <div><b>{sar(fmt(tot.sales))}</b><small>{t('مبيعات اليوم', 'Sales today')}</small></div>
        <div><b>{tot.orders}</b><small>{t('طلب اليوم', 'Orders today')}</small></div>
        <div><b>{tot.active}</b><small>{t('قيد التنفيذ الآن', 'In progress now')}</small></div>
        <div><b>{`${tot.seated}/${tot.tables}`}</b><small>{t('طاولات مشغولة', 'Tables seated')}</small></div>
      </div>


      <div className="o-ov-branches">
        {rows.map(({ b, s, d }) => {
          const isOpen = openNow(b, B.now)
          return (
            <section key={b.id} className="o-card o-ov-branch">
              <header>
                <span className={`o-branch-mark ${d?.paused ? 'paused' : isOpen ? 'open' : 'closed'}`}>{b.prefix[0]}</span>
                <div><b>{branchName(b)}</b><small><Clock />{d?.paused ? t('الطلبات متوقفة مؤقتًا', 'Orders paused') : `${isOpen ? t('مفتوح', 'Open') : t('مغلق', 'Closed')} · ${hoursText(b)}`}</small></div>
              </header>
              <div className="o-ov-metrics">
                <div><b>{sar(fmt(s.sales))}</b><small>{t('مبيعات اليوم', 'sales today')}</small></div>
                <div><b>{s.ordersToday}</b><small>{t('طلب اليوم', 'orders today')}</small></div>
                <div><b>{t(`${s.avgPrep} د`, `${s.avgPrep} min`)}</b><small>{t('متوسط التحضير', 'avg prep')}</small></div>
                <div><b>{`${s.seated}/${s.tables}`}</b><small>{t('طاولات مشغولة', 'tables seated')}</small></div>
              </div>
              <div className="o-ov-chips">
                <button type="button" className={s.newOrders ? 'hot' : ''} onClick={() => open(b.id, 'orders')}><Receipt />{t(`${s.newOrders} جديدة`, `${s.newOrders} new`)}</button>
                <button type="button" onClick={() => open(b.id, 'orders')}>{t(`${s.inPrep} قيد التحضير`, `${s.inPrep} preparing`)}</button>
                <button type="button" className={s.unread ? 'hot' : ''} onClick={() => open(b.id, 'messages')}><MessageCircle />{s.unread}</button>
              </div>
              <button type="button" className="o-ov-open" onClick={() => open(b.id, 'orders')}>{t('افتح الفرع', 'Open branch')}<Fwd /></button>
            </section>
          )
        })}
      </div>

      <section className="o-card">
        <h3>{t('مقارنة الفروع', 'Branch comparison')}</h3>
        <div className="o-chips wrap o-ov-metric" role="tablist" aria-label={t('المؤشر', 'Measure')}>
          {CMP.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={metric === key} className={`o-chip ${metric === key ? 'active' : ''}`} onClick={() => setMetric(key)}>{label}</button>)}
        </div>
        <p className="o-card-sub">{cur[2]}</p>
        <ul className="o-top-items o-ov-bars">
          {ranked.map(({ b, v }) => (
            <li key={b.id} className={v && v === ranked[0].v ? 'lead' : ''}><span className="o-top-name">{branchName(b)}</span><span className="o-top-bar"><i style={{ width: `${(lowerWins ? (v ? Math.min(...ranked.filter(r => r.v).map(r => r.v)) / v : 0) : v / maxV) * 100}%` }} /></span><b>{cur[3](v)}</b></li>
          ))}
        </ul>
        <div className="o-ov-week">
          <h4 className="o-sub-h">{t('المبيعات حسب الفرع', 'Sales by branch')}</h4>
          <RangePicker compact value={range} onChange={setRange} />
        </div>
        <p className="o-card-sub">{t(`${rangeName(range)}: ${sar(fmt(weekTot))} من كل الفروع`, `${rangeName(range)}: ${sar(fmt(weekTot))} across all branches`)}</p>
        <ul className="o-ov-share">
          {week.map(({ b, rev }) => <li key={b.id}><span>{branchName(b)}</span><b>{sar(fmt(rev))}</b><small>{weekTot ? Math.round((rev / weekTot) * 100) : 0}%</small></li>)}
        </ul>
        {fastest && rows.length > 1 && <p className="o-note"><TrendingUp />{t(`${branchName(fastest.b)} الأسرع تحضيرًا اليوم (${fastest.s.avgPrep} د). شارك طريقتهم مع باقي الفروع.`, `${branchName(fastest.b)} is the fastest today (${fastest.s.avgPrep} min). Share how they do it with the other branches.`)}</p>}
      </section>
    </div>
  )
}

// Managing branches: add, edit hours, remove. A new branch starts empty (or with another branch's tables) and shares the menu.
export function BranchesAdmin({ B, notify, onOpen }: { B: BranchStore; notify: (s: string) => void; onOpen: (id: string) => void }) {
  const { t, pick, branchName, hoursText } = useBranchText()
  const [editing, setEditing] = useState<Branch | 'new' | null>(null)
  const [removing, setRemoving] = useState<Branch | null>(null)
  const { lang } = useT()
  const Fwd = lang === 'ar' ? ChevronLeft : ChevronRight
  const save = (b: Branch, copyFrom: string | null) => {
    const exists = B.branches.some(x => x.id === b.id)
    B.setBranches(l => (exists ? l.map(x => (x.id === b.id ? b : x)) : [...l, b]))
    if (!exists) B.setAll(a => ({ ...a, [b.id]: { ...emptyBranch(), tables: copyFrom ? (a[copyFrom]?.tables ?? []).map(x => ({ ...x, seatedAt: undefined, ppl: undefined, booking: undefined })) : [] } }))
    setEditing(null)
    notify(exists ? t(`حفظنا ${branchName(b)}`, `Saved ${branchName(b)}`) : t(`أضفنا ${branchName(b)}، ويظهر لعملائك بالمنيو نفسه`, `Added ${branchName(b)}. Customers see it with the same menu`))
  }
  const busy = (b: Branch) => { const s = opsStats(B.ops(b.id)); return s.newOrders + s.inPrep + s.ready + s.seated }
  return (
    <div className="o-ops">
      <div className="o-floor-head">
        <span><b>{t(`${B.branches.length} فروع`, `${B.branches.length} branches`)}</b><small>{t('منيو واحد للجميع', 'one shared menu')}</small></span>
        <button type="button" className="o-offer-new-btn" onClick={() => setEditing('new')}><Plus />{t('أضف فرعًا', 'Add a branch')}</button>
      </div>
      <ul className="o-branch-admin">
        {B.branches.map(b => {
          const d = B.all[b.id]
          return (
            <li key={b.id}>
              <span className="o-branch-mark open">{b.prefix[0]}</span>
              <div>
                <b>{branchName(b)}</b>
                <small>{`${hoursText(b)} · ${t(`${d?.tables.length ?? 0} طاولات`, `${d?.tables.length ?? 0} tables`)}`}</small>
                <small>{t(`الطلبات \u2066#${b.prefix[0]}…\u2069 · الحجوزات \u2066#${b.prefix[1]}…\u2069`, `Orders #${b.prefix[0]}… · bookings #${b.prefix[1]}…`)}</small>
              </div>
              <button type="button" className="o-icon-btn" onClick={() => setEditing(b)} aria-label={t('عدّل', 'Edit')}><PenLine /></button>
              <button type="button" className="o-icon-btn" onClick={() => onOpen(b.id)} aria-label={t('افتح الفرع', 'Open branch')}><Fwd /></button>
            </li>
          )
        })}
      </ul>
      <p className="o-note"><Copy />{t('المنيو والأسعار والأقسام موحّدة لكل الفروع. حالة «نفد» وإيقاف الطلبات والطاولات والحجوزات خاصة بكل فرع.', 'Menu, prices and sections are shared by every branch. Sold-out, pausing orders, tables and bookings are set per branch.')}</p>

      {editing && <BranchForm branch={editing === 'new' ? null : editing} branches={B.branches} onSave={save} onClose={() => setEditing(null)}
        onDelete={b => { setEditing(null); setRemoving(b) }} />}
      {removing && (
        <Sheet title={t(`حذف ${branchName(removing)}؟`, `Remove ${branchName(removing)}?`)} onClose={() => setRemoving(null)} footer={
          busy(removing) > 0
            ? <button type="button" className="o-primary" onClick={() => setRemoving(null)}>{t('حسنًا', 'OK')}</button>
            : <>
              <button type="button" className="o-primary warn" onClick={() => {
                const id = removing.id
                B.setBranches(l => l.filter(x => x.id !== id)); B.setAll(a => { const { [id]: _, ...rest } = a; return rest })
                notify(t(`حذفنا ${branchName(removing)}`, `Removed ${branchName(removing)}`)); setRemoving(null)
              }}><Trash2 />{t('احذف الفرع', 'Remove branch')}</button>
              <button type="button" className="o-text-btn" onClick={() => setRemoving(null)}>{t('تراجع', 'Cancel')}</button>
            </>
        }>
          <p className="o-sheet-sub">{busy(removing) > 0
            ? t('لا يمكن حذف فرع لديه طلبات قيد التنفيذ أو طاولات مشغولة. أكملها أولًا.', "A branch with orders in progress or seated tables can't be removed. Finish them first.")
            : t(`يختفي ${pick(removing.area)} من التطبيق فورًا، وتُحذف طاولاته وحجوزاته. يبقى المنيو كما هو للفروع الأخرى.`, `${pick(removing.area)} disappears from the app right away, with its tables and bookings. The menu stays for the other branches.`)}</p>
        </Sheet>
      )}
    </div>
  )
}

const OPEN_HOURS = [5, 6, 7, 8, 9, 10]
const CLOSE_HOURS = [22, 23, 24, 25, 26]
function BranchForm({ branch, branches, onSave, onDelete, onClose }: { branch: Branch | null; branches: Branch[]; onSave: (b: Branch, copyFrom: string | null) => void; onDelete: (b: Branch) => void; onClose: () => void }) {
  const { t, lang, branchName, hour } = useBranchText()
  const [area, setArea] = useState(branch ? (lang === 'ar' ? branch.area[0] : branch.area[1]) : '')
  const [open, setOpen] = useState(branch?.hours[0] ?? 7)
  const [close, setClose] = useState(branch?.hours[1] ?? 24)
  const [copy, setCopy] = useState<string | null>(branches[0]?.id ?? null)
  const name = area.trim()
  const taken = branches.some(b => b.id !== branch?.id && (b.area[0] === name || b.area[1].toLowerCase() === name.toLowerCase()))
  const ok = name.length >= 2 && !taken
  const submit = () => {
    if (!ok) return
    const keep = branch && name === (lang === 'ar' ? branch.area[0] : branch.area[1])
    const areaT: T2 = keep ? branch!.area : lang === 'ar' ? [name, branch?.area[1] ?? name] : [branch?.area[0] ?? name, name]
    onSave(branch ? { ...branch, area: areaT, hours: [open, close] } : { id: `b${Date.now()}`, area: areaT, hours: [open, close], prefix: nextPrefix(branches), meetups: [], scale: 0.25 }, branch ? null : copy)
  }
  return (
    <Sheet title={branch ? t(`عدّل ${branchName(branch)}`, `Edit ${branchName(branch)}`) : t('فرع جديد', 'New branch')} onClose={onClose} footer={
      <>
        <button type="button" className="o-primary" disabled={!ok} onClick={submit}>{branch ? t('احفظ', 'Save') : t('أضف الفرع', 'Add branch')}</button>
        {branch && branches.length > 1 && <button type="button" className="o-text-btn danger" onClick={() => onDelete(branch)}>{t('احذف الفرع', 'Remove branch')}</button>}
      </>
    }>
      <label className="o-label" htmlFor="o-branch-area">{t('الحي', 'Neighbourhood')}</label>
      <input id="o-branch-area" className={`o-field ${taken ? 'warn' : ''}`} value={area} onChange={e => setArea(e.target.value)} placeholder={t('مثلًا: حطين', 'e.g. Hittin')} />
      {taken && <p className="o-field-hint warn">{t('لديك فرع بهذا الاسم.', 'You already have a branch with this name.')}</p>}
      <span className="o-label">{t('يفتح', 'Opens')}</span>
      <div className="o-chips wrap">{OPEN_HOURS.map(h => <button key={h} type="button" className={`o-chip ${open === h ? 'active' : ''}`} onClick={() => setOpen(h)}>{hour(h)}</button>)}</div>
      <span className="o-label">{t('يغلق', 'Closes')}</span>
      <div className="o-chips wrap">{CLOSE_HOURS.map(h => <button key={h} type="button" className={`o-chip ${close === h ? 'active' : ''}`} onClick={() => setClose(h)}>{hour(h)}</button>)}</div>
      {!branch && (
        <>
          <span className="o-label">{t('الطاولات', 'Tables')}</span>
          <div className="o-chips wrap">
            {branches.map(b => <button key={b.id} type="button" className={`o-chip ${copy === b.id ? 'active' : ''}`} onClick={() => setCopy(b.id)}><Copy />{t(`انسخ طاولات ${branchName(b)}`, `Copy ${branchName(b)} tables`)}</button>)}
            <button type="button" className={`o-chip ${copy === null ? 'active' : ''}`} onClick={() => setCopy(null)}>{t('ابدأ بدون طاولات', 'Start with none')}</button>
          </div>
          <p className="o-note"><Copy />{t(`يأخذ الفرع المنيو الحالي كما هو، وتبدأ طلباته بالحرف ${nextPrefix(branches)[0]}.`, `The branch gets the current menu as is, and its orders start with ${nextPrefix(branches)[0]}.`)}</p>
        </>
      )}
    </Sheet>
  )
}
