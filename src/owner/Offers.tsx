import { useState } from 'react'
import { Armchair, Check, ChevronLeft, ChevronRight, Clock, Coffee, Crown, Gift, HeartHandshake, Hourglass, Percent, Plus, Repeat, Search, ShoppingBag, Sparkles, UserPlus, Users, Wallet } from 'lucide-react'
import { Sheet, useT } from './Owner'
import { OfferSheet, useOfferText } from './Offer'
import { MEETUPS, measure, weekFor } from './Insights'
import type { Offer } from './Offer'
import type { Ops } from './Ops'
import { RangePicker, inRange, presetRange, useRangeText } from './Range'
import type { Range } from './Range'

// Come-back offers the café has sent, and who came back because of one. Visitors stay anonymous: an order,
// booking or meetup, never a name.
type Status = 'back' | 'waiting' | 'expired'
const DAY = 86_400_000
type Target = { id: string; src: Offer['src']; about: [string, string]; sub: [string, string]; pair?: boolean; group?: number }
// Ready-made groups for busy cafés, as shares of the period's visitors (sample numbers).
const SEGMENTS: { id: string; share: number; back: number; icon: 'new' | 'lapsed' | 'top' | 'all'; name: [string, string]; sub: [string, string] }[] = [
  { id: 'new', share: 0.38, back: 0.22, icon: 'new', name: ['زاروا أول مرة', 'First-time visitors'], sub: ['لم يعودوا بعد زيارتهم الأولى', "Haven't come back after their first visit"] },
  { id: 'lapsed', share: 0.12, back: 0.15, icon: 'lapsed', name: ['انقطعوا عن الزيارة', 'Stopped coming'], sub: ['كانوا يزورونك كل أسبوع، ولم يأتوا منذ أسبوعين', 'Used to come weekly, not seen for two weeks'] },
  { id: 'top', share: 0.1, back: 0.34, icon: 'top', name: ['الأكثر إنفاقًا', 'Top spenders'], sub: ['أعلى 10% في قيمة الطلب', 'Top 10% by order value'] },
  { id: 'all', share: 1, back: 0.14, icon: 'all', name: ['كل زوار الفترة', 'Everyone in the period'], sub: ['عدا من لديه عرض لم ينتهِ', 'Except those with an active offer'] },
]
const hash = (code: string) => `\u2066#${code}\u2069`

export default function Offers({ ops, notify }: { ops: Ops; notify: (s: string) => void }) {
  const { t, sar, lang } = useT()
  const { offerText, daysText } = useOfferText()
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [picking, setPicking] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)
  const [range, setRange] = useState<Range>(() => presetRange('d30'))
  const [visits, setVisits] = useState<Range>(() => presetRange('week'))
  const [q, setQ] = useState('')
  const [more, setMore] = useState(false)
  const { rangeName } = useRangeText()
  const { offers, now } = ops
  const status = (o: Offer): Status => (o.usedAt ? 'back' : now > (o.sentAt ?? now) + o.days * DAY ? 'expired' : 'waiting')
  const list = Object.entries(offers).filter(([, o]) => o.sentAt && inRange(range, o.sentAt)).sort((a, b) => (b[1].usedAt ?? b[1].sentAt!) - (a[1].usedAt ?? a[1].sentAt!))
  const size = (o: Offer) => o.group ?? 1
  const came = (o: Offer) => (o.group ? o.returned ?? 0 : status(o) === 'back' ? 1 : 0)
  const back = list.filter(([, o]) => status(o) === 'back')
  const reached = list.reduce((s, [, o]) => s + size(o), 0)
  const cameBack = list.reduce((s, [, o]) => s + came(o), 0)
  const decided = list.filter(([, o]) => status(o) !== 'waiting').reduce((s, [, o]) => s + size(o), 0)
  const rate = decided ? Math.round((cameBack / decided) * 100) : 0
  const spent = back.reduce((s, [, o]) => s + (o.spent ?? 0), 0)
  const given = back.reduce((s, [, o]) => s + (o.saved ?? 0), 0)
  const days = (ms: number) => Math.max(0, Math.round(ms / DAY))
  const ago = (ms: number) => { const d = days(now - ms); return d === 0 ? t('اليوم', 'today') : d === 1 ? t('أمس', 'yesterday') : t(`قبل ${d === 2 ? 'يومين' : d <= 10 ? `${d} أيام` : `${d} يومًا`}`, `${d} days ago`) }
  const inDays = (d: number) => t(d === 1 ? 'يوم' : d === 2 ? 'يومان' : d <= 10 ? `${d} أيام` : `${d} يومًا`, `${d} day${d === 1 ? '' : 's'}`)
  const pick = (x?: [string, string]) => (x ? (lang === 'ar' ? x[0] : x[1]) : '')
  const kinds = (['drink', 'sweet', 'off'] as const).map(k => {
    const settled = list.filter(([, o]) => o.kind === k && status(o) !== 'waiting')
    const sent = settled.reduce((s, [, o]) => s + size(o), 0)
    const back = settled.reduce((s, [, o]) => s + came(o), 0)
    return { k, sent, came: back, pct: sent ? Math.round((back / sent) * 100) : 0 }
  })
  // The best performer needs at least two settled offers, so one lucky offer doesn't win.
  const best = [...kinds].filter(x => x.sent >= 2).sort((a, b) => b.pct - a.pct)[0]
  const kindLabel = (k: Offer['kind']) => (k === 'drink' ? t('مشروب مجاني', 'Free drink') : k === 'sweet' ? t('حلى مجاني', 'Free dessert') : t('خصم', 'Discount'))
  const KindIcon = ({ k }: { k: Offer['kind'] }) => (k === 'drink' ? <Coffee /> : k === 'sweet' ? <Gift /> : <Percent />)
  const SrcIcon = ({ s }: { s?: Offer['src'] }) => (s === 'meet' ? <HeartHandshake /> : s === 'booking' ? <Armchair /> : <ShoppingBag />)
  const count = (s: Status | 'all') => (s === 'all' ? list.length : list.filter(([, o]) => status(o) === s).length)
  const shown = list.filter(([, o]) => filter === 'all' || status(o) === filter)
  const Fwd = lang === 'ar' ? ChevronLeft : ChevronRight

  // Recent visitors who haven't had an offer yet: handed-over orders, finished bookings, and pairs who plan to meet here again.
  const people = (n: number): [string, string] => [n === 1 ? 'شخص' : n === 2 ? 'شخصين' : `${n} أشخاص`, `${n} ${n === 1 ? 'person' : 'people'}`]
  const itemsAr = (n: number) => (n === 1 ? 'صنف واحد' : n === 2 ? 'صنفان' : `${n} أصناف`)
  const tableName = (id: string) => ops.tables.find(x => x.id === id)?.name
  const targets: Target[] = [
    ...ops.orders.filter(o => o.status === 'done' && !offers[o.code]).map(o => ({ id: o.code, src: 'order' as const, about: [`طلب ${hash(o.code)} · ${people(o.ppl)[0]}`, `Order ${hash(o.code)} · ${people(o.ppl)[1]}`] as [string, string], sub: [`سُلّم اليوم · ${itemsAr(o.lines.reduce((s, l) => s + l[1], 0))}`, `Handed over today · ${o.lines.reduce((s, l) => s + l[1], 0)} items`] as [string, string] })),
    ...ops.bookings.filter(b => b.state === 'left' && !offers[b.order ?? b.code]).map(b => ({ id: b.order ?? b.code, src: 'booking' as const, about: [`حجز ${hash(b.code)} · ${b.tag[0]}`, `Booking ${hash(b.code)} · ${b.tag[1]}`] as [string, string], sub: [`${people(b.ppl)[0]} · ${tableName(b.table)?.[0] ?? ''} · غادروا اليوم`, `${people(b.ppl)[1]} · ${tableName(b.table)?.[1] ?? ''} · left today`] as [string, string] })),
    ...MEETUPS.map((m, i) => ({ m, i })).filter(({ m, i }) => ops.branch.meetups.includes(i) && m.again && !offers[`M${i}`]).map(({ m, i }) => ({ id: `M${i}`, src: 'meet' as const, pair: true, about: m.topic, sub: ['اتفقا على اللقاء هنا مرة أخرى', 'Plan to meet here again'] as [string, string] })),
  ]
  const w = weekFor(ops.branch.scale)
  const periodVisits = measure('visits', ops.branch.scale, visits)
  const offered = Object.values(offers).filter(o => o.group && status(o) !== 'expired').reduce((s, o) => s + (o.group ?? 0), 0)
  const segs = SEGMENTS.map(g => ({ ...g, n: Math.max(0, Math.round(periodVisits * g.share) - (g.id === 'all' ? offered : 0)) }))
  const weekLeft = Math.max(0, measure('visits', ops.branch.scale, presetRange('week')) - offered)
  const SegIcon = ({ k }: { k: string }) => (k === 'new' ? <UserPlus /> : k === 'lapsed' ? <Hourglass /> : k === 'top' ? <Crown /> : <Users />)
  const found = targets.filter(x => !q.trim() || `${pick(x.about)} ${x.id}`.toLowerCase().includes(q.trim().toLowerCase().replace('#', '')))
  const sendGroup = (x: Target, o: Offer) => {
    const g = SEGMENTS.find(s => s.id === x.id)!
    ops.sendGroupOffer(`G-${x.id}-${Date.now()}`, { ...o, sentAt: Date.now(), src: 'order', about: x.about, group: x.group }, g.back, w.avgOrder, n => notify(t(`عاد ${n} عميل بعرضك 🎁`, `${n} customers came back with your offer 🎁`)))
    setTarget(null)
    notify(t(`أرسلنا العرض إلى ${x.group!.toLocaleString('en-US')} عميل، وسيصلهم إشعار «افتح هديتك»`, `Offer sent to ${x.group!.toLocaleString('en-US')} customers. They get an “Open your gift” notification`))
  }
  const send = (x: Target, o: Offer) => {
    if (x.group) return sendGroup(x, o)
    ops.sendOffer(x.id, { ...o, sentAt: Date.now(), src: x.src, about: x.about, pair: x.pair }, code => notify(t(`عاد عميل بعرضك 🎁 طلب جديد ${hash(code)}`, `A customer came back with your offer 🎁 New order ${hash(code)}`)))
    setTarget(null)
    notify(t('أرسلنا العرض، وسيصله إشعار «افتح هديتك»', 'Offer sent. They get an “Open your gift” notification'))
  }

  return (
    <div className="o-offers">
      <div className="o-offer-new">
        <span className="o-offer-new-icon"><Gift /></span>
        <div>
          <b>{t('شجّع زوارك على العودة', 'Bring your visitors back')}</b>
          <small>{t(`${weekLeft.toLocaleString('en-US')} زائر في آخر 7 أيام بلا عرض بعد`, `${weekLeft.toLocaleString('en-US')} visitors in the last 7 days without an offer`)}</small>
        </div>
        <button type="button" className="o-offer-new-btn" onClick={() => setPicking(true)}><Plus />{t('عرض جديد', 'New offer')}</button>
      </div>
      <RangePicker value={range} onChange={setRange} label={t('العروض المُرسلة في', 'Offers sent in')} />
      <div className="o-offer-kpis">
        <div><Gift /><b>{reached.toLocaleString('en-US')}</b><small>{t('عميل وصله عرض', 'customers reached')}</small></div>
        <div className="good"><Repeat /><b>{cameBack.toLocaleString('en-US')}</b><small>{t(`عادوا بسببها · ${rate}%`, `came back · ${rate}%`)}</small></div>
        <div><Wallet /><b>{sar(spent)}</b><small>{t('دفعها العائدون بالعروض', 'paid by returners')}</small></div>
        <div><Sparkles /><b>{sar(given)}</b><small>{t('قيمة ما قدّمته', 'value you gave')}</small></div>
      </div>
      <p className="o-note o-note-soft"><Check /><span>{given > 0 && <b>{t(`كل 1 ر.س قدّمته أعاد لك ${(spent / given).toFixed(1)} ر.س من المبيعات. `, `Every SAR 1 you gave brought back SAR ${(spent / given).toFixed(1)} in sales. `)}</b>}{t('يُحتسب العرض مستخدمًا عندما يطلب به العميل أو يستلم هديته من التطبيق.', 'An offer counts as used when the customer orders with it or claims the gift in the app.')}</span></p>

      <section className="o-card">
        <h3>{t('أي العروض تعيدهم أكثر؟', 'Which offers bring people back?')}</h3>
        <ul className="o-top-items o-offer-kinds-chart">
          {kinds.map(x => (
            <li key={x.k}>
              <span className="o-top-name"><KindIcon k={x.k} />{kindLabel(x.k)}</span>
              <span className="o-top-bar"><i style={{ width: `${x.pct}%` }} /></span>
              <b>{x.pct}%</b>
              <small>{t(`${x.came} من ${x.sent}`, `${x.came} of ${x.sent}`)}</small>
            </li>
          ))}
        </ul>
        {best && best.pct > 0 && <p className="o-card-sub">{t(`«${kindLabel(best.k)}» هو الأنجح عندك حتى الآن.`, `“${kindLabel(best.k)}” works best for you so far.`)}</p>}
      </section>

      <button type="button" className="o-switch-row o-auto-offer" role="switch" aria-checked={ops.autoOffer} onClick={() => ops.setAutoOffer(v => !v)}>
        <span><b>{t('عرض تلقائي بعد أول زيارة', 'Automatic offer after a first visit')}</b><small>{ops.autoOffer ? t('يصل كل زائر جديد مشروب مجاني صالح أسبوعين، في اليوم التالي لزيارته', 'Every new visitor gets a free drink, valid 2 weeks, the day after their visit') : t('أرسل العروض بنفسك من الطلبات والحجوزات واللقاءات', 'Send offers yourself from orders, bookings and meetups')}</small></span>
        <em className={ops.autoOffer ? 'on' : ''} />
      </button>

      <div className="o-chips wrap o-offer-filter">
        {(['all', 'back', 'waiting', 'expired'] as const).map(f => (
          <button key={f} type="button" className={`o-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? t('الكل', 'All') : f === 'back' ? t('عادوا', 'Came back') : f === 'waiting' ? t('بانتظار العودة', 'Waiting') : t('انتهت', 'Expired')}<span className="o-count">{count(f)}</span>
          </button>
        ))}
      </div>

      <ul className="o-offer-list">
        {shown.map(([id, o]) => {
          const st = status(o)
          const left = days((o.sentAt ?? now) + o.days * DAY - now)
          return (
            <li key={id} className={`st-${st}`}>
              <span className="o-offer-kind"><KindIcon k={o.kind} /></span>
              <div>
                <b>{offerText(o, o.pair)}</b>
                <small>{o.group ? <Users /> : <SrcIcon s={o.src} />}{pick(o.about)}{o.group ? t(` · ${o.group.toLocaleString('en-US')} عميل`, ` · ${o.group.toLocaleString('en-US')} customers`) : ''} · {t(`أُرسل ${ago(o.sentAt!)}`, `sent ${ago(o.sentAt!)}`)}</small>
                <span className={`o-offer-status s-${st}`}>
                  {o.group ? (st === 'back' ? <><Check />{t(`عاد ${o.returned} من ${o.group.toLocaleString('en-US')} · طلبوا ودفعوا ${sar((o.spent ?? 0).toLocaleString('en-US'))}`, `${o.returned} of ${o.group.toLocaleString('en-US')} came back · paid ${sar((o.spent ?? 0).toLocaleString('en-US'))}`)}</> : st === 'waiting' ? <><Clock />{t(`لم يعد أحد بعد · بقي ${inDays(Math.max(1, left))}`, `No one back yet · ${inDays(Math.max(1, left))} left`)}</> : t(`انتهى بعد ${daysText(o.days)} دون عودة`, `Expired after ${daysText(o.days)}, no return`))
                  : st === 'back' ? <><Check />{o.spent ? t(`${o.pair ? 'عادا' : 'عاد'} ${ago(o.usedAt!)} · طلب ودفع ${sar(o.spent)}${o.order ? ` · ${hash(o.order)}` : ''}`, `Came back ${ago(o.usedAt!)} · ordered and paid ${sar(o.spent)}${o.order ? ` · ${hash(o.order)}` : ''}`) : t(`${o.pair ? 'عادا واستلما' : 'عاد واستلم'} ${o.kind === 'sweet' ? 'الحلى' : 'المشروب'} مجانًا ${ago(o.usedAt!)}${o.order ? ` · ${hash(o.order)}` : ''}`, `Came back and claimed it ${ago(o.usedAt!)}${o.order ? ` · ${hash(o.order)}` : ''}`)}</>
                    : st === 'waiting' ? <><Clock />{t(`لم ${o.pair ? 'يعودا' : 'يعد'} بعد · بقي ${inDays(Math.max(1, left))}`, `Not back yet · ${inDays(Math.max(1, left))} left`)}</>
                    : t(`انتهى بعد ${daysText(o.days)} دون عودة`, `Expired after ${daysText(o.days)}, no return`)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {picking && (
        <Sheet title={t('لمن العرض؟', 'Who is it for?')} onClose={() => setPicking(false)}>
          <p className="o-sheet-sub">{t('أرسل عرضًا واحدًا لمجموعة كاملة، أو اختر زيارة بعينها. يصل العرض عبر التطبيق دون أن يظهر لك أي اسم.', 'Send one offer to a whole group, or pick a single visit. It goes through the app, and you never see a name.')}</p>
          <RangePicker value={visits} onChange={setVisits} label={t('زوار أي فترة؟', 'Visitors from when?')} />
          <section className="o-tm-group">
            <h4>{t('مجموعات جاهزة', 'Ready-made groups')}<small>{t(`${periodVisits.toLocaleString('en-US')} زيارة · ${rangeName(visits)}`, `${periodVisits.toLocaleString('en-US')} visits · ${rangeName(visits)}`)}</small></h4>
            <div className="o-offer-pick">
              {segs.map(g => (
                <button key={g.id} type="button" disabled={!g.n} onClick={() => { setPicking(false); setTarget({ id: g.id, src: 'order', about: g.name, sub: g.sub, group: g.n }) }}>
                  <span className="o-offer-kind"><SegIcon k={g.icon} /></span>
                  <span><b>{pick(g.name)}</b><small>{pick(g.sub)} · {t(`يعود عادةً \u2066${Math.round(g.back * 100)}%\u2069`, `usually ${Math.round(g.back * 100)}% come back`)}</small></span>
                  <em className="o-seg-n">{g.n.toLocaleString('en-US')}</em>
                  <Fwd />
                </button>
              ))}
            </div>
          </section>
          <section className="o-tm-group">
            <h4>{t('أو زيارة بعينها', 'Or a single visit')}<small>{t(`اليوم · ${targets.length}`, `Today · ${targets.length}`)}</small></h4>
            <label className="o-search"><Search /><input value={q} onChange={e => setQ(e.target.value)} placeholder={t('ابحث برقم الطلب أو الحجز، مثل A25', 'Search by order or booking number, e.g. A25')} /></label>
            <div className="o-offer-pick">
              {(more || q ? found : found.slice(0, 4)).map(x => (
                <button key={x.id} type="button" onClick={() => { setPicking(false); setTarget(x) }}>
                  <span className="o-offer-kind"><SrcIcon s={x.src} /></span>
                  <span><b>{pick(x.about)}</b><small>{pick(x.sub)}</small></span>
                  <Fwd />
                </button>
              ))}
              {!found.length && <p className="o-empty">{q ? t('لا توجد زيارة بهذا الرقم.', 'No visit with that number.') : t('أرسلت عروضًا لكل زوار اليوم.', "You've sent offers to everyone from today.")}</p>}
              {!q && !more && found.length > 4 && <button type="button" className="o-text-btn o-show-more" onClick={() => setMore(true)}>{t(`اعرض الكل (${found.length})`, `Show all (${found.length})`)}</button>}
            </div>
          </section>
        </Sheet>
      )}
      {target && (
        <OfferSheet pair={target.pair} count={target.group} onClose={() => setTarget(null)} onSend={o => send(target, o)}
          about={<p className="o-offer-for">{target.group ? <Users /> : <SrcIcon s={target.src} />}<span><b>{pick(target.about)}{target.group ? t(` · ${target.group.toLocaleString('en-US')} عميل`, ` · ${target.group.toLocaleString('en-US')} customers`) : ''}</b><small>{pick(target.sub)}</small></span></p>} />
      )}
    </div>
  )
}
