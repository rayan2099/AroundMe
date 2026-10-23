import { useState } from 'react'
import type { ReactNode } from 'react'
import { Armchair, CalendarClock, ChevronLeft, ChevronRight, Clock, HeartHandshake, Lightbulb, Lock, MessageCircleHeart, Repeat, Sparkles, TrendingUp, UserPlus, Wallet, Zap } from 'lucide-react'
import { Sheet, useT } from './Owner'
import type { Item } from './data'

type Period = 'day' | 'week' | 'month'
// Sample numbers for a café's first weeks on AroundMe. A week is the base; a day and a month are scaled from it.
const SCALE: Record<Period, number> = { day: 1 / 7, week: 1, month: 4.3 }
const GROWTH: Record<Period, number> = { day: 9, week: 18, month: 24 }
const WEEK = { revenue: 12840, visits: 214, newShare: 0.38, returnRate: 42, orders: 163, avgOrder: 41, counterAvg: 29, bookings: 57, fee: 5, meetups: 46, stayMin: 108, lostTries: 23 }
// AroundMe visits by hour, 7am to 11pm. The early afternoon is usually quiet; planned visits fill it.
const HOURS = [6, 14, 16, 11, 8, 7, 12, 15, 16, 13, 10, 14, 20, 22, 18, 8, 4]
const FIRST_HOUR = 7
const QUIET = [13, 14, 15, 16]
type T2 = [string, string]
// Meetups at the café. Owners see what kind of help happened, never who: no names or photos.
// Help is one-way: one person needed help and another helped.
const MEETUPS: { helper: T2; f?: boolean; helped: T2; topic: T2; tags: T2[]; when: T2; mins: number; seat: T2; ordered: number; again?: boolean }[] = [
  { helper: ['مطور تطبيقات', 'App developer'], helped: ['صاحبة مشروع ناشئ', 'Startup founder'], topic: ['تطبيقها يعلّق في صفحة الدفع', 'Her app froze on the payment page'], tags: [['برمجة', 'Coding'], ['تطبيقات', 'Apps']], when: ['اليوم 4:10 م', 'Today 4:10pm'], mins: 25, seat: ['عند النافذة', 'By the window'], ordered: 2, again: true },
  { helper: ['مصممة جرافيك', 'Graphic designer'], f: true, helped: ['صاحب متجر إلكتروني', 'Online store owner'], topic: ['رأي في شعار المتجر الجديد', 'Feedback on a new store logo'], tags: [['تصميم', 'Design'], ['هوية بصرية', 'Branding']], when: ['اليوم 2:35 م', 'Today 2:35pm'], mins: 15, seat: ['الطاولة الطويلة', 'Long table'], ordered: 2 },
  { helper: ['محللة مالية', 'Financial analyst'], f: true, helped: ['رائد أعمال', 'Entrepreneur'], topic: ['مراجعة جدول التدفقات النقدية', 'Reviewing a cash-flow sheet'], tags: [['مالية', 'Finance'], ['Excel', 'Excel']], when: ['أمس 6:20 م', 'Yesterday 6:20pm'], mins: 30, seat: ['منطقة الهدوء', 'Quiet area'], ordered: 3, again: true },
  { helper: ['مختص تسويق رقمي', 'Digital marketer'], helped: ['صاحبة مشروع هدايا', 'Gift shop owner'], topic: ['خطة إعلان على سناب', 'A Snapchat ad plan'], tags: [['تسويق', 'Marketing']], when: ['أمس 5:05 م', 'Yesterday 5:05pm'], mins: 20, seat: ['الجلسات الخارجية', 'Outdoor seating'], ordered: 2 },
  { helper: ['كاتبة إعلانية', 'Copywriter'], f: true, helped: ['طالب جامعي', 'University student'], topic: ['تدقيق رسالة تقديم وظيفة', 'Proofreading a job cover letter'], tags: [['كتابة', 'Writing']], when: ['الثلاثاء 3:40 م', 'Tuesday 3:40pm'], mins: 10, seat: ['قريب من الكاونتر', 'Near the counter'], ordered: 1 },
  { helper: ['مصور منتجات', 'Product photographer'], helped: ['صاحبة متجر عطور', 'Perfume shop owner'], topic: ['تصوير منتجات بالجوال', 'Shooting products on a phone'], tags: [['تصوير', 'Photography']], when: ['الإثنين 1:15 م', 'Monday 1:15pm'], mins: 25, seat: ['عند النافذة', 'By the window'], ordered: 2 },
]
// What the café's AroundMe customers say they can help with, and what they come needing help with (share of people).
const SKILLS: [T2, number][] = [[['برمجة وتطبيقات', 'Coding and apps'], 31], [['تصميم', 'Design'], 22], [['تسويق', 'Marketing'], 17], [['مالية وExcel', 'Finance and Excel'], 12], [['كتابة وترجمة', 'Writing and translation'], 10], [['تصوير', 'Photography'], 8]]
const NEEDS: [T2, number][] = [[['مراجعة فكرة مشروع', 'Startup idea feedback'], 28], [['حل مشكلة كود', 'Fixing code'], 24], [['تصميم عرض أو شعار', 'Deck or logo design'], 19], [['تسويق وإعلانات', 'Marketing and ads'], 15], [['مذاكرة وواجبات', 'Studying'], 14]]
const PEOPLE: [T2, number][] = [[['موظفين', 'Employees'], 38], [['مستقلين', 'Freelancers'], 27], [['رواد أعمال', 'Founders'], 21], [['طلاب', 'Students'], 14]]

const TOP = [['Spanish latte', 64], ['San Sebastián cheesecake', 41], ['Butter croissant', 33], ['Iced latte', 25]] as const

export default function Insights({ items }: { items: Item[] }) {
  const { t, tx, sar, lang } = useT()
  const [period, setPeriod] = useState<Period>('week')
  const [hover, setHover] = useState<number | null>(null)
  const [meetupsOpen, setMeetupsOpen] = useState(false)
  const pick = (x: T2) => (lang === 'ar' ? x[0] : x[1])
  const Fwd = lang === 'ar' ? ChevronLeft : ChevronRight
  const an = (x: string) => `${/^[aeiou]/i.test(x) ? 'An' : 'A'} ${x.toLowerCase()}`
  const k = SCALE[period]
  const n = (x: number) => Math.max(1, Math.round(x * k))
  const fmt = (x: number) => x.toLocaleString('en-US')
  const money = (x: number) => sar(fmt(Math.round(x * k)))

  const visits = n(WEEK.visits)
  const orders = n(WEEK.orders)
  const savedMin = Math.round(orders * 3.3)
  const savedH = Math.round(savedMin / 60)
  const saved = savedMin < 120 ? t(`${savedMin} دقيقة`, `${savedMin} min`) : t(`${savedH} ${savedH <= 10 ? 'ساعات' : 'ساعة'}`, `${savedH} hours`)
  const hourly = HOURS.map(v => Math.round(v * k))
  const max = Math.max(...hourly, 1)
  const quietShare = Math.round((QUIET.reduce((a, h) => a + HOURS[h - FIRST_HOUR], 0) / HOURS.reduce((a, b) => a + b, 0)) * 100)
  const hourLabel = (h: number) => (lang === 'ar' ? `${h % 12 || 12} ${h < 12 ? 'ص' : 'م'}` : `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`)
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  const lost = items.find(i => i.soldOut) ?? items.find(i => i.name.en === 'Lotus cheesecake') ?? items[0]
  const lostTries = n(WEEK.lostTries)
  const top = TOP.map(([en, c], i) => ({ item: items.find(x => x.name.en === en) ?? items[i], c: n(c) })).filter(x => x.item)
  const topMax = Math.max(...top.map(x => x.c), 1)

  const tiles: [ReactNode, string, string, string][] = [
    [<UserPlus />, fmt(n(WEEK.visits * WEEK.newShare)), t('عملاء جدد', 'New customers'), t('أول مرة يزورونك، جوك عن طريق AroundMe', 'First visit ever, found you on AroundMe')],
    [<Repeat />, `${WEEK.returnRate}%`, t('رجعوا لك', 'Came back'), t('زاروك مرة ثانية خلال أسبوعين', 'Visited again within two weeks')],
    [<Wallet />, sar(WEEK.avgOrder), t('متوسط الطلب', 'Average order'), t(`أعلى بـ ${sar(WEEK.avgOrder - WEEK.counterAvg)} من الكاونتر`, `${sar(WEEK.avgOrder - WEEK.counterAvg)} more than at the counter`)],
    [<Zap />, saved, t('وفّرنا على الكاشير', 'Saved at the counter'), t(`${fmt(orders)} طلب جاهز ومدفوع قبل يوصلون`, `${fmt(orders)} orders ready and paid before arrival`)],
    [<Armchair />, fmt(n(WEEK.bookings)), t('طاولات محجوزة', 'Tables booked'), t(`${money(WEEK.bookings * WEEK.fee)} رسوم حجز لك`, `${money(WEEK.bookings * WEEK.fee)} in booking fees to you`)],
    [<Clock />, `${Math.floor(WEEK.stayMin / 60)}:${String(WEEK.stayMin % 60).padStart(2, '0')}`, t('متوسط الجلسة', 'Average stay'), t(`ساعة و${WEEK.stayMin % 60} دقيقة، ويطلبون أكثر من مرة`, `${WEEK.stayMin} minutes, and they order more than once`)],
  ]

  return (
    <div className="o-insights">
      <div className="o-period" role="tablist" aria-label={t('الفترة', 'Period')}>
        {(['day', 'week', 'month'] as Period[]).map(p => (
          <button key={p} type="button" role="tab" aria-selected={period === p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>
            {p === 'day' ? t('اليوم', 'Today') : p === 'week' ? t('هالأسبوع', 'This week') : t('هالشهر', 'This month')}
          </button>
        ))}
      </div>

      <div className="o-hero-stat">
        <small>{t('دخل جابه لك AroundMe', 'Revenue AroundMe brought you')}</small>
        <b>{money(WEEK.revenue)}</b>
        <span><em><TrendingUp />{GROWTH[period]}%</em>{t(`من ${fmt(visits)} زيارة · ${fmt(orders)} طلب`, `from ${fmt(visits)} visits · ${fmt(orders)} orders`)}</span>
      </div>

      <button type="button" className="o-meetups" onClick={() => setMeetupsOpen(true)}>
        <span className="o-meetups-icon"><HeartHandshake /></span>
        <div>
          <b>{t(`${fmt(n(WEEK.meetups))} لقاء صار في كافيهك`, `${fmt(n(WEEK.meetups))} meetups happened at your café`)}</b>
          <small>{t('ناس ساعدوا بعض على طاولاتك. هذا اللي يخلّيهم يختارونك على غيرك.', 'People helped each other at your tables. This is why they pick you over the café next door.')}</small>
          <em>{t('شوف التفاصيل', 'See details')}<Fwd /></em>
        </div>
      </button>

      <div className="o-tiles">
        {tiles.map(([icon, v, label, sub]) => (
          <div key={label} className="o-tile">
            <span className="o-tile-icon">{icon}</span>
            <b>{v}</b>
            <span className="o-tile-label">{label}</span>
            <small>{sub}</small>
          </div>
        ))}
      </div>

      <section className="o-card o-customers">
        <h3>{t('مين عملاؤك', 'Who your customers are')}</h3>
        <p className="o-card-sub">{t('من المهارات والاحتياجات اللي كتبوها في AroundMe', 'From the skills and needs they shared on AroundMe')}</p>
        <div className="o-people">
          {PEOPLE.map(([l, v]) => <div key={l[1]}><b>{v}%</b><small>{pick(l)}</small></div>)}
        </div>
        <div className="o-skill-needs">
        <div>
        <h4 className="o-sub-h">{t('يقدرون يساعدون في', 'They can help with')}</h4>
        <ul className="o-top-items">
          {SKILLS.map(([l, v]) => <li key={l[1]}><span className="o-top-name">{pick(l)}</span><span className="o-top-bar"><i style={{ width: `${(v / SKILLS[0][1]) * 100}%` }} /></span><b>{v}%</b></li>)}
        </ul>
        </div>
        <div>
        <h4 className="o-sub-h">{t('يجون يحتاجون مساعدة في', 'They come needing help with')}</h4>
        <ul className="o-top-items needs">
          {NEEDS.map(([l, v]) => <li key={l[1]}><span className="o-top-name">{pick(l)}</span><span className="o-top-bar"><i style={{ width: `${(v / NEEDS[0][1]) * 100}%` }} /></span><b>{v}%</b></li>)}
        </ul>
        </div>
        </div>
        <p className="o-note"><Lightbulb />{t('كافيهك صار مكان المبرمجين والمصممين ورواد الأعمال. فكّر في ركن هادئ بمقابس، أو باقة «جلسة عمل» قهوة ومعجنات بسعر واحد.', 'Your café has become a spot for developers, designers and founders. Think about a quiet corner with sockets, or a “work session” bundle of coffee and a pastry at one price.')}</p>
      </section>

      <section className="o-card">
        <h3>{t('متى يجيك عملاء AroundMe', 'When AroundMe customers come')}</h3>
        <p className="o-card-sub">{t(`${quietShare}% من زياراتهم في وقتك الهادي، بين 1 و5 العصر`, `${quietShare}% of their visits land in your quiet hours, 1 to 5pm`)}</p>
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
        <p className="o-legend"><span className="o-quiet-swatch" />{t('وقتك الهادي', 'Your quiet hours')}</p>
      </section>

      <section className="o-card o-tomorrow">
        <h3><CalendarClock />{t('بكرة عندك', 'Tomorrow')}</h3>
        <div className="o-tomorrow-row">
          <div><b>18</b><small>{t('زيارة مجدولة', 'planned visits')}</small></div>
          <div><b>11</b><small>{t('طلب مسبق', 'pre-orders')}</small></div>
          <div><b>6</b><small>{t('طاولات', 'tables')}</small></div>
        </div>
        <p className="o-note"><Sparkles />{t(`أكثر وقت زحمة 4م، وأكثر صنف مطلوب مسبقًا ${top[0] ? tx(top[0].item.name) : ''}. جهّز له بدري.`, `Busiest at 4pm, and the most pre-ordered item is ${top[0] ? tx(top[0].item.name) : ''}. Get it ready early.`)}</p>
      </section>

      {lost && (
        <section className="o-card o-lost">
          <h3>{t('طلبات فاتتك', 'Orders you missed')}</h3>
          <p>{t(`${fmt(lostTries)} حاولوا يطلبون «${tx(lost.name)}» وهو نفد، تقريبًا ${sar(lostTries * (lost.price ?? 20))}.`, `${fmt(lostTries)} people tried to order “${tx(lost.name)}” while it was sold out, about ${sar(lostTries * (lost.price ?? 20))}.`)}</p>
          <small>{t('رجّعه متوفر من المنيو أول ما يجهز.', 'Turn it back on in the menu as soon as it is ready.')}</small>
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

      {meetupsOpen && (
        <Sheet title={t('لقاءات في كافيهك', 'Meetups at your café')} onClose={() => setMeetupsOpen(false)}>
          <div className="o-meet-stats">
            <div><b>{fmt(n(WEEK.meetups))}</b><small>{t('لقاء', 'meetups')}</small></div>
            <div><b>{t('21 د', '21 min')}</b><small>{t('متوسط اللقاء', 'average length')}</small></div>
            <div><b>91%</b><small>{t('قالوا التقينا', 'said they met')}</small></div>
          </div>
          <p className="o-note"><Lock />{t('ما نعرض أسماء ولا صور. تشوف نوع المساعدة ووقتها ومكانها بس.', 'No names or photos. You only see the kind of help, when and where.')}</p>
          <ul className="o-meet-list">
            {MEETUPS.map((m, i) => (
              <li key={i}>
                <div className="o-meet-top"><span>{pick(m.when)} · {t(`${m.mins} دقيقة`, `${m.mins} min`)}</span><span>{pick(m.seat)}</span></div>
                <b>{pick(m.topic)}</b>
                <p>{t(`${pick(m.helper)} ${m.f ? 'ساعدت' : 'ساعد'} ${pick(m.helped)}`, `${an(pick(m.helper))} helped ${an(pick(m.helped)).toLowerCase()}`)}</p>
                <div className="o-meet-tags">
                  {m.tags.map(tag => <span key={tag[1]}>{pick(tag)}</span>)}
                  <span className="o-meet-order">{t(`${m.ordered === 1 ? 'طلب واحد' : m.ordered === 2 ? 'طلبين' : `${m.ordered} طلبات`}`, `${m.ordered} order${m.ordered === 1 ? '' : 's'}`)}</span>
                  {m.again && <span className="o-meet-again"><MessageCircleHeart />{t('اتفقوا يلتقون مرة ثانية هنا', 'Plan to meet here again')}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      <p className="o-fine">{t('أرقام تجريبية تورّيك شكل لوحتك بعد أول أسابيعك على AroundMe', 'Sample numbers showing how your dashboard looks after your first weeks on AroundMe')}</p>
    </div>
  )
}
