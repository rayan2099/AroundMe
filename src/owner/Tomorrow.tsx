import { Armchair, CalendarClock, Check, ChefHat, CircleAlert, Clock, HeartHandshake, Lock, ShoppingBag, Store, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from './Owner'
import { MEETUPS, TOMORROW } from './Insights'
import type { Visit } from './Insights'
import type { Ops } from './Ops'
import type { Item } from './data'

// «الغد»: everything a branch needs to be ready for tomorrow, in one place. Planned visits come with their
// time, party size, table and pre-order, never a name. The checklist is built from those visits, and the
// owner ticks it off as the team gets ready.
type T2 = [string, string]
type Task = { id: string; group: 'kitchen' | 'tables' | 'team' | 'meet' | 'menu'; text: string; sub?: string; warn?: boolean }
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
  const people = (p: number) => t(p === 1 ? 'شخص' : p === 2 ? 'شخصان' : `${p} أشخاص`, `${p} ${p === 1 ? 'person' : 'people'}`)
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

  const tasks: Task[] = [
    ...soldOutNeeded.map(p => ({ id: `so-${p.en}`, group: 'menu' as const, warn: true, text: t(`«${itemName(p.en)}» نافد الآن، وعليه ${p.qty} طلب مسبق غدًا`, `“${itemName(p.en)}” is sold out now, with ${p.qty} pre-ordered for tomorrow`), sub: t('جهّزه وأعد تفعيله في المنيو قبل الافتتاح', 'Make it and turn it back on in the menu before opening') })),
    ...prep.map(p => ({ id: `prep-${p.en}`, group: 'kitchen' as const, text: t(`جهّز ${p.qty} ${itemName(p.en)}`, `Prepare ${p.qty}× ${itemName(p.en)}`), sub: t(`أول استلام ${clock(...p.at)}`, `First pickup ${clock(...p.at)}`) })),
    ...withSeat.map(v => ({ id: `tbl-${v.at.join(':')}-${v.seat![1]}`, group: 'tables' as const, text: t(`${pick(v.seat!)} ${v.ppl === 1 ? 'لشخص واحد' : v.ppl === 2 ? 'لشخصين' : `لـ${v.ppl} أشخاص`}`, `${pick(v.seat!)} for ${people(v.ppl)}`), sub: t(`محجوزة ${clock(...v.at)} · ${pick(v.tag)}`, `Booked ${clock(...v.at)} · ${pick(v.tag)}`) })),
    { id: 'team-peak', group: 'team', text: t(`أضف موظفًا من ${hourText(peakH - 1)} إلى ${hourText(peakH + 2)}`, `Add a team member from ${hourText(peakH - 1)} to ${hourText(peakH + 2)}`), sub: t(`أكثر وقت ازدحامًا غدًا: نحو ${load[peak]} أشخاص عند ${hourText(peakH)}`, `Busiest time tomorrow: about ${load[peak]} people at ${hourText(peakH)}`) },
    { id: 'team-open', group: 'team', text: t(`افتتاح الساعة ${hourText(ops.branch.hours[0] % 24)}`, `Open at ${hourText(ops.branch.hours[0] % 24)}`), sub: t(`أول زيارة ${visits[0] ? clock(...visits[0].at) : '—'}، فليكن الفريق جاهزًا قبلها`, `First visit at ${visits[0] ? clock(...visits[0].at) : '—'}, so have the team ready before`) },
    ...(need.length || help.length ? [{ id: 'meet-seats', group: 'meet' as const, text: t('أبقِ طاولتين هادئتين للقاءات', 'Keep two quiet tables free for meetups'), sub: t(`${need.length} يحتاجون مساعدة و${help.length} يستطيعون، بين ${clock(...(need[0] ?? help[0]).at)} و${clock(...[...need, ...help].sort((a, b) => a.at[0] * 60 + a.at[1] - b.at[0] * 60 - b.at[1]).at(-1)!.at)}`, `${need.length} need help and ${help.length} can help, between ${clock(...(need[0] ?? help[0]).at)} and ${clock(...[...need, ...help].sort((a, b) => a.at[0] * 60 + a.at[1] - b.at[0] * 60 - b.at[1]).at(-1)!.at)}`) }] : []),
  ]
  const ids = new Set(tasks.map(x => x.id))
  const doneHere = done.filter(id => ids.has(id))
  const pct = tasks.length ? Math.round((doneHere.length / tasks.length) * 100) : 100
  const toggle = (id: string) => setDone(d => (d.includes(id) ? d.filter(x => x !== id) : [...d, id]))
  const groups: [Task['group'], ReactNode, string][] = [
    ['menu', <CircleAlert />, t('قبل أي شيء', 'First of all')],
    ['kitchen', <ChefHat />, t('التحضير', 'Prep')],
    ['tables', <Armchair />, t('الطاولات', 'Tables')],
    ['team', <Users />, t('الفريق', 'Team')],
    ['meet', <HeartHandshake />, t('اللقاءات', 'Meetups')],
  ]

  const PARTS: [T2, number][] = [[['الصباح', 'Morning'], 12], [['الظهر', 'Midday'], 15], [['العصر', 'Afternoon'], 18], [['المساء', 'Evening'], 24]]
  const parts = PARTS.map(([label, end], i) => ({ label, visits: visits.filter(v => v.at[0] < end && v.at[0] >= (i ? PARTS[i - 1][1] : 0)) })).filter(g => g.visits.length)
  const kindLabel = (k: Visit['kind']) => k === 'visit' ? t('زيارة فقط', 'Just visiting') : k === 'need' ? t('يحتاج مساعدة', 'Needs help') : t('يستطيع المساعدة', 'Can help')
  const orderText = (o: [string, number][]) => o.map(([en, q]) => `${q > 1 ? `${q}× ` : ''}${itemName(en)}`).join(t('، ', ', '))

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
        <p className="o-tmr-status">{pct === 100 ? t('كل شيء جاهز للغد 👌', 'All set for tomorrow 👌') : t(`بقيت ${tasks.length - doneHere.length} من ${tasks.length} مهام`, `${tasks.length - doneHere.length} of ${tasks.length} tasks left`)}</p>
        <div className="o-tmr-kpis">
          <div><b>{visits.length}</b><small>{t('زيارة مجدولة', 'planned visits')}</small></div>
          <div><b>{guests}</b><small>{t('شخصًا متوقعًا', 'guests expected')}</small></div>
          <div><b>{withOrder.length}</b><small>{t('طلب مسبق مدفوع', 'paid pre-orders')}</small></div>
          <div><b>{withSeat.length}</b><small>{t('طاولة محجوزة', 'tables booked')}</small></div>
          <div className="need"><b>{need.length}</b><small>{t('يحتاجون مساعدة', 'need help')}</small></div>
          <div className="help"><b>{help.length}</b><small>{t('يستطيعون المساعدة', 'can help')}</small></div>
        </div>
      </section>

      <section className="o-card o-tmr-tasks">
        <h3>{t('قائمة التجهيز', 'Get-ready checklist')}</h3>
        <p className="o-card-sub">{t('مبنية من زيارات الغد. علّم كل مهمة عند إنجازها.', "Built from tomorrow's visits. Tick each task off when it's done.")}</p>
        {groups.map(([g, icon, label]) => {
          const list = tasks.filter(x => x.group === g)
          if (!list.length) return null
          return (
            <div key={g} className={`o-tmr-group ${g}`}>
              <h4>{icon}{label}<small>{list.filter(x => doneHere.includes(x.id)).length}/{list.length}</small>
                {list.length > 2 && list.some(x => !doneHere.includes(x.id)) && <button type="button" className="o-tmr-all" onClick={() => setDone(d => [...new Set([...d, ...list.map(x => x.id)])])}>{t('علّم الكل', 'Mark all')}</button>}
              </h4>
              <ul>
                {list.map(x => {
                  const on = doneHere.includes(x.id)
                  return (
                    <li key={x.id} className={`${on ? 'on' : ''} ${x.warn ? 'warn' : ''}`}>
                      <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(x.id)}>
                        <i>{on && <Check />}</i>
                        <span><b>{x.text}</b>{x.sub && <small>{x.sub}</small>}</span>
                      </button>
                      {x.group === 'menu' && !on && <button type="button" className="o-tmr-link" onClick={openMenu}>{t('افتح المنيو', 'Open menu')}</button>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </section>

      <section className="o-card o-tmr-load">
        <h3>{t('الازدحام المتوقع', 'Expected crowd')}</h3>
        <p className="o-card-sub">{t(`الذروة نحو ${hourText(peakH)}`, `Peak around ${hourText(peakH)}`)}</p>
        <div className="o-hours" dir="ltr">
          {load.map((v, i) => <span key={i} className={`o-hour ${i === peak ? 'on' : ''}`} title={`${hourText(FIRST_HOUR + i)} · ${v}`}><i style={{ height: `${Math.max(4, (v / maxLoad) * 100)}%` }} /></span>)}
        </div>
        <div className="o-hours-axis" dir="ltr">{[7, 11, 15, 19, 22].map(h => <span key={h} dir={lang === 'ar' ? 'rtl' : 'ltr'}>{hourText(h)}</span>)}</div>
      </section>

      {(need.length > 0 || help.length > 0) && (
        <section className="o-card o-meet-tmr">
          <h3><HeartHandshake />{t('اللقاءات غدًا', 'Meetups tomorrow')}</h3>
          <div className="o-tomorrow-row">
            <div className="need"><b>{need.length}</b><small>{t('يحتاجون مساعدة', 'need help')}</small></div>
            <div className="help"><b>{help.length}</b><small>{t('يستطيعون المساعدة', 'can help')}</small></div>
            <div><b>{repeat}</b><small>{t('لقاءات متكررة متوقعة', 'repeat meetups expected')}</small></div>
          </div>
          <ul className="o-meet-slots">
            {[...need, ...help].sort((a, b) => a.at[0] * 60 + a.at[1] - b.at[0] * 60 - b.at[1]).map((v, i) => (
              <li key={i} className={v.kind}>
                <span className="o-meet-slot-time">{clock(...v.at)}</span>
                <span className="o-meet-slot-kind">{kindLabel(v.kind)}</span>
                <b>{pick(v.tag)}</b>
              </li>
            ))}
          </ul>
          {need.length > help.length && <p className="o-note"><Store />{t(`من يحتاجون المساعدة أكثر ممن يستطيعون بـ ${need.length - help.length}. عرض صغير لمن يساعد قد يحسم اختياره لكافيهك.`, `${need.length - help.length} more ${need.length - help.length === 1 ? 'person needs' : 'people need'} help than can help. A small perk for helpers could make them pick your café.`)}</p>}
        </section>
      )}

      <section className="o-card o-tmr-timeline">
        <h3><Clock />{t('جدول الغد', "Tomorrow's schedule")}</h3>
        <div className="o-tm-mix">
          {(['visit', 'need', 'help'] as const).map(k => <span key={k} className={`o-kind o-kind-${k}`}>{kindLabel(k)} <b>{visits.filter(v => v.kind === k).length}</b></span>)}
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
                    <small>{kindLabel(v.kind)} · {people(v.ppl)}{v.seat ? ` · ${pick(v.seat)}` : ''}{v.order ? ` · ${orderText(v.order)}` : ''}</small>
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
      </section>

    </div>
  )
}
