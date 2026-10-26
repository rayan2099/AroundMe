import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { Building2, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Plus, Send, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { Sheet, useT } from './Owner'
import type { Branch } from './Ops'

// Staff and what each person may see and do. A section is visible only with its «view» permission;
// every button inside a section checks its own action permission, so anything not granted is hidden, not disabled.
type T2 = [string, string]
export type Perm =
  | 'overview.view'
  | 'orders.view' | 'orders.handle' | 'orders.problem' | 'orders.pause'
  | 'tables.view' | 'tables.seat' | 'tables.edit'
  | 'messages.view' | 'messages.reply'
  | 'tomorrow.view' | 'tomorrow.check'
  | 'offers.view' | 'offers.send' | 'offers.auto'
  | 'meetups.view' | 'meetups.act'
  | 'insights.view'
  | 'menu.view' | 'menu.soldout' | 'menu.edit'
  | 'branches.manage' | 'staff.manage'

// The catalogue, grouped by dashboard section: the first entry of each group is what makes the section visible.
export const PERM_GROUPS: { id: string; name: T2; perms: [Perm, T2, T2][] }[] = [
  { id: 'orders', name: ['الطلبات', 'Orders'], perms: [
    ['orders.view', ['يرى الطلبات', 'See orders'], ['قائمة الطلبات وحالتها', 'The order list and status']],
    ['orders.handle', ['يقبل ويجهّز ويسلّم', 'Accept, prepare, hand over'], ['ينقل الطلب من جديد إلى تم التسليم', 'Moves an order from new to handed over']],
    ['orders.problem', ['يبلغ عن مشكلة', 'Report a problem'], ['نفاد صنف مع إعادة المبلغ، أو تأخير', 'Out of an item with refund, or a delay']],
    ['orders.pause', ['يوقف الطلبات مؤقتًا', 'Pause orders'], ['يوقف استقبال الطلبات الجديدة', 'Stops new orders coming in']],
  ] },
  { id: 'tables', name: ['الطاولات', 'Tables'], perms: [
    ['tables.view', ['يرى الطاولات والحجوزات', 'See tables and bookings'], ['حالة كل طاولة وحجوزات اليوم', 'Each table and today’s bookings']],
    ['tables.seat', ['يُجلس العملاء ويسجّل الوصول', 'Seat people, mark arrivals'], ['وصلوا، غادروا، لم يحضروا', 'Arrived, left, no-show']],
    ['tables.edit', ['يضيف ويعدّل الطاولات', 'Add and edit tables'], ['الاسم والموقع والمقاعد ووقت الجلسة', 'Name, area, seats, sitting time']],
  ] },
  { id: 'messages', name: ['الرسائل', 'Messages'], perms: [
    ['messages.view', ['يقرأ الرسائل', 'Read messages'], ['محادثات العملاء', 'Customer chats']],
    ['messages.reply', ['يرد على العملاء', 'Reply to customers'], ['يكتب ويرسل الردود', 'Writes and sends replies']],
  ] },
  { id: 'tomorrow', name: ['جدول الغد', "Tomorrow's plan"], perms: [
    ['tomorrow.view', ['يرى جدول الغد', "See tomorrow's plan"], ['الطلبات المسبقة والحجوزات', 'Pre-orders and bookings']],
    ['tomorrow.check', ['يؤشّر على ما جهّزه', 'Tick off what is ready'], ['جهّز الطلب، جهّز الطاولة', 'Order ready, table ready']],
  ] },
  { id: 'offers', name: ['العروض', 'Offers'], perms: [
    ['offers.view', ['يرى العروض ونتائجها', 'See offers and results'], ['من عاد وكم دفع', 'Who came back and what they paid']],
    ['offers.send', ['يرسل عروض العودة', 'Send come-back offers'], ['لزيارة أو لمجموعة كاملة', 'To a visit or a whole group']],
    ['offers.auto', ['يغيّر العرض التلقائي', 'Change the automatic offer'], ['تشغيل أو إيقاف العرض بعد أول زيارة', 'Turn the first-visit offer on or off']],
  ] },
  { id: 'meetups', name: ['اللقاءات', 'Meetups'], perms: [
    ['meetups.view', ['يرى اللقاءات', 'See meetups'], ['دخل اللقاءات وسجلها', 'Meetup revenue and log']],
    ['meetups.act', ['يفعّل الأفكار ويرسل العروض', 'Turn on ideas, send offers'], ['الباقة، مكافأة المساعدين، عروض المجموعات', 'Bundle, helper perk, group offers']],
  ] },
  { id: 'insights', name: ['الأداء والنظرة العامة', 'Performance and overview'], perms: [
    ['insights.view', ['يرى صفحة الأداء', 'See Performance'], ['المبيعات والمقارنات', 'Sales and comparisons']],
    ['overview.view', ['يرى النظرة العامة لكل الفروع', 'See the all-branches overview'], ['أرقام الفروع جنبًا إلى جنب', 'Branch numbers side by side']],
  ] },
  { id: 'menu', name: ['المنيو', 'Menu'], perms: [
    ['menu.view', ['يرى المنيو', 'See the menu'], ['الأصناف والأسعار', 'Items and prices']],
    ['menu.soldout', ['يغيّر حالة «نفد»', 'Mark items sold out'], ['يوقف الصنف أو يعيده', 'Turns an item off or back on']],
    ['menu.edit', ['يعدّل الأصناف والأسعار', 'Edit items and prices'], ['يضيف ويعدّل ويحذف، ويغيّر الأقسام', 'Add, edit, delete, change sections']],
  ] },
  { id: 'admin', name: ['الإدارة', 'Admin'], perms: [
    ['branches.manage', ['يدير الفروع', 'Manage branches'], ['يضيف فرعًا ويعدّل ساعات العمل', 'Add a branch, change opening hours']],
    ['staff.manage', ['يدير الموظفين', 'Manage staff'], ['يضيف موظفين ويغيّر صلاحياتهم', 'Add staff and change their permissions']],
  ] },
]
export const ALL_PERMS = PERM_GROUPS.flatMap(g => g.perms.map(p => p[0]))

export type RoleId = 'admin' | 'manager' | 'barista' | 'host' | 'marketing' | 'custom'
export const ROLES: { id: RoleId; name: T2; sub: T2; perms: Perm[] }[] = [
  { id: 'admin', name: ['مدير عام', 'General manager'], sub: ['كل شيء، مثلك تمامًا', 'Everything, just like you'], perms: ALL_PERMS },
  { id: 'manager', name: ['مدير فرع', 'Branch manager'], sub: ['كل ما في فرعه، دون الفروع والموظفين', 'Everything in their branch, not branches or staff'], perms: ALL_PERMS.filter(p => !['branches.manage', 'staff.manage', 'overview.view'].includes(p)) },
  { id: 'barista', name: ['باريستا', 'Barista'], sub: ['الطلبات وحالة «نفد» وجدول الغد', 'Orders, sold-out and tomorrow'], perms: ['orders.view', 'orders.handle', 'orders.problem', 'tomorrow.view', 'tomorrow.check', 'menu.view', 'menu.soldout'] },
  { id: 'host', name: ['استقبال', 'Host'], sub: ['الطاولات والحجوزات والرسائل', 'Tables, bookings and messages'], perms: ['orders.view', 'orders.handle', 'tables.view', 'tables.seat', 'messages.view', 'messages.reply', 'tomorrow.view'] },
  { id: 'marketing', name: ['تسويق', 'Marketing'], sub: ['العروض واللقاءات والأداء', 'Offers, meetups and performance'], perms: ['offers.view', 'offers.send', 'offers.auto', 'meetups.view', 'meetups.act', 'insights.view'] },
]
export type Employee = { id: string; name: string; phone: string; role: RoleId; perms: Perm[]; branches: string[] | 'all'; active: boolean; invited?: boolean }
export const roleOf = (perms: Perm[]): RoleId => ROLES.find(r => r.perms.length === perms.length && r.perms.every(p => perms.includes(p)))?.id ?? 'custom'

export const SAMPLE_STAFF: Employee[] = [
  { id: 'e1', name: 'سارة', phone: '0551234567', role: 'manager', perms: ROLES[1].perms, branches: ['b1'], active: true },
  { id: 'e2', name: 'فهد', phone: '0559876543', role: 'barista', perms: ROLES[2].perms, branches: ['b1'], active: true },
  { id: 'e3', name: 'نورة', phone: '0503456789', role: 'host', perms: ROLES[3].perms, branches: ['b2'], active: true },
  { id: 'e4', name: 'خالد', phone: '0567654321', role: 'marketing', perms: ROLES[4].perms, branches: 'all', active: true },
  { id: 'e5', name: 'ريم', phone: '0532221100', role: 'custom', perms: ['orders.view', 'orders.handle', 'menu.view', 'menu.soldout', 'messages.view'], branches: ['b3'], active: false },
]

// Who is looking at the dashboard right now: the owner (everything) or a staff member being previewed.
const PermCtx = createContext<Perm[] | null>(null)
export const PermProvider = ({ perms, children }: { perms: Perm[] | null; children: ReactNode }) => <PermCtx.Provider value={perms}>{children}</PermCtx.Provider>
export function useCan() {
  const perms = useContext(PermCtx)
  return (p: Perm) => !perms || perms.includes(p)
}

function useStaffText() {
  const { t, lang } = useT()
  const pick = (x: T2) => (lang === 'ar' ? x[0] : x[1])
  const roleName = (id: RoleId) => (id === 'custom' ? t('مخصص', 'Custom') : pick(ROLES.find(r => r.id === id)!.name))
  const branchList = (e: Employee, branches: Branch[]) => (e.branches === 'all' ? t('كل الفروع', 'All branches') : branches.filter(b => (e.branches as string[]).includes(b.id)).map(b => pick(b.area)).join(t('، ', ', ')))
  const sectionsOf = (perms: Perm[]) => PERM_GROUPS.filter(g => g.perms.some(p => perms.includes(p[0])))
  return { t, pick, roleName, branchList, sectionsOf }
}

export function StaffPage({ staff, setStaff, branches, notify, onPreview }: { staff: Employee[]; setStaff: (f: (s: Employee[]) => Employee[]) => void; branches: Branch[]; notify: (s: string) => void; onPreview: (id: string) => void }) {
  const { t, pick, roleName, branchList, sectionsOf } = useStaffText()
  const [editing, setEditing] = useState<Employee | 'new' | null>(null)
  const [filter, setFilter] = useState<RoleId | 'all'>('all')
  const Fwd = useT().lang === 'ar' ? ChevronLeft : ChevronRight
  const shown = staff.filter(e => filter === 'all' || e.role === filter)
  const roleCount = (id: RoleId) => staff.filter(e => e.role === id).length
  const nStaff = (n: number) => t(n === 1 ? 'موظف واحد' : n === 2 ? 'موظفان' : n <= 10 ? `${n} موظفين` : `${n} موظفًا`, `${n} staff`)
  return (
    <div className="o-staff">
      <div className="o-offer-new">
        <span className="o-offer-new-icon"><UsersRound /></span>
        <div>
          <b>{t('فريقك', 'Your team')}</b>
          <small>{t(`${nStaff(staff.length)} · ${staff.filter(e => e.active).length} نشط`, `${staff.length} staff · ${staff.filter(e => e.active).length} active`)}</small>
        </div>
        <button type="button" className="o-offer-new-btn" onClick={() => setEditing('new')}><UserPlus />{t('أضف موظفًا', 'Add staff')}</button>
      </div>

      <div className="o-status-tabs o-btabs" role="tablist">
        <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('الكل', 'All')}<span>{staff.length}</span></button>
        {[...ROLES.map(r => r.id), 'custom' as const].filter(id => roleCount(id) > 0).map(id => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{roleName(id)}<span>{roleCount(id)}</span></button>
        ))}
      </div>

      <ul className="o-staff-list">
        {shown.map(e => {
          const secs = sectionsOf(e.perms)
          return (
            <li key={e.id} className={e.active ? '' : 'off'}>
              <button type="button" className="o-staff-main" onClick={() => setEditing(e)}>
                <span className="o-staff-av">{e.name.trim().charAt(0)}</span>
                <span className="o-staff-text">
                  <b>{e.name}<em className={`r-${e.role}`}>{roleName(e.role)}</em>{!e.active && <em className="r-off">{t('موقوف', 'Paused')}</em>}</b>
                  <small><Building2 />{branchList(e, branches)} · {t(`${secs.length} من ${PERM_GROUPS.length} أقسام`, `${secs.length} of ${PERM_GROUPS.length} sections`)}</small>
                  <span className="o-staff-secs">{secs.map(g => <i key={g.id}>{pick(g.name)}</i>)}</span>
                </span>
                <Fwd />
              </button>
              <div className="o-staff-acts">
                <button type="button" onClick={() => onPreview(e.id)}><Eye />{t('اعرض كما يراها', 'View as')}</button>
                <button type="button" onClick={() => { setStaff(s => s.map(x => (x.id === e.id ? { ...x, active: !x.active } : x))); notify(e.active ? t(`أوقفنا دخول ${e.name}`, `${e.name} can no longer sign in`) : t(`أعدنا دخول ${e.name}`, `${e.name} can sign in again`)) }}>{e.active ? <><EyeOff />{t('أوقف الدخول', 'Pause access')}</> : <><Check />{t('أعد الدخول', 'Restore access')}</>}</button>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="o-fine"><Lock />{t('يدخل الموظف برقم جواله. لا يرى إلا الأقسام والأزرار التي منحته إياها، وفي فروعه فقط.', 'Staff sign in with their phone number. They only see the sections and buttons you grant, in their branches only.')}</p>

      {editing && <EmployeeSheet start={editing === 'new' ? null : editing} branches={branches} onClose={() => setEditing(null)}
        onSave={e => {
          const isNew = editing === 'new'
          setStaff(s => (isNew ? [...s, e] : s.map(x => (x.id === e.id ? e : x))))
          setEditing(null)
          notify(isNew ? t(`أضفنا ${e.name}، وأرسلنا له دعوة برسالة نصية`, `Added ${e.name} and sent an SMS invite`) : t(`حفظنا صلاحيات ${e.name}`, `Saved ${e.name}'s permissions`))
        }}
        onDelete={e => { setStaff(s => s.filter(x => x.id !== e.id)); setEditing(null); notify(t(`حذفنا ${e.name} من الفريق`, `Removed ${e.name} from the team`)) }} />}
    </div>
  )
}

function EmployeeSheet({ start, branches, onSave, onDelete, onClose }: { start: Employee | null; branches: Branch[]; onSave: (e: Employee) => void; onDelete: (e: Employee) => void; onClose: () => void }) {
  const { t, pick, roleName } = useStaffText()
  const [e, setE] = useState<Employee>(start ?? { id: `e${Date.now()}`, name: '', phone: '', role: 'barista', perms: ROLES[2].perms, branches: branches.length > 1 ? [branches[0].id] : 'all', active: true })
  const [open, setOpen] = useState<string[]>([])
  const setPerms = (perms: Perm[]) => setE(x => ({ ...x, perms, role: roleOf(perms) }))
  const toggle = (g: typeof PERM_GROUPS[number], p: Perm) => {
    const on = e.perms.includes(p)
    const view = g.perms[0][0]
    // Turning a section off removes its actions; any action turns its section on.
    if (p === view && g.id !== 'admin' && g.id !== 'insights') setPerms(on ? e.perms.filter(x => !g.perms.some(q => q[0] === x)) : [...e.perms, p])
    else setPerms(on ? e.perms.filter(x => x !== p) : [...new Set([...e.perms, p, ...(g.id !== 'admin' && g.id !== 'insights' ? [view] : [])])])
  }
  const allSec = (g: typeof PERM_GROUPS[number], on: boolean) => setPerms(on ? [...new Set([...e.perms, ...g.perms.map(p => p[0])])] : e.perms.filter(x => !g.perms.some(q => q[0] === x)))
  const multi = branches.length > 1
  const pickBranch = (id: string) => setE(x => {
    if (id === 'all') return { ...x, branches: 'all' }
    const cur = x.branches === 'all' ? [] : x.branches
    const next = cur.includes(id) ? cur.filter(b => b !== id) : [...cur, id]
    return { ...x, branches: next }
  })
  const okPhone = /^05\d{8}$/.test(e.phone.replace(/\s/g, ''))
  const ok = e.name.trim() && okPhone && e.perms.length > 0 && (e.branches === 'all' || e.branches.length > 0)
  const seen = PERM_GROUPS.filter(g => g.perms.some(p => e.perms.includes(p[0])))
  const hidden = PERM_GROUPS.filter(g => !g.perms.some(p => e.perms.includes(p[0])))
  return (
    <Sheet title={start ? t(`صلاحيات ${start.name}`, `${start.name}'s permissions`) : t('موظف جديد', 'New staff member')} onClose={onClose} footer={
      <>
        <button type="button" className="o-primary" disabled={!ok} onClick={() => ok && onSave({ ...e, name: e.name.trim(), phone: e.phone.replace(/\s/g, '') })}>{start ? <><Check />{t('احفظ', 'Save')}</> : <><Send />{t('أضف وأرسل الدعوة', 'Add and send invite')}</>}</button>
        {start && <button type="button" className="o-text-btn danger" onClick={() => onDelete(start)}><Trash2 />{t('احذف من الفريق', 'Remove from team')}</button>}
      </>
    }>
      <label className="o-label" htmlFor="o-st-name">{t('الاسم', 'Name')}</label>
      <input id="o-st-name" className="o-field" value={e.name} maxLength={30} onChange={ev => setE(x => ({ ...x, name: ev.target.value }))} placeholder={t('مثلًا: سارة', 'e.g. Sara')} />
      <label className="o-label" htmlFor="o-st-phone">{t('رقم الجوال', 'Mobile number')}</label>
      <input id="o-st-phone" className="o-field" dir="ltr" inputMode="tel" value={e.phone} maxLength={12} onChange={ev => setE(x => ({ ...x, phone: ev.target.value.replace(/[^\d\s]/g, '') }))} placeholder="05xxxxxxxx" />
      {e.phone && !okPhone && <small className="o-field-hint warn">{t('أدخل رقمًا سعوديًا من 10 أرقام يبدأ بـ 05', 'Enter a 10-digit Saudi number starting with 05')}</small>}
      {!start && <small className="o-field-hint">{t('تصله رسالة نصية بدعوة للدخول إلى لوحة الكافيه.', 'They get an SMS invite to the café dashboard.')}</small>}

      <span className="o-label">{t('الدور', 'Role')}</span>
      <div className="o-choices">
        {ROLES.map(r => (
          <button key={r.id} type="button" className={`o-choice ${e.role === r.id ? 'active' : ''}`} aria-pressed={e.role === r.id} onClick={() => setPerms(r.perms)}>
            <i /><span><b>{pick(r.name)}</b><small>{pick(r.sub)}</small></span>
          </button>
        ))}
        {e.role === 'custom' && <div className="o-choice active"><i /><span><b>{roleName('custom')}</b><small>{t('صلاحيات اخترتها بنفسك أدناه', 'Permissions you picked below')}</small></span></div>}
      </div>

      {multi && <>
        <span className="o-label">{t('الفروع', 'Branches')}</span>
        <div className="o-chips wrap">
          <button type="button" className={`o-chip ${e.branches === 'all' ? 'active' : ''}`} onClick={() => pickBranch('all')}>{t('كل الفروع', 'All branches')}</button>
          {branches.map(b => <button key={b.id} type="button" className={`o-chip ${e.branches !== 'all' && e.branches.includes(b.id) ? 'active' : ''}`} onClick={() => pickBranch(b.id)}>{pick(b.area)}</button>)}
        </div>
        <small className="o-field-hint">{e.branches === 'all' ? t('يشمل أي فرع تضيفه لاحقًا.', 'Includes any branch you add later.') : t('لا يرى الفروع الأخرى ولا أرقامها.', "They don't see other branches or their numbers.")}</small>
      </>}

      <span className="o-label">{t('الصلاحيات بالتفصيل', 'Detailed permissions')}</span>
      <div className="o-perm-groups">
        {PERM_GROUPS.map(g => {
          const n = g.perms.filter(p => e.perms.includes(p[0])).length
          const isOpen = open.includes(g.id)
          return (
            <section key={g.id} className={`o-perm-group ${n ? 'on' : ''}`}>
              <div className="o-perm-head">
                <button type="button" className="o-perm-title" onClick={() => setOpen(o => (isOpen ? o.filter(x => x !== g.id) : [...o, g.id]))} aria-expanded={isOpen}>
                  <b>{pick(g.name)}</b>
                  <small>{n === 0 ? t('مخفي', 'Hidden') : n === g.perms.length ? t('كل الصلاحيات', 'Full access') : t(`${n} من ${g.perms.length}`, `${n} of ${g.perms.length}`)}</small>
                </button>
                <button type="button" className="o-toggle" role="switch" aria-checked={n > 0} aria-label={pick(g.name)} onClick={() => allSec(g, n === 0)}><em className={n > 0 ? 'on' : ''} /></button>
              </div>
              {(isOpen || (n > 0 && n < g.perms.length)) && (
                <div className="o-choices">
                  {g.perms.map(([p, name, sub]) => (
                    <button key={p} type="button" className={`o-choice check ${e.perms.includes(p) ? 'active' : ''}`} aria-pressed={e.perms.includes(p)} onClick={() => toggle(g, p)}>
                      <i /><span><b>{pick(name)}</b><small>{pick(sub)}</small></span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="o-perm-sum">
        <p><ShieldCheck /><span><b>{t('سيرى', 'Will see')}</b>{seen.length ? seen.map(g => pick(g.name)).join(t('، ', ', ')) : t('لا شيء بعد', 'Nothing yet')}</span></p>
        {hidden.length > 0 && <p className="off"><EyeOff /><span><b>{t('مخفي عنه', 'Hidden')}</b>{hidden.map(g => pick(g.name)).join(t('، ', ', '))}</span></p>}
      </div>
      {start && <button type="button" className="o-dashed" onClick={() => setPerms(ROLES.find(r => r.id === (start.role === 'custom' ? 'barista' : start.role))!.perms)}><Plus />{t('ابدأ من صلاحيات الدور', 'Start from the role defaults')}</button>}
    </Sheet>
  )
}
