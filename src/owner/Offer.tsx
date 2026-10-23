import { useState } from 'react'
import type { ReactNode } from 'react'
import { BellRing, Check, Coffee, Gift, Lock, Percent, Send } from 'lucide-react'
import { Sheet, useT } from './Owner'

// A come-back offer the café sends to a past visitor (or a pair who met there). It reaches them as an app
// notification, «اعرض عرضك», which leads into scheduling a visit, so the café still never learns who they are.
export type Offer = { kind: 'drink' | 'sweet' | 'off'; pct: number; days: number; note: string; used?: boolean }
const PCTS = [10, 15, 20, 25, 50]
const DAYS = [7, 14, 30]

export function useOfferText() {
  const { t } = useT()
  // `pair`: the offer goes to two people who met at the café.
  const offerText = (o: Offer, pair = false) => o.kind === 'drink' ? t(pair ? 'مشروب مجاني لكل منهما' : 'مشروب مجاني', pair ? 'A free drink each' : 'A free drink')
    : o.kind === 'sweet' ? t(pair ? 'حلى مجاني لكل منهما' : 'حلى مجاني', pair ? 'A free dessert each' : 'A free dessert')
    : t(`خصم ${o.pct}% على ${pair ? 'طلبهما' : 'طلبه'}`, `${o.pct}% off ${pair ? 'their' : 'the'} order`)
  const daysText = (d: number) => t(d === 7 ? 'أسبوع' : d === 14 ? 'أسبوعين' : 'شهر', d === 7 ? '1 week' : d === 14 ? '2 weeks' : '1 month')
  return { offerText, daysText }
}

// The offer on a card once it's sent: amber while waiting, green once they came back and used it.
export function OfferSent({ offer, pair = false }: { offer: Offer; pair?: boolean }) {
  const { t } = useT()
  const { offerText, daysText } = useOfferText()
  return (
    <div className={`o-offer-sent ${offer.used ? 'used' : ''}`}>
      <Gift />
      <span><b>{offerText(offer, pair)}</b><small>{offer.used ? t(pair ? 'استخدماه وعادا إلى الكافيه' : 'استخدمه وعاد إلى الكافيه', pair ? 'They used it and came back' : 'Used it and came back') : t(`أُرسل · صالح ${daysText(offer.days)} · لم يُستخدم بعد`, `Sent · valid ${daysText(offer.days)} · not used yet`)}</small></span>
      {offer.used && <Check />}
    </div>
  )
}

export function OfferButton({ onClick, pair = false }: { onClick: () => void; pair?: boolean }) {
  const { t } = useT()
  return <button type="button" className="o-offer-btn" onClick={onClick}><Gift />{t(pair ? 'شجّعهما على العودة بعرض' : 'شجّعه على العودة بعرض', 'Invite them back with an offer')}</button>
}

export function OfferSheet({ about, pair = false, onSend, onClose }: { about: ReactNode; pair?: boolean; onSend: (o: Offer) => void; onClose: () => void }) {
  const { t } = useT()
  const { offerText, daysText } = useOfferText()
  const [draft, setDraft] = useState<Offer>({ kind: 'drink', pct: 20, days: 14, note: '' })
  return (
    <Sheet title={t('عرض للعودة', 'Come-back offer')} onClose={onClose} footer={
      <>
        <button type="button" className="o-primary" onClick={() => onSend(draft)}><Send />{t('أرسل العرض', 'Send offer')}</button>
        <button type="button" className="o-text-btn" onClick={onClose}>{t('رجوع', 'Back')}</button>
      </>
    }>
      {about}
      <span className="o-label">{t('نوع العرض', 'Offer')}</span>
      <div className="o-offer-kinds">
        {([['drink', <Coffee />, t('مشروب مجاني', 'Free drink')], ['sweet', <Gift />, t('حلى مجاني', 'Free dessert')], ['off', <Percent />, t('خصم', 'Discount')]] as const).map(([k, icon, label]) => (
          <button key={k} type="button" className={draft.kind === k ? 'active' : ''} aria-pressed={draft.kind === k} onClick={() => setDraft(d => ({ ...d, kind: k }))}>{icon}{label}</button>
        ))}
      </div>
      {draft.kind === 'off' && (
        <>
          <span className="o-label">{t('نسبة الخصم', 'Discount')}</span>
          <div className="o-chips wrap">{PCTS.map(p => <button key={p} type="button" className={`o-chip ${draft.pct === p ? 'active' : ''}`} onClick={() => setDraft(d => ({ ...d, pct: p }))}>{p}%</button>)}</div>
        </>
      )}
      <span className="o-label">{t('صالح لمدة', 'Valid for')}</span>
      <div className="o-chips wrap">{DAYS.map(d => <button key={d} type="button" className={`o-chip ${draft.days === d ? 'active' : ''}`} onClick={() => setDraft(x => ({ ...x, days: d }))}>{daysText(d)}</button>)}</div>
      <label className="o-label" htmlFor="o-offer-note">{t('رسالة قصيرة (اختياري)', 'Short message (optional)')}</label>
      <input id="o-offer-note" className="o-field" value={draft.note} maxLength={80} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} placeholder={pair ? t('مثلًا: سعدنا بزيارتكما، ننتظركما مرة أخرى', 'e.g. Glad you met here, see you again') : t('مثلًا: سعدنا بزيارتك، ننتظرك مرة أخرى', 'e.g. Glad you came, see you again')} />
      <span className="o-label">{t('هكذا يصل', 'What they see')}</span>
      <div className="o-offer-push"><BellRing /><span><b>{t('لديك عرض لزيارتك القادمة 🎁', 'An offer for your next visit 🎁')}</b><small>{t('من كافيهك · اعرض عرضك', 'From your café · View your offer')}</small></span></div>
      <div className="o-offer-preview">
        <Gift />
        <span><b>{offerText(draft, pair)}</b><small>{draft.note.trim() || (pair ? t('شكرًا للقائكما عندنا، ننتظركما في الزيارة القادمة.', 'Thanks for meeting here. See you next time.') : t('شكرًا لزيارتك، ننتظرك في الزيارة القادمة.', 'Thanks for visiting. See you next time.'))}</small><em>{t(`صالح ${daysText(draft.days)} · يُطبَّق عند جدولة الزيارة والطلب من التطبيق`, `Valid ${daysText(draft.days)} · applied when they schedule a visit and order in the app`)}</em></span>
      </div>
      <p className="o-note"><Lock />{t('يصل العرض عبر التطبيق، ولا يظهر لك الاسم.', 'The offer goes through the app. You never see who they are.')}</p>
    </Sheet>
  )
}
