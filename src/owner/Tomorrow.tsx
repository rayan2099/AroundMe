import { Armchair, CalendarClock, Check, ChefHat, CircleAlert, HeartHandshake, Lock, ShoppingBag, Store, Users } from 'lucide-react'
import { useT } from './Owner'
import { MEETUPS, TOMORROW } from './Insights'
import type { Visit } from './Insights'
import type { Ops } from './Ops'
import type { Item } from './data'

// «الغد»: everything a branch needs to be ready for tomorrow, in one place. Planned visits come with their
// time, party size, table and pre-order, never a name. The checklist is built from those visits, and the
// owner ticks it off as the team gets ready.
type T2 = [string, string]
type Task = { id: string; group: 'team' | 'meet' | 'menu'; text: string; sub?: string; warn?: boolean }
const FIRST_HOUR = 7, LAST_HOUR = 23

// A smaller branch gets fewer of the sample visits, so each branch's tomorrow looks like its own.
export const visitsFor = (scale: number) => TOMORROW.filter((_, i) => scale >= 1 || i % 2 === 0)

export default function Tomorrow({ ops, items, done, setDone, openMenu }: { ops: Ops; items: Item[]; done: string[]; setDone: (f: (d: string[]) => string[]) => void; openMenu: () => void }) {
  const { t, tx, lang } = useT()
  const pick = (x: T2) => (lang === 'ar' ? x[0] : x[1])
  const loc = lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-US'
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1)
  const dateText = `${tmr.toLocaleDateString(loc, { weekday: 'long' })} ${tmr.toLocaleDateString(loc, { day: 'numeric', month: 'long' })}`
  const clock = (h: number, m = 0) => lang === 'ar' ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
  const hourText = (h: number) => (lang === 'ar' ? `${h % 12 || 12} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`)
  const people = (p: number) => t(p === 1 ? 'شخص واحد' : p === 2 ? 'شخصان' : `${p} أشخاص`, `${p} ${p === 1 ? 'person' : 'people'}`)
  const itemOf = (en: string) => items.find(i => i.name.en === en)
  const itemName = (en: string) => { const it = itemOf(en); return it ? tx(it.name) : en }

  const visits = visitsFor(ops.branch.scale)
  const guests = visits.reduce((s, v) => s + v.ppl, 0)
  const withOrder = visits.filter(v => v.order)
  const withSeat = visits.filter(v => v.seat)
  const need = visits.filter(v => v.kind === 'need'), help = visits.filter(v => v.kind === 'help')
  const repeat = MEETUPS.filter((m, i) => ops.branch.meetups.includes(i) && m.again).length

  // Guests expected each hour (a visit counts for the hour it starts and the next one: people stay).
  const load = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => {
    const h = FIRST_HOUR + i
    return visits.filter(v => v.at[0] === h || v.at[0] === h - 1).reduce((s, v) => s + v.ppl, 0)
  })
  const peak = load.indexOf(Math.max(...load))
  const peakH = FIRST_HOUR + peak
  const maxLoad = Math.max(1, ...load)

  // Pre-ordered items, summed, with when the first one is needed.
  const prep = Object.values(withOrder.reduce<Record<string, { en: string; qty: number; at: [number, number] }>>((acc, v) => {
    v.order!.forEach(([en, q]) => { acc[en] ??= { en, qty: 0, at: v.at }; acc[en].qty += q })
    return acc
  }, {})).sort((a, b) => b.qty - a.qty)
  const soldOutNeeded = prep.filter(p => itemOf(p.en)?.soldOut)

  const mins = (v: Visit) => v.at[0] * 60 + v.at[1]
  const helpers = [...need, ...help].sort((a, b) => mins(a) - mins(b))
  const orderText = (o: [string, number][]) => o.map(([en, q]) => `${q > 1 ? `${q} ` : ''}${itemName(en)}`).join(t('، ', ', '))
  const kindLabel = (k: Visit['kind']) => k === 'visit' ? t('زيارة فقط', 'Just visiting') : k === 'need' ? t('يحتاج مساعدة', 'Needs help') : t('يستطيع المساعدة', 'Can help')
  const vid = (v: Visit) => `v-${v.at.join(':')}-${v.tag[1]}`

  // Before opening: what has to be settled before the first guest walks in.
  const before: Task[] = [
    ...soldOutNeeded.map(p => ({ id: `so-${p.en}`, group: 'menu' as const, warn: true, text: t(`«${itemName(p.en)}» نافد الآن، وعليه ${p.qty} طلب مسبق غدًا`, `“${itemName(p.en)}” is sold out now, with ${p.qty} pre-ordered for tomorrow`), sub: t('جهّزه وأعد تفعيله في المنيو قبل الافتتاح', 'Make it and turn it back on in the menu before opening') })),
    { id: 'team-open', group: 'team', text: t(`الفريق جاهز قبل الافتتاح ${hourText(ops.branch.hours[0] % 24)}`, `Team ready before opening at ${hourText(ops.branch.hours[0] % 24)}`), sub: t(`أول زيارة ${visits[0] ? clock(...visits[0].at) : '—'}`, `First visit at ${visits[0] ? clock(...visits[0].at) : '—'}`) },
    { id: 'team-peak', group: 'team', text: t(`موظف إضافي من ${hourText(peakH - 1)} إلى ${hourText(peakH + 2)}`, `An extra team member from ${hourText(peakH - 1)} to ${hourText(peakH + 2)}`), sub: t(`الذروة نحو ${hourText(peakH)}، قرابة ${load[peak]} أشخاص`, `Peak around ${hourText(peakH)}, about ${load[peak]} people`) },
    ...(helpers.length ? [{ id: 'meet-seats', group: 'meet' as const, text: t('أبقِ طاولتين هادئتين للقاءات', 'Keep two quiet tables free for meetups'), sub: t(`من ${clock(...helpers[0].at)} إلى ${clock(...helpers.at(-1)!.at)}`, `From ${clock(...helpers[0].at)} to ${clock(...helpers.at(-1)!.at)}`) }] : []),
  ]
  // During the day: one row per visit, in time order. A visit with a table or a pre-order is something to get ready.
  const actionable = visits.filter(v => v.seat || v.order)
  const ids = new Set([...before.map(x => x.id), ...actionable.map(vid)])
  const doneHere = done.filter(id => ids.has(id))
  const total = ids.size
  const pct = total ? Math.round((doneHere.length / total) * 100) : 100
  const toggle = (id: string) => setDone(d => (d.includes(id) ? d.filter(x => x !== id) : [...d, id]))
  const next = actionable.find(v => !doneHere.includes(vid(v)))
  const beforeLeft = before.filter(x => !doneHere.includes(x.id)).length

  const PARTS: [T2, number][] = [[['الصباح', 'Morning'], 12], [['الظهر', 'Midday'], 15], [['العصر', 'Afternoon'], 18], [['المساء', 'Evening'], 24]]
  const parts = PARTS.map(([label, end], i) => ({ label, visits: visits.filter(v => v.at[0] < end && v.at[0] >= (i ? PARTS[i - 1][1] : 0)) })).filter(g => g.visits.length)
  const Check2 = ({ on }: { on: boolean }) => <i>{on && <Check />}</i>

  return (
    <div className="o-tmr">
      <section className="o-card o-tmr-hero">
        <div className="o-tmr-hero-top">
          <div>
            <h3><CalendarClock />{t('جاهزية الغد', 'Ready for tomorrow')}</h3>
            <p className="o-card-sub">{dateText}</p>
          </div>
          <div className={`o-tmr-ring ${pct === 100 ? 'done' : ''}`} style={{ ['--p' as string]: `${pct}%` }} aria-label={t(`${pct}% جاهز`, `${pct}% ready`)}><b>{pct}%</b></div>
        </div>
        <p className="o-tmr-status">{pct === 100 ? t('كل شيء جاهز للغد 👌', 'All set for tomorrow 👌') : t(`أُنجز ${doneHere.length} من ${total}`, `${doneHere.length} of ${total} done`)}</p>
        {next && (
          <div className="o-tmr-next">
            <small>{beforeLeft ? t(`ابدأ بـ«قبل الافتتاح» (${beforeLeft})، ثم أول تجهيز:`, `Start with “Before opening” (${beforeLeft}), then the first one:`) : t('التالي', 'Next up')}</small>
            <b><span>{clock(...next.at)}</span>{[next.seat && t(`جهّز ${pick(next.seat)}`, `Set ${pick(next.seat).toLowerCase()}`), next.order && orderText(next.order)].filter(Boolean).join(' · ')}</b>
          </div>
        )}
        <div className="o-tmr-kpis">
          <div><b>{visits.length}</b><small>{t('زيارة مجدولة', 'planned visits')}</small></div>
          <div><b>{guests}</b><small>{t('شخصًا متوقعًا', 'guests expected')}</small></div>
          <div><b>{withOrder.length}</b><small>{t('طلب مسبق مدفوع', 'paid pre-orders')}</small></div>
          <div><b>{withSeat.length}</b><small>{t('طاولة محجوزة', 'tables booked')}</small></div>
          <div className="need"><b>{need.length}</b><small>{t('يحتاجون مساعدة', 'need help')}</small></div>
          <div className="help"><b>{help.length}</b><small>{t('يستطيعون المساعدة', 'can help')}</small></div>
        </div>
      </section>

      <div className="o-tmr-main">
        <section className="o-card o-tmr-tasks">
          <div className="o-tmr-group">
            <h4><span className="o-tmr-step">1</span>{t('قبل الافتتاح', 'Before opening')}<small>{before.length - beforeLeft}/{before.length}</small></h4>
            <ul>
              {before.map(x => {
                const on = doneHere.includes(x.id)
                return (
                  <li key={x.id} className={`${on ? 'on' : ''} ${x.warn ? 'warn' : ''}`}>
                    <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(x.id)}>
                      <Check2 on={on} />
                      <span className="o-tmr-ic">{x.group === 'menu' ? <CircleAlert /> : x.group === 'meet' ? <HeartHandshake /> : <Users />}</span>
                      <span><b>{x.text}</b>{x.sub && <small>{x.sub}</small>}</span>
                    </button>
                    {x.group === 'menu' && !on && <button type="button" className="o-tmr-link" onClick={openMenu}>{t('افتح المنيو', 'Open menu')}</button>}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="o-tmr-group">
            <h4><span className="o-tmr-step">2</span>{t('خلال اليوم', 'During the day')}<small>{actionable.filter(v => doneHere.includes(vid(v))).length}/{actionable.length}</small></h4>
            <p className="o-card-sub">{t('بالترتيب حسب الوقت. علّم الزيارة «جاهزة» بعد تجهيز طاولتها وطلبها.', 'In time order. Mark a visit ready once its table and order are set.')}</p>
            {parts.map(g => (
              <section key={g.label[1]} className="o-tmr-part">
                <h5>{pick(g.label)}<small>{t(`${g.visits.length} زيارات`, `${g.visits.length} visits`)}</small></h5>
                <ul>
                  {g.visits.map(v => {
                    const act = !!(v.seat || v.order), on = doneHere.includes(vid(v)), isNext = next === v
                    return (
                      <li key={vid(v)} className={`${on ? 'on' : ''} ${act ? 'act' : 'info'} ${isNext ? 'next' : ''}`}>
                        <span className="o-tmr-time">{clock(...v.at)}</span>
                        <div className="o-tmr-what">
                          <b>{pick(v.tag)}<em className={`o-kind o-kind-${v.kind}`}>{kindLabel(v.kind)}</em></b>
                          <small>{people(v.ppl)}</small>
                          {v.seat && <span className="o-tmr-do"><Armchair />{t(`جهّز ${pick(v.seat)}`, `Set ${pick(v.seat).toLowerCase()}`)}</span>}
                          {v.order && <span className="o-tmr-do"><ShoppingBag />{orderText(v.order)}</span>}
                        </div>
                        {act && <button type="button" role="checkbox" aria-checked={on} className="o-tmr-ready" onClick={() => toggle(vid(v))}><Check2 on={on} />{on ? t('جاهزة', 'Ready') : t('جاهزة؟', 'Ready?')}</button>}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
          <p className="o-note"><Lock />{t('لا نعرض الأسماء ولا الصور. يظهر لك الوقت والعدد وسبب الزيارة فقط.', 'No names or photos. You only see the time, party size and reason for the visit.')}</p>
        </section>

        <aside className="o-tmr-side">
          <section className="o-card o-tmr-load">
            <h3>{t('الازدحام المتوقع', 'Expected crowd')}</h3>
            <p className="o-card-sub">{t(`الذروة نحو ${hourText(peakH)}`, `Peak around ${hourText(peakH)}`)}</p>
            <div className="o-hours" dir="ltr">
              {load.map((v, i) => <span key={i} className={`o-hour ${i === peak ? 'on' : ''}`} title={`${hourText(FIRST_HOUR + i)} · ${v}`}><i style={{ height: `${Math.max(4, (v / maxLoad) * 100)}%` }} /></span>)}
            </div>
            <div className="o-hours-axis" dir="ltr">{[7, 11, 15, 19, 22].map(h => <span key={h} dir={lang === 'ar' ? 'rtl' : 'ltr'}>{hourText(h)}</span>)}</div>
          </section>

          {prep.length > 0 && (
            <section className="o-card">
              <h3><ChefHat />{t('ملخص التحضير', 'Prep summary')}</h3>
              <p className="o-card-sub">{t('مجموع الطلبات المسبقة لكل صنف، ووقت أول استلام', 'Pre-ordered totals per item, and the first pickup')}</p>
              <ul className="o-tmr-prep">
                {prep.map(p => <li key={p.en} className={itemOf(p.en)?.soldOut ? 'warn' : ''}><b>{p.qty}</b><span>{itemName(p.en)}</span><small>{clock(...p.at)}</small></li>)}
              </ul>
            </section>
          )}

          {helpers.length > 0 && (
            <section className="o-card o-meet-tmr">
              <h3><HeartHandshake />{t('اللقاءات غدًا', 'Meetups tomorrow')}</h3>
              <div className="o-tomorrow-row">
                <div className="need"><b>{need.length}</b><small>{t('يحتاجون مساعدة', 'need help')}</small></div>
                <div className="help"><b>{help.length}</b><small>{t('يستطيعون المساعدة', 'can help')}</small></div>
                <div><b>{repeat}</b><small>{t('لقاءات متكررة متوقعة', 'repeat meetups expected')}</small></div>
              </div>
              {need.length > help.length && <p className="o-note"><Store />{t(`من يحتاجون المساعدة أكثر ممن يستطيعون بـ ${need.length - help.length}. عرض صغير لمن يساعد قد يحسم اختياره لكافيهك.`, `${need.length - help.length} more ${need.length - help.length === 1 ? 'person needs' : 'people need'} help than can help. A small perk for helpers could make them pick your café.`)}</p>}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
