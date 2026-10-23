import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Armchair, ArrowDown, ArrowUp, BadgeCheck, ClipboardList, Menu as MenuIcon, MessageCircle, ChartColumn, CakeSlice, Camera, Check, ChevronLeft, ChevronRight, CircleAlert, Coffee, Cookie, Croissant,
  CupSoda, Eye, FileText, GlassWater, ImagePlus, Languages, Leaf, Link2, MapPin, PenLine, Plus, Salad, Sandwich, ScanLine,
  Search, Sparkles, Star, Store, Trash2, Upload, Utensils, X,
} from 'lucide-react'
import Insights from './Insights'
import { Messages, Orders, Tables, useOps } from './Ops'
import { PLACES, PLATFORMS, SUGGESTED, importedMenu, scannedMenu } from './data'
import type { Category, IconKey, Item, Place, Text } from './data'

type Lang = 'ar' | 'en'
const LangCtx = createContext<{ lang: Lang; toggle: () => void }>({ lang: 'ar', toggle: () => undefined })
// t('عربي', 'English'): every line of copy is written in both languages where it's used.
export function useT() {
  const { lang } = useContext(LangCtx)
  return useMemo(() => {
    const t = (ar: string, en: string) => (lang === 'ar' ? ar : en)
    const tx = (x: Text) => (lang === 'ar' ? x.ar || x.en : x.en || x.ar)
    const sar = (n: number | string) => (lang === 'ar' ? `${n} ر.س` : `SAR ${n}`)
    // Counted nouns: Arabic changes the word with the number (صنف واحد، صنفين، 3 أصناف، 11 صنف).
    const count = (n: number, [one, two, few, many]: [string, string, string, string], en: string) =>
      lang === 'en' ? `${n} ${en}${n === 1 ? '' : 's'}` : n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`
    const items = (n: number) => count(n, ['صنف واحد', 'صنفين', 'أصناف', 'صنف'], 'item')
    const sections = (n: number) => count(n, ['قسم واحد', 'قسمين', 'أقسام', 'قسم'], 'section')
    return { lang, t, tx, sar, items, sections }
  }, [lang])
}

const ICONS: Record<IconKey, typeof Coffee> = {
  coffee: Coffee, iced: CupSoda, drink: GlassWater, cake: CakeSlice, pastry: Croissant, cookie: Cookie, sandwich: Sandwich, salad: Salad, tea: Leaf, other: Utensils,
}
const CatIcon = ({ icon }: { icon: IconKey }) => { const I = ICONS[icon]; return <I /> }

type Screen = 'welcome' | 'cafe' | 'verify' | 'method' | 'link' | 'pick' | 'reading' | 'review' | 'preview' | 'live'
type Source = 'photo' | 'link' | 'sample'
const STEP_OF: Partial<Record<Screen, number>> = { cafe: 0, verify: 0, method: 1, link: 1, pick: 1, reading: 1, review: 1, preview: 2 }

let uid = 100
const newId = (p: string) => `${p}${++uid}`

export default function Owner() {
  const [lang, setLang] = useState<Lang>('ar')
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = lang === 'ar' ? 'AroundMe للكافيهات' : 'AroundMe for coffee shops'
  }, [lang])
  return (
    <LangCtx.Provider value={{ lang, toggle: () => setLang(l => (l === 'ar' ? 'en' : 'ar')) }}>
      <div className="o-shell"><Flow /></div>
    </LangCtx.Provider>
  )
}

function Flow() {
  const { t } = useT()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [place, setPlace] = useState<Place | null>(null)
  const [source, setSource] = useState<Source>('photo')
  const [upload, setUpload] = useState<{ url?: string; name: string } | null>(null)
  const [platform, setPlatform] = useState(PLATFORMS[1].id)
  const [cats, setCats] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [toast, setToast] = useState('')
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => { body.current?.scrollTo({ top: 0 }) }, [screen])
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2600); return () => clearTimeout(id) }, [toast])

  const go = (s: Screen) => setScreen(s)
  const startReading = (s: Source) => { setSource(s); go('reading') }
  const loadMenu = () => {
    const m = source === 'link' ? importedMenu() : scannedMenu()
    setCats(m.cats); setItems(m.items); go('review')
  }
  const startManual = (picked: Category[]) => { setCats(picked); setItems([]); setSource('photo'); setUpload(null); go('review') }

  const step = STEP_OF[screen]
  const back: Partial<Record<Screen, Screen>> = { cafe: 'welcome', verify: 'cafe', method: 'verify', link: 'method', pick: 'method', review: 'method', preview: 'review' }
  const menu = { cats, setCats, items, setItems, notify: setToast }

  return (
    <div className="o-screen">
      <header className="o-top">
        {back[screen]
          ? <button type="button" className="o-icon-btn" onClick={() => go(back[screen]!)} aria-label={t('رجوع', 'Back')}><Chevron back /></button>
          : step !== undefined ? <span className="o-icon-spacer" /> : <Brand />}
        {step !== undefined && <Steps current={step} />}
        <LangToggle />
      </header>

      <div className="o-body" ref={body}>
        {screen === 'welcome' && <Welcome onStart={() => go('cafe')} />}
        {screen === 'cafe' && <FindCafe selected={place} onPick={p => { setPlace(p); go('verify') }} />}
        {screen === 'verify' && place && <Verify place={place} onDone={() => go('method')} />}
        {screen === 'method' && (
          <Method
            onFile={f => { setUpload(f); startReading('photo') }}
            onSample={() => { setUpload(null); startReading('sample') }}
            onLink={() => go('link')}
            onManual={() => go('pick')}
          />
        )}
        {screen === 'link' && <ImportLink platform={platform} setPlatform={setPlatform} onImport={() => startReading('link')} />}
        {screen === 'pick' && <PickCategories onDone={startManual} />}
        {screen === 'reading' && <Reading source={source} upload={upload} platform={platform} onDone={loadMenu} />}
        {screen === 'review' && <Review {...menu} source={source} platform={platform} onNext={() => go('preview')} />}
        {screen === 'preview' && place && <CustomerMenu place={place} cats={cats} items={items} />}
        {screen === 'live' && place && <Live {...menu} place={place} />}
      </div>

      {screen === 'preview' && (
        <footer className="o-footer">
          <p className="o-footer-note"><Eye />{t('هذا شكل المنيو عند عملائك في AroundMe', 'This is how customers see your menu in AroundMe')}</p>
          <button type="button" className="o-primary" onClick={() => { go('live'); setToast(t('نشرنا المنيو، وصار عملاؤك يقدرون يطلبون', 'Your menu is live. Customers can order now')) }}>{t('انشر المنيو', 'Publish menu')}</button>
          <button type="button" className="o-text-btn" onClick={() => go('review')}>{t('ارجع وعدّل', 'Go back and edit')}</button>
        </footer>
      )}

      {toast && <div className="o-toast" role="status"><Check />{toast}</div>}
    </div>
  )
}

const Chevron = ({ back }: { back?: boolean }) => {
  const { lang } = useT()
  // "Back" points to where the reader came from: right in Arabic, left in English.
  return !!back === (lang === 'ar') ? <ChevronRight /> : <ChevronLeft />
}

function Brand() {
  const { t } = useT()
  return <span className="o-brand"><b dir="ltr">Around<span>Me</span></b><em>{t('للكافيهات', 'for cafés')}</em></span>
}

function LangToggle() {
  const { lang, toggle } = useContext(LangCtx)
  return (
    <button type="button" className="o-lang" onClick={toggle} aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
      <Languages /><span>{lang === 'ar' ? 'EN' : 'العربية'}</span>
    </button>
  )
}

function Steps({ current }: { current: number }) {
  const { t } = useT()
  const labels = [t('الكافيه', 'Café'), t('المنيو', 'Menu'), t('النشر', 'Publish')]
  return (
    <ol className="o-steps" aria-label={t('الخطوات', 'Steps')}>
      {labels.map((l, i) => (
        <li key={l} className={i === current ? 'current' : i < current ? 'done' : ''} aria-current={i === current ? 'step' : undefined}>
          <span>{i < current ? <Check /> : i + 1}</span>{l}
        </li>
      ))}
    </ol>
  )
}

function Head({ icon, title, sub }: { icon?: ReactNode; title: string; sub?: string }) {
  return (
    <div className="o-head">
      {icon && <span className="o-head-icon">{icon}</span>}
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
    </div>
  )
}

/* ---------- Welcome ---------- */
function Welcome({ onStart }: { onStart: () => void }) {
  const { t } = useT()
  const points: [ReactNode, string, string][] = [
    [<Store />, t('لقينا كافيهك', 'We find your café'), t('من خرائط Google، بالاسم والموقع والصور', 'From Google Maps, with its name, location and photos')],
    [<ScanLine />, t('صوّر المنيو', 'Snap your menu'), t('نقرأ الأقسام والأصناف والأسعار عنك', 'We read the sections, items and prices for you')],
    [<BadgeCheck />, t('راجع وانشر', 'Check and publish'), t('تصحح أي شي، وعملاؤك يطلبون على طول', 'Fix anything, and customers can order right away')],
  ]
  return (
    <div className="o-pad o-welcome">
      <div className="o-hero">
        <span className="o-hero-badge"><Sparkles />{t('أقل من 5 دقايق', 'Under 5 minutes')}</span>
        <h1>{t('خلّ كافيهك على AroundMe', 'Put your café on AroundMe')}</h1>
        <p>{t('عملاؤك يحجزون طاولة ويطلبون قبل يوصلون، وأنت ترفع المنيو بصورة وحدة.', 'Customers book a table and order before they arrive. You add your menu with one photo.')}</p>
      </div>
      <ol className="o-points">
        {points.map(([icon, h, p], i) => (
          <li key={h}><span className="o-point-icon">{icon}<i>{i + 1}</i></span><div><b>{h}</b><small>{p}</small></div></li>
        ))}
      </ol>
      <div className="o-sticky">
        <button type="button" className="o-primary" onClick={onStart}>{t('ابدأ', 'Get started')}</button>
        <p className="o-fine">{t('مجاني للتجربة، وتقدر تعدّل المنيو أي وقت', 'Free to try, and you can edit your menu any time')}</p>
      </div>
    </div>
  )
}

/* ---------- Find the café on Google ---------- */
function FindCafe({ selected, onPick }: { selected: Place | null; onPick: (p: Place) => void }) {
  const { t, tx } = useT()
  const [q, setQ] = useState('')
  const shown = PLACES.filter(p => !q.trim() || `${p.name.ar} ${p.name.en} ${p.area.ar} ${p.area.en}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="o-pad">
      <Head icon={<Store />} title={t('وش اسم كافيهك؟', "What's your café called?")} sub={t('نجيب معلوماته من خرائط Google', 'We bring its details from Google Maps')} />
      <label className="o-search">
        <Search />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('ابحث باسم الكافيه أو الحي', 'Search by café name or district')} aria-label={t('ابحث عن كافيهك', 'Search for your café')} />
        {q && <button type="button" onClick={() => setQ('')} aria-label={t('امسح', 'Clear')}><X /></button>}
      </label>
      <p className="o-source"><GoogleG />{t('نتائج من خرائط Google', 'Results from Google Maps')}</p>
      {shown.length ? (
        <ul className="o-places">
          {shown.map(p => (
            <li key={p.id}>
              <button type="button" className={selected?.id === p.id ? 'active' : ''} onClick={() => onPick(p)}>
                <PlaceLogo place={p} />
                <span className="o-place-copy"><b>{tx(p.name)}</b><small><MapPin />{tx(p.area)}</small></span>
                <span className="o-rating"><Star />{p.rating}</span>
                <Chevron />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="o-empty"><Search /><b>{t('ما لقينا كافيه بهالاسم', 'No café found with that name')}</b><small>{t('جرّب اسم الحي أو جزء من الاسم', 'Try the district or part of the name')}</small></div>
      )}
    </div>
  )
}

function PlaceLogo({ place, big }: { place: Place; big?: boolean }) {
  const { tx } = useT()
  return place.logo
    ? <img className={`o-place-logo ${big ? 'big' : ''}`} src={place.logo} alt="" />
    : <span className={`o-place-logo initial ${big ? 'big' : ''}`} aria-hidden>{tx(place.name).charAt(0)}</span>
}

const GoogleG = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="o-g">
    <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
    <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.7H2.1v2.8A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.4-.4-2s.1-1.4.4-2V7.2H2.1a11 11 0 0 0 0 9.6L5.7 14z" />
    <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.2L5.7 10c.9-2.7 3.4-4.6 6.3-4.6z" />
  </svg>
)

/* ---------- Prove it's their café ---------- */
function Verify({ place, onDone }: { place: Place; onDone: () => void }) {
  const { t, tx } = useT()
  const [code, setCode] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => { if (code.length === 6) { const id = setTimeout(onDone, 450); return () => clearTimeout(id) } }, [code, onDone])
  return (
    <div className="o-pad">
      <div className="o-place-card">
        <PlaceLogo place={place} big />
        <div><b>{tx(place.name)}</b><small><MapPin />{tx(place.area)}</small><small><Star />{place.rating} · {t(`${place.reviews} تقييم`, `${place.reviews} reviews`)}</small></div>
      </div>
      <Head title={t('نتأكد إنه كافيهك', "Let's confirm it's yours")} sub={t(`أرسلنا كود لرقم الكافيه المسجل في Google، المنتهي بـ ${place.phone}`, `We sent a code to the café's number on Google, ending in ${place.phone}`)} />
      <label className="o-otp" onClick={() => input.current?.focus()}>
        <input ref={input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label={t('الكود', 'Code')} />
        <span className="o-otp-boxes" dir="ltr" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => <span key={i} className={`${code[i] ? 'filled' : ''} ${i === Math.min(code.length, 5) ? 'caret' : ''} ${code.length === 6 ? 'ok' : ''}`}>{code[i] ?? ''}</span>)}
        </span>
      </label>
      <p className="o-hint">{code.length === 6 ? <><Check />{t('تم التأكيد', 'Confirmed')}</> : t('للتجربة: اكتب أي 6 أرقام', 'For this demo: type any 6 digits')}</p>
      <button type="button" className="o-text-btn" onClick={() => setCode('482913')}>{t('عبّي الكود عني', 'Fill in the code for me')}</button>
    </div>
  )
}

/* ---------- How to add the menu ---------- */
function Method({ onFile, onSample, onLink, onManual }: { onFile: (f: { url?: string; name: string }) => void; onSample: () => void; onLink: () => void; onManual: () => void }) {
  const { t } = useT()
  const camera = useRef<HTMLInputElement>(null)
  const files = useRef<HTMLInputElement>(null)
  const pick = (list: FileList | null) => {
    const f = list?.[0]
    if (f) onFile({ url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined, name: f.name })
  }
  return (
    <div className="o-pad">
      <Head icon={<Utensils />} title={t('كيف تحب تضيف المنيو؟', 'How would you like to add your menu?')} sub={t('اختر الأسهل لك، وتقدر تعدّل كل شي بعدين', 'Pick the easiest way. You can change anything later')} />
      <div className="o-method-hero">
        <span className="o-reco"><Sparkles />{t('الأسرع', 'Fastest')}</span>
        <ScanLine className="o-method-art" />
        <b>{t('صوّر المنيو', 'Snap your menu')}</b>
        <small>{t('صورة للوحة المنيو أو المنيو المطبوع أو ملف PDF. نقرأ الأقسام والأصناف والأسعار، وأنت تراجع.', 'A photo of your menu board, a printed menu or a PDF. We read the sections, items and prices, and you check them.')}</small>
        <div className="o-method-actions">
          <button type="button" className="o-primary" onClick={() => camera.current?.click()}><Camera />{t('صوّر', 'Take photo')}</button>
          <button type="button" className="o-secondary" onClick={() => files.current?.click()}><Upload />{t('ارفع صورة أو PDF', 'Upload a file')}</button>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e => pick(e.target.files)} />
        <input ref={files} type="file" accept="image/*,application/pdf" hidden onChange={e => pick(e.target.files)} />
        <button type="button" className="o-text-btn" onClick={onSample}>{t('ما عندك صورة الحين؟ جرّب بمنيو تجريبي', 'No photo right now? Try a sample menu')}</button>
      </div>
      <div className="o-rows">
        <button type="button" className="o-row" onClick={onLink}>
          <span className="o-row-icon"><Link2 /></span>
          <span><b>{t('استورده من تطبيق توصيل', 'Import from a delivery app')}</b><small>{t('هنقرستيشن، جاهز أو فودكس', 'HungerStation, Jahez or Foodics')}</small></span>
          <Chevron />
        </button>
        <button type="button" className="o-row" onClick={onManual}>
          <span className="o-row-icon"><PenLine /></span>
          <span><b>{t('أضيفه بنفسي', "I'll add it myself")}</b><small>{t('نبدأ لك بأقسام جاهزة', 'We start you off with ready-made sections')}</small></span>
          <Chevron />
        </button>
      </div>
    </div>
  )
}

function ImportLink({ platform, setPlatform, onImport }: { platform: string; setPlatform: (p: string) => void; onImport: () => void }) {
  const { t, tx } = useT()
  const [url, setUrl] = useState('')
  const p = PLATFORMS.find(x => x.id === platform)!
  return (
    <div className="o-pad o-fill">
      <Head icon={<Link2 />} title={t('استورد المنيو', 'Import your menu')} sub={t('نجيب الأقسام والأصناف والأسعار من صفحتك', 'We bring the sections, items and prices from your page')} />
      <label className="o-label">{t('وين منيوك موجود؟', 'Where is your menu now?')}</label>
      <div className="o-chips">
        {PLATFORMS.map(x => <button key={x.id} type="button" className={`o-chip ${platform === x.id ? 'active' : ''}`} onClick={() => setPlatform(x.id)}>{tx(x.name)}</button>)}
      </div>
      <label className="o-label" htmlFor="o-link">{t(`رابط صفحتك في ${tx(p.name)}`, `Your ${tx(p.name)} page link`)}</label>
      <input id="o-link" className="o-field" dir="ltr" inputMode="url" value={url} onChange={e => setUrl(e.target.value)} placeholder={`https://${platform === 'foodics' ? 'menu.foodics.com' : platform === 'jahez' ? 'jahez.net' : 'hungerstation.com'}/…`} />
      <p className="o-hint">{t('للتجربة: أي رابط يمشي', 'For this demo: any link works')}</p>
      <div className="o-sticky">
        <button type="button" className="o-primary" disabled={!url.trim()} onClick={onImport}>{t('استورد', 'Import')}</button>
      </div>
    </div>
  )
}

function PickCategories({ onDone }: { onDone: (cats: Category[]) => void }) {
  const { t, tx, sections: nSections } = useT()
  const [on, setOn] = useState<string[]>(['hot', 'cold', 'sweets', 'pastry'])
  const flip = (id: string) => setOn(o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id]))
  return (
    <div className="o-pad o-fill">
      <Head icon={<PenLine />} title={t('وش تقدّم؟', 'What do you serve?')} sub={t('اختر أقسام منيوك. تقدر تغيّر أسماءها وتضيف غيرها', 'Pick the sections of your menu. You can rename them and add more')} />
      <div className="o-cat-grid">
        {SUGGESTED.map(c => (
          <button key={c.id} type="button" className={`o-cat-tile ${on.includes(c.id) ? 'active' : ''}`} aria-pressed={on.includes(c.id)} onClick={() => flip(c.id)}>
            <CatIcon icon={c.icon} /><span>{tx(c.name)}</span>{on.includes(c.id) && <i><Check /></i>}
          </button>
        ))}
      </div>
      <div className="o-sticky">
        <button type="button" className="o-primary" disabled={!on.length} onClick={() => onDone(SUGGESTED.filter(c => on.includes(c.id)))}>
          {on.length ? t(`تابع بـ ${nSections(on.length)}`, `Continue with ${nSections(on.length)}`) : t('اختر قسم واحد على الأقل', 'Pick at least one section')}
        </button>
      </div>
    </div>
  )
}

/* ---------- Reading the menu ---------- */
function Reading({ source, upload, platform, onDone }: { source: Source; upload: { url?: string; name: string } | null; platform: string; onDone: () => void }) {
  const { t, tx } = useT()
  const [phase, setPhase] = useState(0)
  const p = PLATFORMS.find(x => x.id === platform)!
  const phases = source === 'link'
    ? [t(`نفتح صفحتك في ${tx(p.name)}`, `Opening your ${tx(p.name)} page`), t('نجيب الأقسام والأصناف', 'Bringing in sections and items'), t('نرتب الأسعار والصور', 'Sorting prices and photos')]
    : [t('نلقى أقسام المنيو', 'Finding the menu sections'), t('نقرأ الأصناف والوصف', 'Reading items and descriptions'), t('نطابق الأسعار', 'Matching prices')]
  useEffect(() => {
    const ids = [900, 1900, 2900].map((ms, i) => setTimeout(() => setPhase(i + 1), ms))
    const done = setTimeout(onDone, 3500)
    return () => { ids.forEach(clearTimeout); clearTimeout(done) }
  }, [onDone])
  return (
    <div className="o-pad o-reading">
      <div className="o-scan">
        {source === 'link'
          ? <div className="o-scan-link"><Link2 /><b>{tx(p.name)}</b></div>
          : upload?.url ? <img src={upload.url} alt="" /> : upload ? <div className="o-scan-link"><FileText /><b dir="ltr">{upload.name}</b></div> : <SampleMenuArt />}
        {source !== 'link' && <span className="o-scan-line" />}
      </div>
      <h1>{source === 'link' ? t('نستورد منيوك…', 'Importing your menu…') : t('نقرأ منيوك…', 'Reading your menu…')}</h1>
      <ul className="o-phases">
        {phases.map((x, i) => <li key={x} className={i < phase ? 'done' : i === phase ? 'current' : ''}><span>{i < phase ? <Check /> : null}</span>{x}</li>)}
      </ul>
    </div>
  )
}

// A drawn stand-in for a printed menu when the owner tries the sample.
function SampleMenuArt() {
  const { t } = useT()
  const col = (h: string, rows: string[]) => (
    <div><b>{h}</b>{rows.map(r => <span key={r}><i>{r}</i><em /></span>)}</div>
  )
  return (
    <div className="o-paper" aria-hidden>
      <strong>{t('المنيو', 'MENU')}</strong>
      <div className="o-paper-cols">
        {col(t('قهوة', 'Coffee'), [t('لاتيه', 'Latte'), t('سبانش', 'Spanish'), 'V60', t('كورتادو', 'Cortado')])}
        {col(t('حلا', 'Desserts'), [t('تشيز كيك', 'Cheesecake'), t('كيكة عسل', 'Honey cake'), t('براونيز', 'Brownie')])}
        {col(t('معجنات', 'Pastries'), [t('كرواسون', 'Croissant'), t('زعتر', 'Zaatar'), t('كوكيز', 'Cookie')])}
        {col(t('باردة', 'Iced'), [t('آيس لاتيه', 'Iced latte'), t('كولد برو', 'Cold brew')])}
      </div>
    </div>
  )
}

/* ---------- Shared menu editing ---------- */
type MenuProps = {
  cats: Category[]; setCats: (f: (c: Category[]) => Category[]) => void
  items: Item[]; setItems: (f: (i: Item[]) => Item[]) => void
  notify: (s: string) => void
}

function useMenuEditor({ cats, setCats, items, setItems, notify }: MenuProps) {
  const { t, tx } = useT()
  const [editing, setEditing] = useState<Item | null>(null)
  const [catsOpen, setCatsOpen] = useState(false)
  const save = (it: Item) => {
    setItems(list => (list.some(x => x.id === it.id) ? list.map(x => (x.id === it.id ? it : x)) : [...list, it]))
    setEditing(null)
  }
  const remove = (it: Item) => { setItems(list => list.filter(x => x.id !== it.id)); setEditing(null); notify(t(`حذفنا «${tx(it.name)}»`, `Removed “${tx(it.name)}”`)) }
  const blank = (cat: string): Item => ({ id: newId('n'), cat, name: { ar: '', en: '' }, desc: { ar: '', en: '' }, price: null, soldOut: false })
  const sheets = (
    <>
      {editing && <ItemSheet item={editing} cats={cats} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />}
      {catsOpen && <CategoriesSheet {...{ cats, setCats, items, setItems }} onClose={() => setCatsOpen(false)} />}
    </>
  )
  return { edit: setEditing, add: (cat: string) => setEditing(blank(cat)), openCats: () => setCatsOpen(true), sheets }
}

// Each café has its own sections. Up to three fit as equal tabs like the customer app; more become chips you swipe sideways.
function MenuTabs({ cats, current, onPick, counts, extra }: { cats: Category[]; current: string; onPick: (id: string) => void; counts?: Record<string, number>; extra?: ReactNode }) {
  const { tx } = useT()
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => { row.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [current])
  const segmented = cats.length <= 3 && !extra
  return (
    <div ref={row} className={segmented ? 'o-segmented' : 'o-tab-chips'} role="tablist">
      {cats.map(c => (
        <button key={c.id} type="button" role="tab" aria-selected={current === c.id} className={current === c.id ? 'active' : ''} onClick={() => onPick(c.id)}>
          {tx(c.name)}{counts && counts[c.id] > 0 && <i className="o-dot" aria-hidden>{counts[c.id]}</i>}
        </button>
      ))}
      {extra}
    </div>
  )
}

function ItemRow({ item, cat, onOpen, trailing }: { item: Item; cat?: Category; onOpen?: () => void; trailing?: ReactNode }) {
  const { t, tx, sar } = useT()
  const copy = (
    <>
      <span className="o-item-icon">{item.photo ? <img src={item.photo} alt="" /> : <CatIcon icon={cat?.icon ?? 'other'} />}</span>
      <span className="o-item-copy">
        <b>{tx(item.name) || t('صنف بدون اسم', 'Untitled item')}</b>
        {tx(item.desc) && <small>{tx(item.desc)}</small>}
        <em>{item.price == null ? <span className="o-warn-text">{t('بدون سعر', 'No price')}</span> : sar(item.price)}</em>
        {item.flag && <span className="o-flag"><CircleAlert />{item.flag === 'price' ? t('ما قدرنا نقرأ السعر، أكّده', "Couldn't read the price, please check") : t('تأكد من الاسم', 'Check the name')}</span>}
      </span>
    </>
  )
  return (
    <li className={`o-item ${item.flag ? 'flagged' : ''} ${item.soldOut ? 'sold-out' : ''}`}>
      {onOpen ? <button type="button" className="o-item-main" onClick={onOpen}>{copy}</button> : <div className="o-item-main">{copy}</div>}
      {trailing}
    </li>
  )
}

/* ---------- Review what was read ---------- */
function Review(props: MenuProps & { source: Source; platform: string; onNext: () => void }) {
  const { cats, items, setItems, source, platform, onNext } = props
  const { t, tx, items: nItems, sections: nSections } = useT()
  const [cur, setCur] = useState(cats[0]?.id ?? '')
  const ed = useMenuEditor(props)
  useEffect(() => { if (!cats.some(c => c.id === cur)) setCur(cats[0]?.id ?? '') }, [cats, cur])
  const flagged = items.filter(i => i.flag)
  const flagCounts = Object.fromEntries(cats.map(c => [c.id, flagged.filter(i => i.cat === c.id).length]))
  const inCat = items.filter(i => i.cat === cur)
  const p = PLATFORMS.find(x => x.id === platform)!
  const sub = !items.length
    ? t('أضف أصنافك في كل قسم', 'Add your items to each section')
    : source === 'link'
      ? t(`استوردنا ${nSections(cats.length)} و${nItems(items.length)} من ${tx(p.name)}`, `Imported ${nSections(cats.length)} and ${nItems(items.length)} from ${tx(p.name)}`)
      : t(`لقينا ${nSections(cats.length)} و${nItems(items.length)}. صحّح أي شي غلط.`, `We found ${nSections(cats.length)} and ${nItems(items.length)}. Fix anything that's wrong.`)
  const showFirstFlag = () => { const f = flagged[0]; if (f) { setCur(f.cat); ed.edit(f) } }

  return (
    <>
      <div className="o-pad o-review">
        <div className="o-head o-head-row">
          <span className="o-head-icon"><BadgeCheck /></span>
          <div><h1>{t('راجع المنيو', 'Check your menu')}</h1><p>{sub}</p></div>
        </div>

        {flagged.length > 0 && (
          <div className="o-banner">
            <CircleAlert />
            <span>{t(`${nItems(flagged.length)} ${flagged.length === 1 ? 'يحتاج مراجعة' : 'تحتاج مراجعة'}`, `${nItems(flagged.length)} need${flagged.length === 1 ? 's' : ''} a check`)}</span>
            <button type="button" onClick={showFirstFlag}>{t('وريني', 'Show me')}</button>
          </div>
        )}

        <div className="o-label-row">
          <label className="o-label">{t('الأقسام', 'Sections')}</label>
          <button type="button" className="o-text-btn o-inline" onClick={ed.openCats}><PenLine />{t('رتّب وعدّل', 'Edit and reorder')}</button>
        </div>
        <MenuTabs cats={cats} current={cur} onPick={setCur} counts={flagCounts} extra={<button type="button" className="o-add-chip" onClick={ed.openCats} aria-label={t('أضف قسم', 'Add section')}><Plus /></button>} />

        <ul className="o-items">
          {inCat.map(i => <ItemRow key={i.id} item={i} cat={cats.find(c => c.id === i.cat)} onOpen={() => ed.edit(i)} trailing={i.flag ? <button type="button" className="o-confirm" onClick={() => i.price == null ? ed.edit(i) : setItems(l => l.map(x => (x.id === i.id ? { ...x, flag: undefined } : x)))}>{i.price == null ? t('أضف السعر', 'Add price') : t('صحيح', 'Looks right')}</button> : <Chevron />} />)}
        </ul>
        {!inCat.length && <div className="o-empty small"><CatIcon icon={cats.find(c => c.id === cur)?.icon ?? 'other'} /><b>{t('ما فيه أصناف في هالقسم بعد', 'No items in this section yet')}</b></div>}
        {cur && <button type="button" className="o-dashed" onClick={() => ed.add(cur)}><Plus />{t(`أضف صنف في ${tx(cats.find(c => c.id === cur)!.name)}`, `Add an item to ${tx(cats.find(c => c.id === cur)!.name)}`)}</button>}
      </div>

      <footer className="o-footer">
        {flagged.length
          ? <button type="button" className="o-primary warn" onClick={showFirstFlag}>{flagged.length === 1 ? t('راجع الصنف الباقي', 'Check the last item') : t(`راجع ${nItems(flagged.length)} باقية`, `Check ${nItems(flagged.length)} left`)}</button>
          : <button type="button" className="o-primary" disabled={!items.length} onClick={onNext}>{items.length ? t('شوف المنيو مثل عملائك', 'See it as customers will') : t('أضف صنف واحد على الأقل', 'Add at least one item')}</button>}
      </footer>
      {ed.sheets}
    </>
  )
}

/* ---------- Bottom sheets ---------- */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { t } = useT()
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="o-sheet-layer" onClick={onClose}>
      <div className="o-sheet" role="dialog" aria-modal aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="o-sheet-head"><h2>{title}</h2><button type="button" className="o-close" onClick={onClose} aria-label={t('إغلاق', 'Close')}><X /></button></div>
        <div className="o-sheet-body">{children}</div>
        {footer && <div className="o-sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

function ItemSheet({ item, cats, onSave, onDelete, onClose }: { item: Item; cats: Category[]; onSave: (i: Item) => void; onDelete: (i: Item) => void; onClose: () => void }) {
  const { lang, t, tx } = useT()
  const isNew = !item.name.ar && !item.name.en
  const [name, setName] = useState(tx(item.name))
  const [desc, setDesc] = useState(tx(item.desc))
  const [price, setPrice] = useState(item.price == null ? '' : String(item.price))
  const [cat, setCat] = useState(item.cat)
  const [photo, setPhoto] = useState(item.photo)
  const [soldOut, setSoldOut] = useState(item.soldOut)
  const file = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (item.flag === 'price') priceRef.current?.focus() }, [item.flag])
  const n = Number(price.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
  const valid = name.trim() && price.trim() && n > 0
  // The owner types in the language they're using; the other language keeps its text until it's edited there.
  const setText = (x: Text, v: string): Text => ({ ...x, [lang]: v.trim() })
  const save = () => valid && onSave({ ...item, name: setText(item.name, name), desc: setText(item.desc, desc), price: n, cat, photo, soldOut, flag: undefined })
  return (
    <Sheet
      title={isNew ? t('صنف جديد', 'New item') : t('عدّل الصنف', 'Edit item')}
      onClose={onClose}
      footer={<>
        <button type="button" className="o-primary" disabled={!valid} onClick={save}>{isNew ? t('أضف الصنف', 'Add item') : t('احفظ', 'Save')}</button>
        {!isNew && <button type="button" className="o-text-btn danger" onClick={() => onDelete(item)}><Trash2 />{t('احذف الصنف', 'Delete item')}</button>}
      </>}
    >
      {item.flag && <p className="o-note warn"><CircleAlert />{item.flag === 'price' ? t('السعر ما كان واضح في الصورة. اكتبه هنا.', "The price wasn't clear in the photo. Type it here.") : t('الاسم ما كان واضح في الصورة. تأكد إنه صحيح.', "The name wasn't clear in the photo. Make sure it's right.")}</p>}
      <div className="o-photo-row">
        <button type="button" className="o-photo" onClick={() => file.current?.click()} aria-label={t('أضف صورة', 'Add photo')}>
          {photo ? <img src={photo} alt="" /> : <ImagePlus />}
        </button>
        <div><b>{photo ? t('صورة الصنف', 'Item photo') : t('أضف صورة', 'Add a photo')}</b><small>{t('اختياري. الأصناف اللي لها صور تنطلب أكثر', 'Optional. Items with photos get ordered more')}</small>
          {photo && <button type="button" className="o-text-btn o-inline danger" onClick={() => setPhoto(undefined)}>{t('شيل الصورة', 'Remove photo')}</button>}
        </div>
        <input ref={file} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)) }} />
      </div>
      <label className="o-label" htmlFor="o-name">{t('الاسم', 'Name')}</label>
      <input id="o-name" className={`o-field ${item.flag === 'name' ? 'warn' : ''}`} value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder={t('مثلاً: تشيز كيك لوتس', 'e.g. Lotus cheesecake')} />
      <label className="o-label" htmlFor="o-desc">{t('الوصف', 'Description')} <span className="o-optional">{t('اختياري', 'Optional')}</span></label>
      <input id="o-desc" className="o-field" value={desc} onChange={e => setDesc(e.target.value)} maxLength={60} placeholder={t('مثلاً: قطعة بصوص اللوتس', 'e.g. A slice with Lotus sauce')} />
      <label className="o-label" htmlFor="o-price">{t('السعر', 'Price')}</label>
      <div className={`o-price ${item.flag === 'price' && !price ? 'warn' : ''}`}>
        <input id="o-price" ref={priceRef} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.٠-٩]/g, ''))} placeholder="0" />
        <span>{t('ر.س', 'SAR')}</span>
      </div>
      <label className="o-label">{t('القسم', 'Section')}</label>
      <div className="o-chips wrap">
        {cats.map(c => <button key={c.id} type="button" className={`o-chip ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}><CatIcon icon={c.icon} />{tx(c.name)}</button>)}
      </div>
      <button type="button" className="o-switch-row" role="switch" aria-checked={!soldOut} onClick={() => setSoldOut(s => !s)}>
        <span><b>{soldOut ? t('نفد', 'Sold out') : t('متوفر', 'Available')}</b><small>{soldOut ? t('يبان لعملائك بس ما يقدرون يطلبونه', "Customers see it but can't order it") : t('عملاؤك يقدرون يطلبونه', 'Customers can order it')}</small></span>
        <em className={!soldOut ? 'on' : ''} />
      </button>
    </Sheet>
  )
}

function CategoriesSheet({ cats, setCats, items, setItems, onClose }: Pick<MenuProps, 'cats' | 'setCats' | 'items' | 'setItems'> & { onClose: () => void }) {
  const { lang, t, tx, items: nItems } = useT()
  const [custom, setCustom] = useState('')
  const [confirm, setConfirm] = useState<Category | null>(null)
  // Item counts per section, so deleting a full section asks first.
  const counts = items.reduce<Record<string, number>>((a, i) => ({ ...a, [i.cat]: (a[i.cat] ?? 0) + 1 }), {})
  const move = (i: number, d: number) => setCats(cs => { const n = [...cs]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n })
  const rename = (id: string, v: string) => setCats(cs => cs.map(c => (c.id === id ? { ...c, name: { ...c.name, [lang]: v } } : c)))
  const drop = (c: Category) => { setCats(cs => cs.filter(x => x.id !== c.id)); setItems(list => list.filter(i => i.cat !== c.id)); setConfirm(null) }
  const add = (c: Category) => setCats(cs => [...cs, c])
  const addCustom = () => { const v = custom.trim(); if (!v) return; add({ id: newId('c'), name: { ar: v, en: v }, icon: 'other' }); setCustom('') }
  const unused = SUGGESTED.filter(s => !cats.some(c => c.id === s.id))
  return (
    <Sheet title={t('أقسام المنيو', 'Menu sections')} onClose={onClose} footer={<button type="button" className="o-primary" onClick={onClose}>{t('تم', 'Done')}</button>}>
      <p className="o-sheet-sub">{t('نفس الترتيب يشوفه عملاؤك. اضغط على الاسم عشان تغيّره.', 'Customers see them in this order. Tap a name to change it.')}</p>
      <ul className="o-cat-list">
        {cats.map((c, i) => (
          <li key={c.id}>
            <span className="o-cat-icon"><CatIcon icon={c.icon} /></span>
            <input value={c.name[lang]} onChange={e => rename(c.id, e.target.value)} onBlur={e => !e.target.value.trim() && rename(c.id, lang === 'ar' ? c.name.en : c.name.ar)} aria-label={t('اسم القسم', 'Section name')} maxLength={24} />
            <small>{counts[c.id] ? nItems(counts[c.id]) : t('فاضي', 'Empty')}</small>
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('لفوق', 'Move up')}><ArrowUp /></button>
            <button type="button" disabled={i === cats.length - 1} onClick={() => move(i, 1)} aria-label={t('لتحت', 'Move down')}><ArrowDown /></button>
            <button type="button" className="danger" disabled={cats.length === 1} onClick={() => (counts[c.id] ? setConfirm(c) : drop(c))} aria-label={t('احذف القسم', 'Delete section')}><Trash2 /></button>
          </li>
        ))}
      </ul>
      {confirm && (
        <div className="o-note warn o-confirm-box">
          <CircleAlert />
          <span>{t(`نحذف «${tx(confirm.name)}» و${nItems(counts[confirm.id])} فيه؟`, `Delete “${tx(confirm.name)}” and its ${nItems(counts[confirm.id])}?`)}</span>
          <button type="button" onClick={() => setConfirm(null)}>{t('لا', 'No')}</button>
          <button type="button" className="danger" onClick={() => drop(confirm)}>{t('احذف', 'Delete')}</button>
        </div>
      )}
      <label className="o-label">{t('أضف قسم', 'Add a section')}</label>
      {unused.length > 0 && <div className="o-chips wrap">{unused.map(s => <button key={s.id} type="button" className="o-chip" onClick={() => add(s)}><Plus />{tx(s.name)}</button>)}</div>}
      <div className="o-add-field">
        <input className="o-field" value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom()} maxLength={24} placeholder={t('اسم قسم ثاني، مثلاً: عروض الصباح', 'Another name, e.g. Morning deals')} />
        <button type="button" className="o-secondary" disabled={!custom.trim()} onClick={addCustom}>{t('أضف', 'Add')}</button>
      </div>
    </Sheet>
  )
}

/* ---------- What customers see ---------- */
function CustomerMenu({ place, cats, items }: { place: Place; cats: Category[]; items: Item[] }) {
  const { t, tx, sar, items: nItems, sections: nSections } = useT()
  const shown = cats.filter(c => items.some(i => i.cat === c.id))
  const [cur, setCur] = useState(shown[0]?.id ?? '')
  return (
    <div className="o-pad o-customer">
      <div className="o-phone-preview">
        <div className="o-cust-head">
          <PlaceLogo place={place} />
          <div><b>{tx(place.name)}</b><small>{t('اطلب قبل توصل', 'Order before you arrive')}</small></div>
        </div>
        <MenuTabs cats={shown} current={cur} onPick={setCur} />
        <ul className="o-items">
          {items.filter(i => i.cat === cur).map(i => (
            <ItemRow key={i.id} item={i} cat={cats.find(c => c.id === i.cat)} trailing={i.soldOut ? <span className="o-sold">{t('نفد', 'Sold out')}</span> : <span className="o-add" aria-hidden><Plus /></span>} />
          ))}
        </ul>
        <p className="o-fine">{`${nSections(shown.length)} · ${nItems(items.length)}`}</p>
      </div>
    </div>
  )
}

/* ---------- After publishing: the café's dashboard ---------- */
type View = 'orders' | 'tables' | 'messages' | 'insights' | 'menu'
const NAV: [View, typeof Coffee, string, string][] = [
  ['orders', ClipboardList, 'الطلبات', 'Orders'], ['tables', Armchair, 'الطاولات', 'Tables'], ['messages', MessageCircle, 'الرسائل', 'Messages'],
  ['insights', ChartColumn, 'الأداء', 'Performance'], ['menu', Utensils, 'المنيو', 'Menu'],
]
function Live(props: MenuProps & { place: Place }) {
  const { cats, items, setItems, notify, place } = props
  const { t, tx } = useT()
  const [cur, setCur] = useState(cats[0]?.id ?? '')
  const [preview, setPreview] = useState(false)
  const [view, setViewRaw] = useState<View>('orders')
  const [thread, setThread] = useState<string | null>(null)
  const ops = useOps()
  const setView = (v: View) => { setViewRaw(v); document.querySelector('.o-body')?.scrollTo(0, 0) }
  const openThread = (code: string) => { setView('messages'); setThread(code) }
  const ed = useMenuEditor(props)
  useEffect(() => { if (!cats.some(c => c.id === cur)) setCur(cats[0]?.id ?? '') }, [cats, cur])
  const soldOut = items.filter(i => i.soldOut).length
  const newOrders = ops.orders.filter(o => o.status === 'new').length
  const unread = ops.threads.filter(x => x.unread).length
  const lateTables = ops.bookings.filter(b => b.state === 'upcoming' && ops.now > b.at).length + ops.tables.filter(x => x.seatedAt && x.limit && ops.now - x.seatedAt > x.limit * 60_000).length
  const badges: Record<View, number> = { orders: newOrders, tables: lateTables, messages: unread, insights: 0, menu: soldOut }
  const totalBadge = newOrders + unread + lateTables
  const [drawer, setDrawer] = useState(false)
  const toggle = (i: Item) => {
    setItems(l => l.map(x => (x.id === i.id ? { ...x, soldOut: !x.soldOut } : x)))
    notify(i.soldOut ? t(`«${tx(i.name)}» رجع متوفر`, `“${tx(i.name)}” is available again`) : t(`«${tx(i.name)}» صار نفد، وما ينطلب لين ترجعه`, `“${tx(i.name)}” is sold out and can't be ordered until you turn it back on`))
  }
  if (preview) return (
    <>
      <div className="o-pad o-preview-bar"><button type="button" className="o-text-btn o-inline" onClick={() => setPreview(false)}><Chevron back />{t('رجوع للمنيو', 'Back to the menu')}</button></div>
      <CustomerMenu place={place} cats={cats} items={items} />
    </>
  )
  return (
    <>
      <div className="o-pad o-live">
        <div className="o-section-bar">
          <button type="button" className="o-icon-btn o-menu-btn" onClick={() => setDrawer(true)} aria-label={t('القائمة', 'Menu')}><MenuIcon />{totalBadge > 0 && <i>{totalBadge}</i>}</button>
          <h2>{t(...NAV.find(n => n[0] === view)!.slice(2) as [string, string])}</h2>
        </div>
        <div className="o-live-card">
          <PlaceLogo place={place} big />
          <div>
            <b>{tx(place.name)}</b>
            <span className="o-live-row">
              <span className="o-live-badge"><i />{t('المنيو منشور', 'Menu is live')}</span>
              <button type="button" className="o-live-view" onClick={() => setPreview(true)}><Eye />{t('شوفه كعميل', 'Customer view')}</button>
            </span>
          </div>
        </div>
        {view === 'orders' && <Orders ops={ops} items={items} notify={notify} openThread={openThread} />}
        {view === 'tables' && <Tables ops={ops} notify={notify} openThread={openThread} />}
        {view === 'messages' && <Messages ops={ops} open={thread} setOpen={setThread} />}
        {view === 'insights' && <Insights items={items} />}
        {view === 'menu' && <>
        <div className="o-stats">
          <div><b>{items.length}</b><small>{t('صنف', 'items')}</small></div>
          <div><b>{cats.length}</b><small>{t('أقسام', 'sections')}</small></div>
          <div className={soldOut ? 'warn' : ''}><b>{soldOut}</b><small>{t('نفد', 'sold out')}</small></div>
        </div>
        <div className="o-tabs-with-edit o-live-cats">
          <MenuTabs cats={cats} current={cur} onPick={setCur} extra={<span className="o-tabs-end" />} />
          <button type="button" className="o-tabs-edit" onClick={ed.openCats} aria-label={t('عدّل الأقسام', 'Edit sections')}><PenLine /></button>
        </div>
        <p className="o-fine start">{t('اضغط على المفتاح لما يخلص صنف، واضغط على الصنف عشان تعدّله.', 'Flip the switch when something runs out. Tap an item to edit it.')}</p>
        <ul className="o-items">
          {items.filter(i => i.cat === cur).map(i => (
            <ItemRow key={i.id} item={i} cat={cats.find(c => c.id === i.cat)} onOpen={() => ed.edit(i)} trailing={
              <button type="button" className="o-toggle" role="switch" aria-checked={!i.soldOut} aria-label={t(`${tx(i.name)} متوفر`, `${tx(i.name)} available`)} onClick={() => toggle(i)}>
                <em className={!i.soldOut ? 'on' : ''} /><small>{i.soldOut ? t('نفد', 'Sold out') : t('متوفر', 'Available')}</small>
              </button>
            } />
          ))}
        </ul>
        {cur && <button type="button" className="o-dashed" onClick={() => ed.add(cur)}><Plus />{t(`أضف صنف في ${tx(cats.find(c => c.id === cur)!.name)}`, `Add an item to ${tx(cats.find(c => c.id === cur)!.name)}`)}</button>}
        </>}
      </div>
      <aside className={`o-side ${drawer ? 'open' : ''}`} aria-label={t('أقسام اللوحة', 'Dashboard sections')}>
        <div className="o-side-cafe">
          <PlaceLogo place={place} />
          <div><b>{tx(place.name)}</b><small>{t('لوحة الكافيه', 'Café dashboard')}</small></div>
        </div>
        <nav>
          {NAV.map(([id, Icon, ar, en]) => {
            const badge = badges[id]
            return (
              <button key={id} type="button" aria-current={view === id ? 'page' : undefined} className={view === id ? 'active' : ''} onClick={() => { setView(id); setDrawer(false) }}>
                <Icon /><span>{t(ar, en)}</span>{badge > 0 && <i className={id === 'menu' || id === 'tables' ? 'warn' : ''}>{badge}</i>}
              </button>
            )
          })}
        </nav>
        <button type="button" className="o-side-view" onClick={() => { setPreview(true); setDrawer(false) }}><Eye />{t('شوف المنيو كعميل', 'See the menu as a customer')}</button>
      </aside>
      {drawer && <div className="o-side-scrim" onClick={() => setDrawer(false)} />}
      {ed.sheets}
    </>
  )
}
