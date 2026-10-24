import { useState } from 'react'
import { Armchair, Check, ChevronLeft, ChevronRight, Clock, Coffee, Gift, HeartHandshake, Percent, Plus, Repeat, ShoppingBag, Sparkles, TrendingUp, Wallet } from 'lucide-react'
import { Sheet, useT } from './Owner'
import { OfferSheet, useOfferText } from './Offer'
import { MEETUPS } from './Insights'
import type { Offer } from './Offer'
import type { Ops } from './Ops'

// Come-back offers the café has sent, and who came back because of one. Visitors stay anonymous: an order,
// booking or meetup, never a name.
type Status = 'back' | 'waiting' | 'expired'
const DAY = 86_400_000
type Target = { id: string; src: Offer['src']; about: [string, string]; sub: [string, string]; pair?: boolean }
const hash = (code: string) => `\u2066#${code}\u2069`

export default function Offers({ ops, notify }: { ops: Ops; notify: (s: string) => void }) {
  const { t, sar, lang } = useT()
  const { offerText, daysText } = useOfferText()
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [picking, setPicking] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)
  const { offers, now } = ops
  const status = (o: Offer): Status => (o.usedAt ? 'back' : now > (o.sentAt ?? now) + o.days * DAY ? 'expired' : 'waiting')
  const list = Object.entries(offers).filter(([, o]) => o.sentAt).sort((a, b) => (b[1].usedAt ?? b[1].sentAt!) - (a[1].usedAt ?? a[1].sentAt!))
  const back = list.filter(([, o]) => status(o) === 'back')
  const decided = list.filter(([, o]) => status(o) !== 'waiting').length
  const rate = decided ? Math.round((back.length / decided) * 100) : 0
  const spent = back.reduce((s, [, o]) => s + (o.spent ?? 0), 0)
  const given = back.reduce((s, [, o]) => s + (o.saved ?? 0), 0)
  const days = (ms: number) => Math.max(0, Math.round(ms / DAY))
  const ago = (ms: number) => { const d = days(now - ms); return d === 0 ? t('اليوم', 'today') : d === 1 ? t('أمس', 'yesterday') : t(`قبل ${d === 2 ? 'يومين' : d <= 10 ? `${d} أيام` : `${d} يومًا`}`, `${d} days ago`) }
  const inDays = (d: number) => t(d === 1 ? 'يوم' : d === 2 ? 'يومان' : d <= 10 ? `${d} أيام` : `${d} يومًا`, `${d} day${d === 1 ? '' : 's'}`)
  const pick = (x?: [string, string]) => (x ? (lang === 'ar' ? x[0] : x[1]) : '')
  const kinds = (['drink', 'sweet', 'off'] as const).map(k => {
    const sent = list.filter(([, o]) => o.kind === k && status(o) !== 'waiting')
    const came = sent.filter(([, o]) => status(o) === 'back').length
    return { k, sent: sent.length, came, pct: sent.length ? Math.round((came / sent.length) * 100) : 0 }
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
  const groups: [Offer['src'], string][] = [['order', t('طلبات سُلّمت اليوم', 'Orders handed over today')], ['booking', t('حجوزات انتهت', 'Finished bookings')], ['meet', t('لقاءات', 'Meetups')]]
  const send = (x: Target, o: Offer) => {
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
          <small>{targets.length ? t(`${targets.length === 1 ? 'زائر واحد' : targets.length === 2 ? 'زائران' : `${targets.length} زوار`} من اليوم بلا عرض بعد`, `${targets.length} recent visitor${targets.length === 1 ? '' : 's'} without an offer yet`) : t('أرسلت عروضًا لكل زوار اليوم', "You've sent offers to everyone from today")}</small>
        </div>
        <button type="button" className="o-offer-new-btn" disabled={!targets.length} onClick={() => setPicking(true)}><Plus />{t('عرض جديد', 'New offer')}</button>
      </div>
      <div className="o-offer-kpis">
        <div><Gift /><b>{list.length}</b><small>{t('عرض أُرسل', 'offers sent')}</small></div>
        <div className="good"><Repeat /><b>{back.length}</b><small>{t(`عادوا بسببها · ${rate}%`, `came back · ${rate}%`)}</small></div>
        <div><Wallet /><b>{sar(spent)}</b><small>{t('دفعها العائدون بالعروض', 'paid by returners')}</small></div>
        <div><Sparkles /><b>{sar(given)}</b><small>{t('قيمة ما قدّمته', 'value you gave')}</small></div>
      </div>
      <p className="o-note o-note-soft"><Check />{t('نحتسب العرض مستخدمًا عندما يطلب به العميل من التطبيق: يدفع طلبه بالعرض، أو يستلم المشروب المجاني. لا حاجة لأي تحقق عند الكاونتر.', 'An offer counts as used when the customer orders with it in the app: they pay for an order with it, or claim the free item. Nothing to check at the counter.')}</p>
      {given > 0 && <p className="o-note"><TrendingUp />{t(`كل 1 ر.س قدّمته في العروض أعاد لك ${(spent / given).toFixed(1)} ر.س من المبيعات.`, `Every SAR 1 you gave in offers brought back SAR ${(spent / given).toFixed(1)} in sales.`)}</p>}

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
                <small><SrcIcon s={o.src} />{pick(o.about)} · {t(`أُرسل ${ago(o.sentAt!)}`, `sent ${ago(o.sentAt!)}`)}</small>
                <span className={`o-offer-status s-${st}`}>
                  {st === 'back' ? <><Check />{o.spent ? t(`${o.pair ? 'عادا' : 'عاد'} ${ago(o.usedAt!)} · طلب ودفع ${sar(o.spent)}${o.order ? ` · ${hash(o.order)}` : ''}`, `Came back ${ago(o.usedAt!)} · ordered and paid ${sar(o.spent)}${o.order ? ` · ${hash(o.order)}` : ''}`) : t(`${o.pair ? 'عادا واستلما' : 'عاد واستلم'} ${o.kind === 'sweet' ? 'الحلى' : 'المشروب'} مجانًا ${ago(o.usedAt!)}${o.order ? ` · ${hash(o.order)}` : ''}`, `Came back and claimed it ${ago(o.usedAt!)}${o.order ? ` · ${hash(o.order)}` : ''}`)}</>
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
          <p className="o-sheet-sub">{t('اختر زيارة، ويصل العرض إلى صاحبها عبر التطبيق دون أن يظهر لك اسمه.', 'Pick a visit. The offer reaches them through the app, and you never see their name.')}</p>
          {groups.map(([src, title]) => {
            const xs = targets.filter(x => x.src === src)
            return xs.length > 0 && (
              <section key={src} className="o-tm-group">
                <h4>{title}<small>{xs.length}</small></h4>
                <div className="o-offer-pick">
                  {xs.map(x => (
                    <button key={x.id} type="button" onClick={() => { setPicking(false); setTarget(x) }}>
                      <span className="o-offer-kind"><SrcIcon s={x.src} /></span>
                      <span><b>{pick(x.about)}</b><small>{pick(x.sub)}</small></span>
                      <Fwd />
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </Sheet>
      )}
      {target && (
        <OfferSheet pair={target.pair} onClose={() => setTarget(null)} onSend={o => send(target, o)}
          about={<p className="o-offer-for"><SrcIcon s={target.src} /><span><b>{pick(target.about)}</b><small>{pick(target.sub)}</small></span></p>} />
      )}
    </div>
  )
}
