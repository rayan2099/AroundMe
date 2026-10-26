import { useState } from 'react'
import { BellRing, Coffee, HeartHandshake, Lock, MessageCircle, Minus, Plus, Sparkles } from 'lucide-react'
import { Sheet, useT } from './Owner'
import type { Item } from './data'

// The work-session bundle an owner sets up for people who meet at the café.
export type Bundle = {
  name: string
  items: Record<string, number>
  price: number
  audience: 'all' | 'again' | 'table'
  who: 'both' | 'helped'
  how: { confirm: boolean; before: boolean; chat: boolean }
  when: 'all' | 'quiet'
}
export type Perk = { cap: number }

const sellable = (items: Item[]) => items.filter(i => !i.soldOut && i.price != null)
export const bundleFull = (b: Bundle, items: Item[]) => Object.entries(b.items).reduce((x, [id, q]) => x + (items.find(i => i.id === id)?.price ?? 0) * q, 0)

// Two coffees and a pastry, about 15% off, as a starting point.
export function defaultBundle(items: Item[], name: string): Bundle {
  const ok = sellable(items)
  const coffee = ok.find(i => i.cat === 'hot') ?? ok[0]
  const side = ok.find(i => i.cat === 'pastry') ?? ok.find(i => i.cat === 'sweets') ?? ok.find(i => i.id !== coffee?.id)
  const picked: Record<string, number> = {}
  if (coffee) picked[coffee.id] = 2
  if (side) picked[side.id] = (picked[side.id] ?? 0) + 1
  const full = Object.entries(picked).reduce((x, [id, q]) => x + (ok.find(i => i.id === id)?.price ?? 0) * q, 0)
  return { name, items: picked, price: Math.round(full * 0.85), audience: 'all', who: 'both', how: { confirm: true, before: true, chat: false }, when: 'all' }
}

export function BundleSheet({ items, start, cafe, onSave, onClose }: { items: Item[]; start: Bundle; cafe: string; onSave: (b: Bundle) => void; onClose: () => void }) {
  const { t, tx, sar } = useT()
  const [b, setB] = useState<Bundle>(start)
  const [adding, setAdding] = useState(false)
  const ok = sellable(items)
  const full = bundleFull(b, items)
  const save = Math.max(0, full - b.price)
  const off = full ? Math.round((save / full) * 100) : 0
  const lines = Object.entries(b.items).filter(([, q]) => q > 0).map(([id, q]) => ({ item: items.find(i => i.id === id)!, q })).filter(l => l.item)
  const setQty = (id: string, q: number) => setB(x => {
    const next = { ...x.items, [id]: Math.max(0, Math.min(6, q)) }
    if (!next[id]) delete next[id]
    // Keep the same discount when the contents change.
    const nf = Object.entries(next).reduce((s, [k, n]) => s + (items.find(i => i.id === k)?.price ?? 0) * n, 0)
    return { ...x, items: next, price: Math.round(nf * (1 - off / 100)) }
  })
  const contents = lines.map(l => `${l.q > 1 ? `${l.q} ` : ''}${tx(l.item.name)}`).join(t('، ', ', '))
  const setPct = (p: number) => setB(x => ({ ...x, price: Math.round(full * (1 - p / 100)) }))
  const valid = lines.length > 0 && b.price > 0 && b.price <= full && (b.how.confirm || b.how.before || b.how.chat)
  const opt = <K extends 'audience' | 'who' | 'when'>(k: K, v: Bundle[K], title: string, sub: string) => (
    <button key={String(v)} type="button" className={`o-choice ${b[k] === v ? 'active' : ''}`} aria-pressed={b[k] === v} onClick={() => setB(x => ({ ...x, [k]: v }))}>
      <i /><span><b>{title}</b><small>{sub}</small></span>
    </button>
  )
  const how = (k: keyof Bundle['how'], Icon: typeof Coffee, title: string, sub: string) => (
    <button key={k} type="button" className={`o-choice check ${b.how[k] ? 'active' : ''}`} aria-pressed={b.how[k]} onClick={() => setB(x => ({ ...x, how: { ...x.how, [k]: !x.how[k] } }))}>
      <i /><Icon className="o-choice-icon" /><span><b>{title}</b><small>{sub}</small></span>
    </button>
  )
  return (
    <Sheet title={t('باقة جلسة عمل', 'Work-session bundle')} onClose={onClose} footer={
      <>
        <button type="button" className="o-primary" disabled={!valid} onClick={() => onSave(b)}><Sparkles />{t('فعّل الباقة', 'Turn on bundle')}</button>
        <button type="button" className="o-text-btn" onClick={onClose}>{t('رجوع', 'Back')}</button>
      </>
    }>
      <p className="o-sheet-sub">{t('يجلس من يلتقون في كافيهك أكثر من ساعتين في المتوسط. باقة بسعر واحد تشجعهم على طلب أكثر من البداية.', 'People who meet at your café stay over two hours on average. One price for a set makes them order more from the start.')}</p>

      <label className="o-label" htmlFor="o-bundle-name">{t('اسم الباقة', 'Bundle name')}</label>
      <input id="o-bundle-name" className="o-field" value={b.name} maxLength={30} onChange={e => setB(x => ({ ...x, name: e.target.value }))} />

      <span className="o-label">{t('ماذا تشمل', "What's in it")}</span>
      <div className="o-bundle-lines">
        {lines.map(({ item, q }) => (
          <div key={item.id}>
            <span><b>{tx(item.name)}</b><small>{sar(item.price ?? 0)}</small></span>
            <div className="o-mini-step">
              <button type="button" onClick={() => setQty(item.id, q - 1)} aria-label={t('أنقص', 'Less')}><Minus /></button>
              <b>{q}</b>
              <button type="button" onClick={() => setQty(item.id, q + 1)} aria-label={t('زِد', 'More')}><Plus /></button>
            </div>
          </div>
        ))}
        {!lines.length && <p className="o-empty">{t('أضف صنفًا واحدًا على الأقل.', 'Add at least one item.')}</p>}
        <button type="button" className="o-bundle-add" onClick={() => setAdding(a => !a)}><Plus />{adding ? t('إخفاء الأصناف', 'Hide items') : t('أضف صنفًا من المنيو', 'Add an item from the menu')}</button>
        {adding && (
          <div className="o-chips wrap o-bundle-pick">
            {ok.filter(i => !b.items[i.id]).map(i => <button key={i.id} type="button" className="o-chip" onClick={() => setQty(i.id, 1)}>{tx(i.name)} · {sar(i.price ?? 0)}</button>)}
          </div>
        )}
      </div>

      <span className="o-label">{t('سعر الباقة', 'Bundle price')}</span>
      <div className="o-bundle-price">
        <div className="o-inline-field"><input className="o-field" inputMode="numeric" value={b.price || ''} onChange={e => setB(x => ({ ...x, price: Math.max(0, Math.round(+e.target.value.replace(/\D/g, '') || 0)) }))} aria-label={t('سعر الباقة', 'Bundle price')} /><span>{t('ر.س', 'SAR')}</span></div>
        <small>{full > 0 && (b.price > full ? t('السعر أعلى من مجموع الأصناف', 'Price is above the items total') : t(`بدل ${sar(full)} · يوفّر العميل ${sar(save)} (${off}%)`, `instead of ${sar(full)} · saves ${sar(save)} (${off}%)`))}</small>
      </div>
      <div className="o-chips wrap">{[10, 15, 20, 25].map(p => <button key={p} type="button" className={`o-chip ${off === p ? 'active' : ''}`} onClick={() => setPct(p)}>{t(`خصم ${p}%`, `${p}% off`)}</button>)}</div>

      <span className="o-label">{t('لمن تظهر؟', 'Who is it for?')}</span>
      <div className="o-choices">
        {opt('audience', 'all', t('كل لقاء يُتفق عليه في كافيهك', 'Every meetup arranged at your café'), t('الأوسع وصولًا', 'Reaches the most people'))}
        {opt('audience', 'again', t('من يلتقون مرة أخرى فقط', 'Only people meeting again'), t('مكافأة لمن جعلوا كافيهك مكانهم', 'A reward for making your café their spot'))}
        {opt('audience', 'table', t('من يحجزون طاولة للقاء', 'People who book a table for the meetup'), t('يرتبط بالحجز المدفوع مسبقًا', 'Tied to a prepaid booking'))}
      </div>

      <span className="o-label">{t('من يستلمها؟', 'Who receives it?')}</span>
      <div className="o-choices">
        {opt('who', 'both', t('الشخصان معًا', 'Both people together'), t('باقة واحدة يتشاركانها، ويدفعها أحدهما', 'One bundle they share, paid by either'))}
        {opt('who', 'helped', t('من يحتاج المساعدة', 'The person getting help'), t('يدعو بها من ساعده، شكرًا له', 'They treat the helper as a thank-you'))}
      </div>

      <span className="o-label">{t('متى تتوفر؟', 'When is it available?')}</span>
      <div className="o-choices">
        {opt('when', 'all', t('طوال ساعات العمل', 'All opening hours'), t('في أي وقت يلتقون', 'Whenever they meet'))}
        {opt('when', 'quiet', t('في وقتك الهادئ فقط', 'Only in your quiet hours'), t('بين 1 و5 عصرًا، لملء الطاولات', '1 to 5pm, to fill tables'))}
      </div>

      <span className="o-label">{t('كيف تصلهم؟', 'How do they get it?')}</span>
      <div className="o-choices">
        {how('confirm', Sparkles, t('عند تأكيد اللقاء', 'When they confirm the meetup'), t('تظهر في شاشة التأكيد مع زر «اطلبها»', 'Shown on the confirm screen with an “Order it” button'))}
        {how('before', BellRing, t('إشعار قبل اللقاء بساعة', 'A reminder an hour before'), t('«باقتكما جاهزة للطلب المسبق»', '“Your bundle is ready to pre-order”'))}
        {how('chat', MessageCircle, t('داخل محادثة اللقاء', 'Inside the meetup chat'), t('بطاقة صغيرة يراها الطرفان', 'A small card both people see'))}
      </div>

      <span className="o-label">{t('هكذا تظهر لهم', 'What they see')}</span>
      <div className="o-offer-push"><BellRing /><span><b>{t(`${b.name || 'باقة جلسة عمل'} من ${cafe} ☕`, `${b.name || 'Work-session bundle'} from ${cafe} ☕`)}</b><small>{t(`${contents} بـ ${sar(b.price)} بدل ${sar(full)}`, `${contents} for ${sar(b.price)} instead of ${sar(full)}`)}</small></span></div>
      <div className="o-offer-preview">
        <Coffee />
        <span>
          <b>{b.name || t('باقة جلسة عمل', 'Work-session bundle')} · {sar(b.price)}</b>
          <small>{contents}</small>
          <em>{b.who === 'helped' ? t('ادعُ من ساعدك بها. تُطلب وتُدفع من التطبيق، وتجهز عند وصولكما.', 'Treat your helper. Order and pay in the app, ready when you arrive.') : t('لكما معًا. تُطلب وتُدفع من التطبيق، وتجهز عند وصولكما.', 'For you both. Order and pay in the app, ready when you arrive.')}</em>
        </span>
      </div>
      <p className="o-note"><Lock />{t('تصل الباقة عبر التطبيق، ولا يظهر لك من استلمها. ترى فقط كم طُلبت.', 'The bundle goes through the app. You never see who got it, only how many were ordered.')}</p>
    </Sheet>
  )
}

export function PerkSheet({ start, onSave, onClose }: { start: Perk; onSave: (p: Perk) => void; onClose: () => void }) {
  const { t, sar } = useT()
  const [cap, setCap] = useState(start.cap)
  return (
    <Sheet title={t('مكافأة لمن يساعد', 'A perk for helpers')} onClose={onClose} footer={
      <>
        <button type="button" className="o-primary" onClick={() => onSave({ cap })}><HeartHandshake />{t('فعّل المكافأة', 'Turn on perk')}</button>
        <button type="button" className="o-text-btn" onClick={onClose}>{t('رجوع', 'Back')}</button>
      </>
    }>
      <p className="o-sheet-sub">{t('من يستطيع المساعدة هو من يختار مكان اللقاء. مشروب مجاني له يجعله يختار كافيهك، ويأتي معه من يحتاج المساعدة ويطلب.', 'The helper usually picks where to meet. A free drink makes them pick your café, and the person they help comes and orders too.')}</p>
      <span className="o-label">{t('مشروب مجاني حتى', 'Free drink up to')}</span>
      <div className="o-chips wrap">{[15, 20, 25].map(c => <button key={c} type="button" className={`o-chip ${cap === c ? 'active' : ''}`} onClick={() => setCap(c)}>{sar(c)}</button>)}</div>
      <span className="o-label">{t('هكذا تظهر له', 'What they see')}</span>
      <div className="o-offer-preview">
        <HeartHandshake />
        <span><b>{t('مشروبك علينا عندما تساعد هنا', 'Your drink is on us when you help here')}</b><small>{t(`مشروب مجاني حتى ${sar(cap)} لمن يساعد في لقاء بكافيهنا.`, `A free drink up to ${sar(cap)} for anyone helping in a meetup at our café.`)}</small><em>{t('يظهر عند اختيار مكان اللقاء، ويُستلم من التطبيق بعد تأكيده.', 'Shown when choosing where to meet, claimed in the app once confirmed.')}</em></span>
      </div>
      <p className="o-note"><Lock />{t('تُمنح مرة لكل لقاء، ولا يظهر لك اسم من استلمها.', 'Given once per meetup. You never see who claimed it.')}</p>
    </Sheet>
  )
}
