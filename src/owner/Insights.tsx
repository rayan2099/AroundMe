import { useState } from 'react'
import type { ReactNode } from 'react'
import { Armchair, CalendarClock, Clock, HeartHandshake, Repeat, Sparkles, TrendingUp, UserPlus, Wallet, Zap } from 'lucide-react'
import { useT } from './Owner'
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
const TOP = [['Spanish latte', 64], ['San Sebastián cheesecake', 41], ['Butter croissant', 33], ['Iced latte', 25]] as const

export default function Insights({ items }: { items: Item[] }) {
  const { t, tx, sar, lang } = useT()
  const [period, setPeriod] = useState<Period>('week')
  const [hover, setHover] = useState<number | null>(null)
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

      <div className="o-meetups">
        <span className="o-meetups-icon"><HeartHandshake /></span>
        <div>
          <b>{t(`${fmt(n(WEEK.meetups))} لقاء صار في كافيهك`, `${fmt(n(WEEK.meetups))} meetups happened at your café`)}</b>
          <small>{t('ناس ساعدوا بعض على طاولاتك. هذا اللي يخلّيهم يختارونك على غيرك.', 'People helped each other at your tables. This is why they pick you over the café next door.')}</small>
        </div>
      </div>

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

      <p className="o-fine">{t('أرقام تجريبية تورّيك شكل لوحتك بعد أول أسابيعك على AroundMe', 'Sample numbers showing how your dashboard looks after your first weeks on AroundMe')}</p>
    </div>
  )
}
