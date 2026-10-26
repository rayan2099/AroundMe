import { Armchair, CalendarClock, Check, ChefHat, CircleAlert, HeartHandshake, Lock, ShoppingBag, Store } from 'lucide-react'
import { useT } from './Owner'
import { useCan } from './Staff'
import { MEETUPS, TOMORROW } from './Insights'
import type { Visit } from './Insights'
import type { Ops } from './Ops'
import type { Item } from './data'

// «الغد»: everything a branch needs to be ready for tomorrow, in one place. Planned visits come with their
// time, party size, table and pre-order, never a name. The checklist is built from those visits, and the
// owner ticks it off as the team gets ready.
type T2 = [string, string]
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
  }, {})).sort((a, b) => a.at[0] * 60 + a.at[1] - (b.at[0] * 60 + b.at[1]) || b.qty - a.qty)
  const soldOutNeeded = prep.filter(p => itemOf(p.en)?.soldOut)

  const mins = (v: Visit) => v.at[0] * 60 + v.at[1]
  const helpers = [...need, ...help].sort((a, b) => mins(a) - mins(b))
  const orderText = (o: [string, number][]) => o.map(([en, q]) => `${q > 1 ? `${q} ` : ''}${itemName(en)}`).join(t('، ', ', '))
  // Tomorrow's paid pre-orders and table bookings, with codes from the branch's letters, in time order.
  type Job = { v: Visit; order?: string; booking?: string }
  let on = 101, bn = 21
  const jobs: Job[] = visits.filter(v => v.seat || v.order).map(v => ({ v, order: v.order ? `${ops.branch.prefix[0]}${on++}` : undefined, booking: v.seat ? `${ops.branch.prefix[1]}${bn++}` : undefined }))
  const hash = (c: string) => `\u2066#${c}\u2069`
  // Each pre-order and each table is its own check, so it's clear what is ready.
  const checks = jobs.flatMap(j => [...(j.order ? [`o-${j.order}`] : []), ...(j.booking ? [`t-${j.booking}`] : [])])
  const doneHere = done.filter(id => checks.includes(id))
  const total = checks.length
  const pct = total ? Math.round((doneHere.length / total) * 100) : 100
  const can = useCan()
  const toggle = (id: string) => can('tomorrow.check') && setDone(d => (d.includes(id) ? d.filter(x => x !== id) : [...d, id]))
  const isDone = (j: Job) => (!j.order || doneHere.includes(`o-${j.order}`)) && (!j.booking || doneHere.includes(`t-${j.booking}`))
  const next = jobs.find(j => !isDone(j))

  const PARTS: [T2, number][] = [[['الصباح', 'Morning'], 12], [['الظهر', 'Midday'], 15], [['العصر', 'Afternoon'], 18], [['المساء', 'Evening'], 24]]
  const parts = PARTS.map(([label, end], i) => ({ label, jobs: jobs.filter(({ v }) => v.at[0] < end && v.at[0] >= (i ? PARTS[i - 1][1] : 0)) })).filter(g => g.jobs.length)
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
            <small>{t('التالي', 'Next up')}</small>
            <b><span>{clock(...next.v.at)}</span>{[next.order && t(`طلب ${hash(next.order)}`, `Order #${next.order}`), next.booking && t(`حجز ${hash(next.booking)} · ${pick(next.v.seat!)}`, `Booking #${next.booking} · ${pick(next.v.seat!)}`)].filter(Boolean).join(' · ')}</b>
          </div>
        )}
        <div className="o-tmr-kpis">
          <div><b>{visits.length}</b><small>{t('زيارة مجدولة', 'planned visits')}</small></div>
          <div><b>{guests}</b><small>{t('شخصًا متوقعًا', 'guests expected')}</small></div>
          <div><b>{withOrder.length}</b><small>{t('طلب مسبق مدفوع', 'paid pre-orders')}</small></div>
          <div><b>{withSeat.length}</b><small>{t('طاولة محجوزة', 'tables booked')}</small></div>
        </div>
      </section>

      <div className="o-tmr-main">
        <section className="o-card o-tmr-tasks">
          <div className="o-tmr-group">
            <h4><CalendarClock />{t('خلال اليوم', 'During the day')}<small>{doneHere.length}/{total}</small></h4>
            <p className="o-card-sub">{t('الطلبات المسبقة والطاولات المحجوزة حسب الوقت. علّم كلًّا منها عند تجهيزه.', 'Pre-orders and booked tables in time order. Tick each one off when it is ready.')}</p>
            {soldOutNeeded.map(p => (
              <p key={p.en} className="o-tmr-alert"><CircleAlert /><span>{t(`«${itemName(p.en)}» نافد الآن، وعليه ${p.qty} طلب مسبق غدًا. أعد تفعيله في المنيو بعد تجهيزه.`, `“${itemName(p.en)}” is sold out now, with ${p.qty} pre-ordered for tomorrow. Turn it back on in the menu once it's made.`)}</span><button type="button" onClick={openMenu}>{t('افتح المنيو', 'Open menu')}</button></p>
            ))}
            {parts.map(g => (
              <section key={g.label[1]} className="o-tmr-part">
                <h5>{pick(g.label)}</h5>
                <ul>
                  {g.jobs.map(j => {
                    const oOn = !!j.order && doneHere.includes(`o-${j.order}`), tOn = !!j.booking && doneHere.includes(`t-${j.booking}`)
                    return (
                      <li key={j.order ?? j.booking} className={`${isDone(j) ? 'on' : ''} ${next === j ? 'next' : ''}`}>
                        <span className="o-tmr-time">{clock(...j.v.at)}</span>
                        <div className="o-tmr-what">
                          {j.order && (
                            <button type="button" role="checkbox" aria-checked={oOn} disabled={!can('tomorrow.check')} className={`o-tmr-job ${oOn ? 'on' : ''}`} onClick={() => toggle(`o-${j.order}`)}>
                              <Check2 on={oOn} />
                              <span><b><ShoppingBag />{t(`طلب ${hash(j.order)}`, `Order #${j.order}`)}</b><small>{orderText(j.v.order!)}</small></span>
                              <em>{oOn ? t('الطلب جاهز', 'Order ready') : t('جهّز الطلب', 'Prepare order')}</em>
                            </button>
                          )}
                          {j.booking && (
                            <button type="button" role="checkbox" aria-checked={tOn} disabled={!can('tomorrow.check')} className={`o-tmr-job ${tOn ? 'on' : ''}`} onClick={() => toggle(`t-${j.booking}`)}>
                              <Check2 on={tOn} />
                              <span><b><Armchair />{t(`حجز ${hash(j.booking)}`, `Booking #${j.booking}`)}</b><small>{`${pick(j.v.seat!)} · ${people(j.v.ppl)}`}</small></span>
                              <em>{tOn ? t('الطاولة جاهزة', 'Table ready') : t('جهّز الطاولة', 'Set table')}</em>
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
          <p className="o-note"><Lock />{t('لا نعرض الأسماء ولا الصور. يظهر لك رقم الطلب أو الحجز ووقته فقط.', 'No names or photos. You only see the order or booking number and its time.')}</p>
        </section>

        <aside className="o-tmr-side">
          {prep.length > 0 && (
            <section className="o-card">
              <h3><ChefHat />{t('ملخص التحضير', 'Prep summary')}</h3>
              <p className="o-card-sub">{t('حسب أولوية التحضير: الأقرب استلامًا أولًا', 'By prep priority: earliest pickup first')}</p>
              <ul className="o-tmr-prep">
                {prep.map((p, i) => <li key={p.en} className={itemOf(p.en)?.soldOut ? 'warn' : ''}><i>{i + 1}</i><span>{itemName(p.en)}</span><b dir="ltr">×{p.qty}</b><small>{t(`قبل ${clock(...p.at)}`, `by ${clock(...p.at)}`)}</small></li>)}
              </ul>
            </section>
          )}

          <section className="o-card o-tmr-load">
            <h3>{t('الازدحام المتوقع', 'Expected crowd')}</h3>
            <p className="o-card-sub">{t(`الذروة نحو ${hourText(peakH)}`, `Peak around ${hourText(peakH)}`)}</p>
            <div className="o-hours" dir="ltr">
              {load.map((v, i) => <span key={i} className={`o-hour ${i === peak ? 'on' : ''}`} title={`${hourText(FIRST_HOUR + i)} · ${v}`}><i style={{ height: `${Math.max(4, (v / maxLoad) * 100)}%` }} /></span>)}
            </div>
            <div className="o-hours-axis" dir="ltr">{[7, 11, 15, 19, 22].map(h => <span key={h} dir={lang === 'ar' ? 'rtl' : 'ltr'}>{hourText(h)}</span>)}</div>
          </section>

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
