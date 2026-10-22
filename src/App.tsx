import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  Ban, Bell, Camera, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleUserRound, Clock3, Code2, Coffee, Compass, Edit3, EyeOff, Flag,
  Handshake, HeartHandshake, Home, LocateFixed, LogOut, MapPin, MessageCircle,
  MoreHorizontal, Phone, Search, Send, Settings, Footprints, ShieldCheck, Sparkles, UserRound,
  UsersRound, X, Wifi, Volume2, PlugZap, Car, Bookmark, XCircle, Smartphone, Monitor, Trees, DoorOpen, Languages, CalendarPlus, CalendarClock,
  Croissant, Sandwich, CakeSlice, CupSoda, GlassWater, Cookie, Minus, Plus, CreditCard, Receipt, Armchair, CircleCheck, LoaderCircle, Store, ScanFace, Navigation
} from 'lucide-react'
import { BUSINESS } from './constants'
import { toEnglish, type Language } from './i18n'

export type Screen = 'onboarding' | 'phone' | 'otp' | 'location' | 'home' | 'intent' | 'map' | 'cafe' | 'people' | 'account' | 'settings' | 'inbox' | 'chat' | 'cafeChat' | 'matchProfile'
export type Sheet = null | 'profileSetup' | 'editProfile' | 'skills' | 'request' | 'pending' | 'match' | 'chatMenu' | 'report' | 'location' | 'planVisit' | 'visit' | 'hereNow'
export type Tab = 'home' | 'map' | 'people' | 'inbox' | 'account'
// The app does one thing: connect people nearby to ask for help or offer it.
export type ActionMode = 'seek' | 'help'
export type PresenceFilter = 'all' | 'now' | 'today'
export type Presence = 'now' | 'today'
export type Gender = 'm' | 'f'
export type MeetPref = 'all' | 'same'
export type RequestState = 'pending' | 'declined' | 'connected' | null

const LanguageCtx = createContext<{ language: Language; toggleLanguage: () => void }>({ language: 'ar', toggleLanguage: () => undefined })
const useLanguage = () => useContext(LanguageCtx)
// Search what people actually see: in English the data is still Arabic, so match the translated text too.
const useSearch = (query: string) => {
  const { language } = useLanguage()
  const q = query.trim().toLowerCase()
  return (s: string) => !q || (language === 'en' ? `${s} ${toEnglish(s)}` : s).toLowerCase().includes(q)
}

const originalText = new WeakMap<Text, string>()
const originalAttributes = new WeakMap<Element, Map<string, string>>()
const localizedAttributes = ['aria-label', 'title', 'placeholder', 'alt']

function localizeTree(root: ParentNode, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode() as Text | null
  while (current) {
    const parent = current.parentElement
    if (parent && !parent.closest('[data-no-translate]') && !['SCRIPT', 'STYLE'].includes(parent.tagName)) {
      const value = current.nodeValue ?? ''
      if (language === 'en') {
        if (/[\u0600-\u06ff]/.test(value)) originalText.set(current, value)
        const translated = toEnglish(originalText.get(current) ?? value)
        if (current.nodeValue !== translated) current.nodeValue = translated
      } else {
        const source = originalText.get(current)
        if (source != null && current.nodeValue !== source) current.nodeValue = source
      }
    }
    current = walker.nextNode() as Text | null
  }

  root.querySelectorAll?.<Element>('*').forEach(element => {
    if (element.closest('[data-no-translate]')) return
    let saved = originalAttributes.get(element)
    for (const attribute of localizedAttributes) {
      const value = element.getAttribute(attribute)
      if (value == null) continue
      if (language === 'en') {
        if (/[\u0600-\u06ff]/.test(value)) {
          saved ??= new Map<string, string>()
          saved.set(attribute, value)
          originalAttributes.set(element, saved)
        }
        element.setAttribute(attribute, toEnglish(saved?.get(attribute) ?? value))
      } else if (saved?.has(attribute)) {
        element.setAttribute(attribute, saved.get(attribute)!)
      }
    }
  })
}

function LanguageBridge({ language }: { language: Language }) {
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.title = language === 'ar' ? 'AroundMe - شبكة التعاون في المقاهي' : 'AroundMe - Connect at nearby coffee shops'
    const root = document.querySelector('.app-shell')
    if (!root) return
    let applying = false
    const observer = new MutationObserver(() => apply())
    const apply = () => {
      if (applying) return
      applying = true
      observer.disconnect()
      localizeTree(root, language)
      observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: localizedAttributes })
      applying = false
    }
    apply()
    return () => observer.disconnect()
  }, [language])
  return null
}

// One vocabulary for the whole app. Change a word here and it changes everywhere.
const COPY = {
  seek: 'أحتاج مساعدة',
  help: 'أقدر أساعد',
  nearTab: 'حولك',
  nowGroup: 'متواجدون الآن',
  todayGroup: 'قادمون اليوم',
  pending: 'بانتظار الرد',
  declined: 'مو متاح الحين',
  openChat: 'افتح المحادثة',
  offer: 'أعرض مساعدتي',
  consent: 'ما أحد يقدر يراسلك إلا إذا وافقتوا الاثنين.',
}
const DURATIONS = [10, 15, 30, 60]
// Arabic number agreement: 1 دقيقة، 2 دقيقتين، 3-10 دقائق، 11+ دقيقة. Hours follow the same rule.
const count = (n: number, one: string, two: string, few: string) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${one}`)
const mins = (n: number) => count(n, 'دقيقة', 'دقيقتين', 'دقائق')
const hours = (n: number) => count(n, 'ساعة', 'ساعتين', 'ساعات')
// 95 → «ساعة و35 دقيقة»، 120 → «ساعتين»
const span = (m: number) => { const h = Math.floor(m / 60), r = m % 60; return !h ? mins(r) : !r ? hours(h) : `${hours(h)} و${mins(r)}` }
// Demo presence times: who leaves or arrives when, counted from page load.
const T0 = Date.now()
const leaveIn = (m: number) => T0 + m * 60000
const clock = (ts: number) => { const d = new Date(ts), h = d.getHours(); return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}` }
// The restart shortcut is for demos only (open with ?demo); it must not sit on top of real content.
const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')

// ---------- Location ----------
export type Loc = { mode: 'gps' | 'manual'; city: string; area: string }
const LIVE_CITY = 'الرياض'
const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة', 'أبها']
// Rough positions in km, enough to give honest relative distances in the demo.
const AREAS: Record<string, [number, number]> = { 'العليا': [0, 0], 'الورود': [0.55, 0.35], 'السليمانية': [1.0, -0.75], 'الملز': [2.0, -1.2] }
const DEFAULT_LOC: Loc = { mode: 'gps', city: LIVE_CITY, area: 'العليا' }
const locLabel = (l: Loc) => (l.city === LIVE_CITY ? `${l.area}، ${l.city}` : l.city)

const images = {
  layla: '/assets/people/layla.jpg',
  omar: '/assets/people/omar.jpg',
  rana: '/assets/people/rana.jpg',
  khaled: '/assets/people/khaled.jpg',
  samer: '/assets/people/samer.jpg',
  sara: '/assets/people/sara.jpg',
  tariq: '/assets/people/tariq.jpg',
  faisal: '/assets/people/faisal.jpg',
  noura: '/assets/people/noura.jpg',
  cafe: '/assets/places/cafe.jpg',
  workspace: '/assets/places/workspace.jpg',
  corner: '/assets/places/corner.jpg',
  garden: '/assets/places/garden.jpg',
  jjbeanLogo: '/assets/logos/jjbean.png',
  unwanLogo: '/assets/logos/unwan.png',
  starbucksLogo: '/assets/logos/starbucks.png',
  dunkinLogo: '/assets/logos/dunkin.png',
  javatimeLogo: '/assets/logos/javatime.png',
  drcafeLogo: '/assets/logos/drcafe.png',
}

export type Person = {
  id: string; name: string; g: Gender; image: string; job: string; bio: string; tag: string; seat: string; cafe: string;
  presence: Presence; time: string; visitDetails: string; skills: string[]; serviceOffer: string; busy?: boolean; leaveAt?: number; arriveAt?: number;
}

const allPeople: Person[] = [
  { id: 'layla', name: 'ليلى حسن', g: 'f', image: images.layla, job: 'مصممة جرافيك مستقلة', bio: 'أصمم هويات بصرية للمشاريع الناشئة، وأحب أساعد في مراجعة الشعارات والعروض التقديمية.', tag: 'تصميم هوية بصرية', seat: 'عند النافذة', cafe: 'عنوان القهوة', presence: 'now', time: '', leaveAt: leaveIn(95), visitDetails: 'متاحة للمساعدة حتى 6:30 م', skills: ['تصميم هوية بصرية', 'UI/UX', 'Figma'], serviceOffer: 'مراجعة الهوية والشعارات وتنسيق الواجهات وتجربة المستخدم' },
  { id: 'omar', name: 'عمر سعيد', g: 'm', image: images.omar, job: 'مطور تطبيقات موبايل', bio: 'أطور تطبيقات React Native وTypeScript، وأقدر أساعد في حل مشاكل الكود واكتشاف الأخطاء بسرعة.', tag: 'React Native', seat: 'الطاولة الطويلة', cafe: 'عنوان القهوة', presence: 'now', time: '', leaveAt: leaveIn(150), visitDetails: 'متاح للأسئلة البرمجية حتى 8:00 م', skills: ['React Native', 'TypeScript', 'تطوير تطبيقات', 'حل أخطاء'], serviceOffer: 'حل مشاكل كود React Native واستكشاف أخطاء الدفع والربط' },
  { id: 'khaled', name: 'خالد منصور', g: 'm', image: images.khaled, job: 'مختص تسويق رقمي', bio: 'أشتغل في التسويق الرقمي والإعلانات الممولة وحملات النمو للمتاجر الإلكترونية.', tag: 'تسويق رقمي', seat: 'قريب من الكاونتر', cafe: 'عنوان القهوة', presence: 'today', time: clock(leaveIn(45)), arriveAt: leaveIn(45), visitDetails: 'متاح للاستشارات التسويقية من 4:30 إلى 7:00 م', skills: ['تسويق رقمي', 'SEO', 'إعلانات تيك توك وسناب', 'حملات نمو'], serviceOffer: 'استشارات تسويقية وخطط إطلاق الحملات الإعلانية' },
  { id: 'rana', name: 'رنا فارس', g: 'f', image: images.rana, job: 'صاحبة مشروع ناشئ', bio: 'أبني مشروع ناشئ للمناسبات والهدايا، وأهتم جداً بتجربة العميل وجودة التفاصيل.', tag: 'تصوير منتجات', seat: 'الجلسات الخارجية', cafe: 'عنوان القهوة', presence: 'today', time: clock(leaveIn(70)), arriveAt: leaveIn(70), visitDetails: 'متاحة لجلسات تصوير سريعة من 5:15 م', skills: ['تصوير منتجات', 'صناعة محتوى', 'تجربة مستخدم'], serviceOffer: 'تصوير المنتجات وجلسات سريعة بالجوال' },
  { id: 'sara', name: 'سارة الشمري', g: 'f', image: images.sara, job: 'محللة مالية ونمذجة', bio: 'أساعد رواد الأعمال في بناء جداول التدفقات النقدية ودراسات الجدوى المالية لطلبات الاستثمار.', tag: 'Excel ومالية', seat: 'منطقة الهدوء', cafe: 'ستاربكس', presence: 'now', time: '', leaveAt: leaveIn(40), visitDetails: 'متاحة لمراجعة النماذج المالية حتى 5:00 م', skills: ['Excel ونمذجة', 'مالية', 'دراسات جدوى', 'عروض استثمار'], serviceOffer: 'مراجعة نماذج Excel وحسابات التدفقات النقدية للمشاريع' },
  { id: 'tariq', name: 'طارق الجاسم', g: 'm', image: images.tariq, job: 'مهندس حلول سحابية', bio: 'أبني بنى تحتية سحابية وأنظمة Backend عالية الأداء للمنصات الرقمية.', tag: 'هندسة سحابية', seat: 'غرفة الاجتماعات 2', cafe: 'ستاربكس', presence: 'today', time: clock(leaveIn(110)), arriveAt: leaveIn(110), visitDetails: 'متاح لأسئلة السحابة والخوادم من 6:00 م', skills: ['Cloud', 'DevOps', 'Node.js', 'PostgreSQL'], serviceOffer: 'استشارات معمارية الأنظمة السحابية وخوادم التطبيقات' },
  { id: 'faisal', name: 'فيصل العتيبي', g: 'm', image: images.faisal, job: 'صانع محتوى ومصور', bio: 'أساعد أصحاب المشاريع في محتوى السوشال ميديا والتيك توك.', tag: 'صناعة محتوى', seat: 'الجلسات الخارجية', cafe: 'دانكن', presence: 'now', time: '', leaveAt: leaveIn(70), visitDetails: 'متاح لمراجعة الحسابات وأفكار المحتوى حتى المغرب', skills: ['محتوى تيك توك', 'تصوير بالجوال', 'كتابة سيناريو'], serviceOffer: 'أفكار محتوى ومراجعة حسابات التواصل الاجتماعي' },
  { id: 'noura', name: 'نورة الدوسري', g: 'f', image: images.noura, job: 'كاتبة إعلانية ومترجمة', bio: 'شغوفة باللغة وصياغة رسائل البراندات والمقالات التسويقية.', tag: 'كتابة محتوى', seat: 'الحديقة الجانبية', cafe: 'جافا تايم', presence: 'today', time: clock(leaveIn(90)), arriveAt: leaveIn(90), visitDetails: 'متاحة لتدقيق النصوص من 5:45 م', skills: ['كتابة إعلانية', 'ترجمة', 'صياغة نصوص'], serviceOffer: 'مراجعة وتدقيق النصوص التسويقية وشعارات البراند' },
]

// Needs stay anonymous (no name, no photo) everywhere until both sides agree.
export type Need = {
  id: string; personId: string; name: string; g: Gender; image: string; cafe: string; text: string; topic: string;
  tags: string[]; minutes: number; presence: Presence; time: string; seat: string; leaveAt?: number; arriveAt?: number;
}

const allNeeds: Need[] = [
  { id: 'n1', personId: 'rana', name: 'رنا فارس', g: 'f', image: images.rana, cafe: 'عنوان القهوة', text: 'أحتاج رأي وملاحظات سريعة في تصميم تجربة واجهات تطبيق مشروعي', topic: 'تصميم تطبيق', tags: ['تصميم', 'تطبيقات', 'UI/UX'], minutes: 15, presence: 'today', time: clock(leaveIn(70)), arriveAt: leaveIn(70), seat: 'الجلسات الخارجية' },
  { id: 'n2', personId: 'reem', name: 'ريم السالم', g: 'f', image: '', cafe: 'عنوان القهوة', text: 'تطبيقي يعلّق ويظهر خطأ لما أفتح صفحة الدفع في Stripe', topic: 'React Native', tags: ['React Native', 'دفع إلكتروني', 'كود'], minutes: 10, presence: 'now', time: '', leaveAt: leaveIn(12), seat: 'عند النافذة' },
  { id: 'n3', personId: 'yousef', name: 'يوسف العلي', g: 'm', image: '', cafe: 'ستاربكس', text: 'واجهة تطبيقي ما تضبط على الجوالات ذات الشاشات الصغيرة وأحتاج مساعدة في CSS', topic: 'تطوير واجهات', tags: ['تطوير واجهات', 'CSS', 'Responsive'], minutes: 20, presence: 'now', time: '', leaveAt: leaveIn(120), seat: 'منطقة الهدوء' },
  { id: 'n4', personId: 'majed', name: 'ماجد الحربي', g: 'm', image: '', cafe: 'دانكن', text: 'أبحث عن استشارة سريعة في تسعير اشتراكات تطبيق جديد موجه للشركات', topic: 'تسعير واستراتيجية', tags: ['تسعير', 'تسويق', 'B2B'], minutes: 15, presence: 'today', time: clock(leaveIn(40)), arriveAt: leaveIn(40), seat: 'الجلسات الخارجية' },
  { id: 'n5', personId: 'hind', name: 'هند القحطاني', g: 'f', image: '', cafe: 'جافا تايم', text: 'مراجعة سريعة لشرائح العرض الاستثماري Pitch Deck قبل عرضه غداً', topic: 'عروض تقديمية', tags: ['عروض تقديمية', 'استثمار', 'Pitch Deck'], minutes: 20, presence: 'now', time: '', leaveAt: leaveIn(55), seat: 'الحديقة الجانبية' },
  { id: 'n6', personId: 'abdullah', name: 'عبدالله الزهراني', g: 'm', image: '', cafe: 'عنوان القهوة', text: 'أبغى أحد يراجع معي خطة إطلاق حملة إعلانية على سناب', topic: 'تسويق', tags: ['تسويق', 'إعلانات', 'سناب'], minutes: 15, presence: 'today', time: clock(leaveIn(120)), arriveAt: leaveIn(120), seat: 'قريب من الكاونتر' },
]

// hours: opening and closing hour (24 = midnight), used to keep visits inside opening times.
type CafeBase = { id: string; name: string; area: string; pos: [number, number]; image: string; logo?: string; logoEn?: string; open: string; isOpen: boolean; amenities: string[]; hours: [number, number] }
export type Cafe = CafeBase & { km: number; distance: string; eta: string }

const allCafes: CafeBase[] = [
  { id: 'featured', name: 'عنوان القهوة', area: 'العليا', pos: [0.08, 0.09], image: images.cafe, logo: images.unwanLogo, logoEn: images.jjbeanLogo, open: 'مفتوح الآن', isOpen: true, amenities: ['هادئ للعمل', 'واي فاي', 'مقابس'], hours: [5, 24] },
  { id: 'a', name: 'ستاربكس', area: 'الورود', pos: [0.6, 0.4], image: images.workspace, logo: images.starbucksLogo, open: 'مفتوح الآن', isOpen: true, amenities: ['غرف اجتماعات', 'واي فاي', 'مقابس', 'مواقف'], hours: [7, 23] },
  { id: 'b', name: 'دانكن', area: 'السليمانية', pos: [1.05, -0.7], image: images.corner, logo: images.dunkinLogo, open: 'مفتوح الآن', isOpen: true, amenities: ['جلسات خارجية', 'هادئ للعمل', 'واي فاي'], hours: [6, 24] },
  { id: 'c', name: 'جافا تايم', area: 'الملز', pos: [2.0, -1.1], image: images.garden, logo: images.javatimeLogo, open: 'يغلق 11 م', isOpen: false, amenities: ['جلسات خارجية', 'مواقف', 'واي فاي'], hours: [8, 23] },
  { id: 'd', name: 'د. كيف', area: 'الياسمين', pos: [-1.3, 1.6], image: images.corner, logo: images.drcafeLogo, open: 'مفتوح الآن', isOpen: true, amenities: ['واي فاي', 'مقابس', 'مواقف'], hours: [6, 24] },
]
// The Arabic version shows Saudi brands; the English version keeps the Vancouver names, so each has its own logo.
const cafeLogo = (c: CafeBase, language: Language) => (language === 'en' ? c.logoEn : c.logo)
// A café's picture next to its name: its logo when it has one in this language, otherwise its photo.
function CafeThumb({ cafe }: { cafe?: CafeBase }) {
  const { language } = useLanguage()
  const logo = cafe && cafeLogo(cafe, language)
  return <img className={logo ? 'cafe-thumb-logo' : undefined} src={logo || cafe?.image} alt="" onError={hidePhoto} />
}
const amenityIcon: Record<string, React.ReactNode> = {
  'هادئ للعمل': <Volume2 />, 'واي فاي': <Wifi />, 'مقابس': <PlugZap />, 'مواقف': <Car />,
  'جلسات خارجية': <Trees />, 'غرف اجتماعات': <DoorOpen />,
}
const fmtDist = (km: number) => (km < 1 ? `${Math.max(50, Math.round((km * 1000) / 10) * 10)} م` : `${km.toFixed(1)} كم`)
const fmtEta = (km: number) => (km <= 1.2 ? `${Math.max(2, Math.round(km * 12))} دقائق مشي` : `${Math.round(km * 3 + 3)} دقائق بالسيارة`)

// Everything the lists show comes from here, so counts, lists and maps can never disagree.
type Data = { loc: Loc; live: boolean; cafes: Cafe[]; people: Person[]; needs: Need[]; samePref: boolean }
// Presence follows the demo timers: people whose time is up leave the lists, and people who arrive count as here now.
const ARRIVED_STAY = 90 * 60000
const atTime = <T extends { presence: Presence; leaveAt?: number; arriveAt?: number }>(xs: T[], now: number): T[] => xs
  .filter(x => !x.leaveAt || x.leaveAt > now)
  .map(x => (x.arriveAt && x.arriveAt <= now ? { ...x, presence: 'now' as Presence, time: '', arriveAt: undefined, leaveAt: x.arriveAt + ARRIVED_STAY } : x))
const buildData = (loc: Loc, myGender: Gender, pref: MeetPref, now = Date.now()): Data => {
  const live = loc.city === LIVE_CITY
  const me = AREAS[loc.area] ?? [0, 0]
  const cafes = live
    ? allCafes.map(c => { const km = Math.hypot(c.pos[0] - me[0], c.pos[1] - me[1]); return { ...c, km, distance: fmtDist(km), eta: fmtEta(km) } }).sort((a, b) => a.km - b.km)
    : []
  const ok = (g: Gender) => pref === 'all' || g === myGender
  return {
    loc, live, cafes,
    people: live ? atTime(allPeople.filter(p => ok(p.g)), now) : [],
    needs: live ? atTime(allNeeds.filter(n => ok(n.g)), now) : [],
    samePref: pref === 'same',
  }
}
const DataCtx = createContext<Data>(buildData(DEFAULT_LOC, 'm', 'all'))
const useData = () => useContext(DataCtx)

const cafeOf = (d: Data, name: string) => d.cafes.find(c => c.name === name)
const peopleAt = (d: Data, cafe: string) => d.people.filter(p => p.cafe === cafe)
const needsAt = (d: Data, cafe: string) => d.needs.filter(n => n.cafe === cafe)
const cafeCount = (d: Data, cafe: string, act: ActionMode) => (act === 'help' ? needsAt(d, cafe).length : peopleAt(d, cafe).length)
const countLine = (d: Data, cafe: string, act: ActionMode) => {
  const n = cafeCount(d, cafe, act)
  if (act === 'seek') return n ? `${n} يقدرون يساعدونك` : 'ما فيه أحد متاح للمساعدة حاليًا'
  return n ? `${n} يحتاجون مساعدتك` : 'ما فيه احتياجات حاليًا'
}

const first = (name: string) => name.split(' ')[0]
const gx = (p: { g: Gender }, m: string, f: string) => (p.g === 'f' ? f : m)
const askLabel = (p: Person) => gx(p, 'اطلب مساعدته', 'اطلب مساعدتها')

const topicWords: [string, string[]][] = [
  ['تصميم', ['تصميم', 'شعار', 'هوية', 'لوقو']],
  ['عروض تقديمية', ['عرض', 'بريزنتيشن', 'سلايد']],
  ['Excel', ['excel', 'اكسل', 'إكسل', 'جدول']],
  ['تطوير تطبيق', ['تطبيق', 'كود', 'برمجة', 'react']],
  ['تسويق', ['تسويق', 'إعلان', 'اعلان', 'سوشال']],
  ['تصوير', ['تصوير', 'صور', 'مصور']],
]
const understand = (text: string) => topicWords.filter(([, words]) => words.some(w => text.toLowerCase().includes(w))).map(([t]) => t)

export type Message = { from: 'me' | 'them' | 'system'; text: string; time: string }
export type Connection = { id: string; personId: string; name: string; image: string; cafe: string; topic: string; minutes: number; messages: Message[]; status: 'active' | 'past'; unread: number; askMet: boolean; endedMet?: boolean }
export type Target = { kind: 'ask'; person: Person; need: string } | { kind: 'offer'; need: Need }
const targetId = (t: Target) => (t.kind === 'offer' ? t.need.personId : t.person.id)

const hidePhoto = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden' }
const now = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
// Demo pacing: each agreed minute passes in one second, so "15 دقيقة" asks "تقابلتوا؟" after 15 seconds.
const DEMO_MS_PER_MINUTE = 1000
const onEnter = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } }

function Avatar({ src, size = 54, online = true, alt = '', name = '' }: { src: string; size?: number; online?: boolean; alt?: string; name?: string }) {
  const [broken, setBroken] = useState(false)
  const { language } = useLanguage()
  // A single letter can't be translated, so take the initial from the name in the current language.
  const initial = (language === 'en' ? toEnglish((name || alt).trim()) : (name || alt).trim()).charAt(0) || '؟'
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {src && !broken ? <img src={src} alt={alt} onError={() => setBroken(true)} /> : <b className="avatar-initial" data-no-translate style={{ fontSize: size * 0.4 }}>{initial}</b>}
      {online && <i />}
    </span>
  )
}
function AnonAvatar({ size = 46 }: { size?: number }) {
  return <span className="anonymous-avatar" style={{ width: size, height: size }}><UserRound /></span>
}
function Verified() { return <ShieldCheck className="verified" aria-label="رقم موثّق" /> }

// Re-renders every few seconds so countdowns stay live.
function useNow(ms = 5000) {
  const [t, setT] = useState(Date.now())
  useEffect(() => { const id = window.setInterval(() => setT(Date.now()), ms); return () => window.clearInterval(id) }, [ms])
  return t
}
const timeLeft = (leaveAt: number, t: number) => {
  const left = leaveAt - t
  return left <= 0 ? 'وقته خلص' : left < 60000 ? 'أقل من دقيقة' : span(Math.ceil(left / 60000))
}
function StayLine({ person: p }: { person: Person }) {
  const t = useNow()
  if (p.presence === 'now' && p.leaveAt) return <>{`موجود${p.g === 'f' ? 'ة' : ''} الحين، و${leaveLine(p.g, p.leaveAt, t)} (الساعة ${clock(p.leaveAt)})`}</>
  if (p.presence === 'today' && p.arriveAt) return <>{`${arriveLine(p.g, p.arriveAt, t)} (الساعة ${p.time})`}</>
  return <>{p.visitDetails}</>
}

function PresenceBadge({ presence, time, seat }: { presence: Presence; time: string; seat?: string }) {
  return (
    <span className={`presence-badge ${presence}`}>
      {presence === 'now' ? <i className="live-dot" /> : <Clock3 className="time-clock-icon" />}
      {presence === 'now' ? `الآن${seat ? ` · ${seat}` : ''}` : `اليوم ${time}`}
    </span>
  )
}

// Plain words for when someone is at the café: «يطلع من الكافيه بعد ساعة» while they're here, «يوصل الكافيه بعد 20 دقيقة» on the way.
// Green dot = here now; footsteps = on the way; the here timer turns red-clay in the last 15 minutes.
const leaveLine = (g: Gender, at: number, t: number) => (at - t <= 0 ? (g === 'f' ? 'طلعت من الكافيه' : 'طلع من الكافيه') : `${g === 'f' ? 'تطلع' : 'يطلع'} من الكافيه بعد ${timeLeft(at, t)}`)
const arriveLine = (g: Gender, at: number, t: number) => (at - t <= 0 ? (g === 'f' ? 'وصلت الكافيه' : 'وصل الكافيه') : `${g === 'f' ? 'توصل' : 'يوصل'} الكافيه بعد ${timeLeft(at, t)}`)
// Presence without extra words: a ring around the photo empties as their time at the café runs out
// (dashed when they're still on the way), and one short line in the card footer says how long.
const STAY_SHOWN = 40 * 60000 // pretend everyone arrived 40 minutes ago, so the ring has a starting point
function StayRing({ leaveAt, arriveAt, size, children }: { leaveAt?: number; arriveAt?: number; size: number; children: React.ReactNode }) {
  const t = useNow()
  if (!leaveAt && !arriveAt) return <>{children}</>
  const left = leaveAt ? Math.max(0, leaveAt - t) : 0
  const frac = leaveAt ? left / (left + STAY_SHOWN) : 1
  const soon = !!leaveAt && left <= 15 * 60000
  const cls = arriveAt ? 'is-coming' : soon ? 'is-soon' : ''
  return <span className={`stay-ring ${cls}`} style={{ '--p': frac, width: size + 8, height: size + 8 } as React.CSSProperties}>{children}</span>
}
function StayMeta({ g, seat, leaveAt, arriveAt, time }: { g: Gender; seat: string; leaveAt?: number; arriveAt?: number; time: string }) {
  const t = useNow()
  if (leaveAt) {
    const soon = leaveAt - t <= 15 * 60000
    return <div className={`service-meta-info stay-meta ${soon ? 'is-soon' : ''}`} title={`${g === 'f' ? 'تطلع' : 'يطلع'} من الكافيه الساعة ${clock(leaveAt)}`}><Coffee />{leaveAt - t <= 0 ? (g === 'f' ? 'طلعت' : 'طلع') : `مغادرة بعد: ${timeLeft(leaveAt, t)}`}</div>
  }
  if (arriveAt) {
    return <div className="service-meta-info stay-meta is-coming" title={`الساعة ${time}`}><Footprints />{arriveAt - t <= 0 ? (g === 'f' ? 'وصلت' : 'وصل') : `وصول بعد: ${timeLeft(arriveAt, t)}`}</div>
  }
  return <div className="service-meta-info"><MapPin />{seat}</div>
}
// Top corner of the card: where they sit in the café while they're there; nothing while they're on the way.
const CardPresence = ({ presence, time, seat, leaveAt, arriveAt }: { presence: Presence; time: string; seat?: string; leaveAt?: number; arriveAt?: number }) =>
  leaveAt ? (seat ? <span className="seat-chip" title={seat}><MapPin /><span>{seat}</span></span> : null) : arriveAt ? null : <PresenceBadge presence={presence} time={time} />

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`around-logo ${compact ? 'compact' : ''}`} dir="ltr">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 4C14.6 4 7 11.5 7 20.8c0 12.1 13.2 21.4 15.9 23.2.7.5 1.5.5 2.2 0C27.8 42.2 41 32.9 41 20.8 41 11.5 33.4 4 24 4Z" />
        <circle cx="24" cy="20" r="7" />
        <path className="logo-link" d="M16.5 20h15" />
      </svg>
      <b>Around<span>Me</span></b>
    </span>
  )
}

function StatusBar() {
  const { language, toggleLanguage } = useLanguage()
  return (
    <div className="statusbar" dir="ltr">
      <span className="status-start"><b>9:41</b>
      <button type="button" className="language-toggle" onClick={toggleLanguage} data-no-translate aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
        <Languages /> <span>{language === 'ar' ? 'EN' : 'العربية'}</span>
      </button></span>
      <div className="status-icons"><span className="signal">▮▮▮▮</span><span>⌁</span><span className="battery" /></div>
    </div>
  )
}

function TopBar({ title, back, action }: { title?: string; back?: () => void; action?: React.ReactNode }) {
  return (
    <div className="topbar">
      {back ? <button className="icon-btn" onClick={back} aria-label="رجوع"><ChevronRight /></button> : <span className="top-spacer" />}
      <strong>{title}</strong>
      {action || <span className="top-spacer" />}
    </div>
  )
}

function PrimaryButton({ children, onClick, icon, disabled = false }: { children: React.ReactNode; onClick?: () => void; icon?: React.ReactNode; disabled?: boolean }) {
  return <button className="primary-button" onClick={onClick} disabled={disabled}>{icon}{children}</button>
}
function Chip({ children, active = false, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return <button type="button" className={`chip ${active ? 'active' : ''}`} onClick={onClick} aria-pressed={active}>{children}</button>
}

function TabBar({ tab, onTab, unread = 0 }: { tab: Tab; onTab: (t: Tab) => void; unread?: number }) {
  const items: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'الرئيسية', icon: <Home /> },
    { id: 'people', label: COPY.nearTab, icon: <UsersRound /> },
    { id: 'map', label: 'الكافيهات', icon: <Coffee /> },
    { id: 'inbox', label: 'الرسائل', icon: <MessageCircle /> },
    { id: 'account', label: 'حسابي', icon: <UserRound /> },
  ]
  return (
    <nav className="tabbar">
      {items.map(item => (
        <button key={item.id} className={tab === item.id ? 'selected' : ''} onClick={() => onTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}>
          <span className="tab-icon">{item.icon}{item.id === 'inbox' && unread > 0 && <em className="tab-badge">{unread}</em>}</span>
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  )
}

function BottomSheet({ children, onClose, tall = false }: { children: React.ReactNode; onClose: () => void; tall?: boolean }) {
  return (
    <div className="sheet-layer" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className={`bottom-sheet ${tall ? 'tall' : ''}`} role="dialog" aria-modal="true">
        <button className="sheet-close" onClick={onClose} aria-label="إغلاق"><X /></button>
        <span className="grabber" />
        {children}
      </section>
    </div>
  )
}

// Where the lists are measured from. Same chip on Home, حولك and الكافيهات.
function LocationChip({ onClick }: { onClick: () => void }) {
  const { loc } = useData()
  return (
    <button type="button" className="location-chip" onClick={onClick} aria-label={`الموقع: ${locLabel(loc)}. تغيير`}>
      {loc.mode === 'gps' ? <LocateFixed /> : <MapPin />}
      <span>{loc.mode === 'gps' ? 'قريب منك · ' : ''}{locLabel(loc)}</span>
      <ChevronDown />
    </button>
  )
}

// The only switch in the app, with the same words on every screen.
function IntentSwitch({ mode, onChange }: { mode: ActionMode; onChange: (m: ActionMode) => void }) {
  return (
    <div className="service-segmented-tabs" role="tablist" aria-label="نوع الأشخاص حولك">
      <button type="button" role="tab" aria-selected={mode === 'help'} className={`service-tab-btn ${mode === 'help' ? 'active' : ''}`} onClick={() => onChange('help')}><HeartHandshake />يحتاجون مساعدة</button>
      <button type="button" role="tab" aria-selected={mode === 'seek'} className={`service-tab-btn ${mode === 'seek' ? 'active' : ''}`} onClick={() => onChange('seek')}><UsersRound />يقدرون يساعدون</button>
    </div>
  )
}

function ConnectButton({ state, label, onClick, onOpenChat }: { state: RequestState; label: string; onClick: () => void; onOpenChat: () => void }) {
  if (state === 'connected') return <button type="button" className="say-hello-btn is-open" onClick={e => { e.stopPropagation(); onOpenChat() }} aria-label={COPY.openChat}><MessageCircle />المحادثة</button>
  if (state === 'pending') return <span className="say-hello-btn is-waiting"><Clock3 />{COPY.pending}</span>
  if (state === 'declined') return <span className="say-hello-btn is-waiting">{COPY.declined}</span>
  return <button type="button" className="say-hello-btn" onClick={e => { e.stopPropagation(); onClick() }}>{label}</button>
}

type CardHandlers = {
  stateOf: (id: string) => RequestState;
  onOpenPerson: (p: Person) => void;
  onAsk: (p: Person) => void;
  onOffer: (n: Need) => void;
  onOpenChat: (personId: string) => void;
}

function HelperCard({ p, h, showCafe = true }: { p: Person; h: CardHandlers; showCafe?: boolean }) {
  const cafe = cafeOf(useData(), p.cafe)
  return (
    <div className="service-card" role="button" tabIndex={0} onClick={() => h.onOpenPerson(p)} onKeyDown={onEnter(() => h.onOpenPerson(p))}>
      <div className="service-card-head">
        <div className="service-card-user">
          <StayRing leaveAt={p.leaveAt} arriveAt={p.arriveAt} size={46}><Avatar src={p.image} size={46} name={p.name} online={false} /></StayRing>
          <div>
            <h3>{p.name}</h3>
            <p>{p.job}{showCafe ? ` · ${p.cafe}${cafe ? ` · ${cafe.distance}` : ''}` : ''}</p>
          </div>
        </div>
        <CardPresence presence={p.presence} time={p.time} seat={p.seat} leaveAt={p.leaveAt} arriveAt={p.arriveAt} />
      </div>
      <div className="service-desc-box">{p.serviceOffer}</div>
      <div className="service-tags-row">{p.skills.map(s => <span key={s} className="service-tag">{s}</span>)}</div>
      <div className="service-footer">
        <StayMeta g={p.g} seat={p.seat} leaveAt={p.leaveAt} arriveAt={p.arriveAt} time={p.time} />
        <ConnectButton state={h.stateOf(p.id)} label={askLabel(p)} onClick={() => h.onAsk(p)} onOpenChat={() => h.onOpenChat(p.id)} />
      </div>
    </div>
  )
}

function NeedCard({ n, h, showCafe = true }: { n: Need; h: CardHandlers; showCafe?: boolean }) {
  const cafe = cafeOf(useData(), n.cafe)
  const state = h.stateOf(n.personId)
  const open = () => (state === 'connected' ? h.onOpenChat(n.personId) : h.onOffer(n))
  return (
    <div className="service-card" role="button" tabIndex={0} onClick={open} onKeyDown={onEnter(open)}>
      <div className="service-card-head">
        <div className="service-card-user">
          <StayRing leaveAt={n.leaveAt} arriveAt={n.arriveAt} size={46}><AnonAvatar /></StayRing>
          <div>
            <h3>{n.topic}</h3>
            <p>{showCafe ? `${n.cafe}${cafe ? ` · ${cafe.distance}` : ''} · ` : ''}يحتاج {mins(n.minutes)}</p>
          </div>
        </div>
        <CardPresence presence={n.presence} time={n.time} seat={n.seat} leaveAt={n.leaveAt} arriveAt={n.arriveAt} />
      </div>
      <div className="service-desc-box need">{n.text}</div>
      <div className="service-tags-row">{n.tags.map(t => <span key={t} className="service-tag">{t}</span>)}</div>
      <div className="service-footer">
        <StayMeta g={n.g} seat={n.seat} leaveAt={n.leaveAt} arriveAt={n.arriveAt} time={n.time} />
        <ConnectButton state={state} label={COPY.offer} onClick={() => h.onOffer(n)} onOpenChat={() => h.onOpenChat(n.personId)} />
      </div>
    </div>
  )
}

function EmptyState({ title, hint, action, onAction, icon }: { title: string; hint?: string; action?: string; onAction?: () => void; icon?: React.ReactNode }) {
  return (
    <div className="empty-note">
      {icon ?? <UsersRound />}
      <b>{title}</b>
      {hint && <small>{hint}</small>}
      {action && <button type="button" className="text-button" onClick={onAction}>{action}</button>}
    </div>
  )
}

// Shown on every list when the chosen city isn't live yet, instead of a silent empty screen.
function NotLiveState({ onChange }: { onChange: () => void }) {
  const { loc } = useData()
  return <EmptyState icon={<MapPin />} title={`AroundMe لسا ما وصل ${loc.city}`} hint={`حالياً متاح في ${LIVE_CITY} بس. نبلغك أول ما نوصل مدينتك.`} action="غيّر المدينة" onAction={onChange} />
}

function ConsentNote() {
  const { samePref } = useData()
  return (
    <div className="privacy-note">
      <EyeOff />
      <span>
        <b>التواصل بموافقة الطرفين</b>
        <small>{COPY.consent} الاحتياجات تظهر بدون اسم أو صورة حتى الموافقة.{samePref ? ' ويظهر لك نفس الجنس فقط حسب تفضيلك.' : ''}</small>
      </span>
    </div>
  )
}

function ProfilePreviewDrawer({ person, h, onClose, onOpenCafe }: { person: Person; h: CardHandlers; onClose: () => void; onOpenCafe: (cafe: string) => void }) {
  const cafe = cafeOf(useData(), person.cafe)
  const isNow = person.presence === 'now'
  const state = h.stateOf(person.id)
  const cta =
    state === 'connected' ? <PrimaryButton onClick={() => h.onOpenChat(person.id)} icon={<MessageCircle />}>{COPY.openChat}</PrimaryButton>
    : state === 'pending' ? <PrimaryButton disabled icon={<Clock3 />}>{COPY.pending}</PrimaryButton>
    : state === 'declined' ? <PrimaryButton disabled>{COPY.declined}</PrimaryButton>
    : <PrimaryButton onClick={() => h.onAsk(person)} icon={<Search />}>{askLabel(person)}</PrimaryButton>

  return (
    <BottomSheet onClose={onClose} tall>
      <div className="profile-preview-card">
        <div className="drawer-person-hero">
          <StayRing leaveAt={person.leaveAt} arriveAt={person.arriveAt} size={84}><Avatar src={person.image} size={84} name={person.name} online={isNow && !person.leaveAt} /></StayRing>
          <h2>{person.name}<Verified /></h2>
          <p className="job-label">{person.job}</p>
          <CardPresence presence={person.presence} time={person.time} leaveAt={person.leaveAt} arriveAt={person.arriveAt} />
        </div>

        <button type="button" className="drawer-cafe-row" onClick={() => onOpenCafe(person.cafe)}>
          <Coffee />
          <span>
            <b>{person.cafe}{cafe ? ` · ${cafe.distance} منك` : ''}</b>
            <small>{isNow ? `الجلسة: ${person.seat}` : `${gx(person, 'يوصل', 'توصل')} الساعة ${person.time}`}</small>
          </span>
          <ChevronLeft />
        </button>

        <div className="drawer-detail-section">
          <h4><HeartHandshake /> {gx(person, 'يقدر يساعدك في', 'تقدر تساعدك في')}</h4>
          <p>{person.serviceOffer}</p>
          <div className="service-tags-row">{person.skills.map(s => <span key={s} className="service-tag">{s}</span>)}</div>
        </div>
        <div className="drawer-detail-section">
          <h4><Clock3 /> وقت التواجد</h4>
          <p><StayLine person={person} /></p>
        </div>
        <div className="drawer-detail-section">
          <h4><UserRound /> نبذة</h4>
          <p>{person.bio}</p>
        </div>

        <div className="drawer-cta-actions">
          {cta}
          <small className="help-privacy-hint"><ShieldCheck /> {COPY.consent}</small>
        </div>
      </div>
    </BottomSheet>
  )
}

function Onboarding({ next }: { next: () => void }) {
  return (
    <div className="screen onboarding">
      <StatusBar />
      <div className="hero-art radar-hero" dir="ltr">
        <img className="radar-art" src="/assets/radar-illustration.svg" alt="رادار يكتشف مهارات واحتياجات الأشخاص القريبين" />
        <span className="radar-tag tag-designer">مصمّمة هوية</span>
        <span className="radar-tag tag-developer">مبرمج</span>
        <span className="radar-tag tag-translator">أبحث عن مترجم</span>
        <span className="radar-tag tag-photographer">مصوّر</span>
        <span className="radar-ring-label ring-table">طاولتك</span>
        <span className="radar-ring-label ring-cafe">نفس الكوفي</span>
      </div>
      <div className="onboard-copy">
        <div className="brand"><BrandLogo /></div>
        <h1><span>لا تبحث بالنت،</span><strong>ابحث حولك.</strong></h1>
        <p>في نفس الكوفي، وعلى طاولة قريبة… تلقى اللي تحتاجه.</p>
        <PrimaryButton onClick={next}>يلا نبدأ</PrimaryButton>
      </div>
    </div>
  )
}

function PhoneScreen({ next, back }: { next: () => void; back: () => void }) {
  const { language } = useLanguage()
  const [phone, setPhone] = useState('')
  const requiredLength = language === 'en' ? 10 : 9
  return (
    <div className="screen form-screen">
      <StatusBar />
      <TopBar back={back} />
      <div className="form-content">
        <span className="form-icon"><Phone /></span>
        <h1>رقم جوالك</h1>
        <p>عشان يكون كل اللي حولك أشخاص حقيقيين. رقمك ما يظهر لأحد.</p>
        <label htmlFor="phone">رقم الجوال</label>
        <div className="phone-input" dir="ltr">
          <b>{language === 'en' ? '+1' : '+966'}</b>
          <input id="phone" autoFocus inputMode="numeric" maxLength={requiredLength} placeholder={language === 'en' ? 'XXX XXX XXXX' : '5X XXX XXXX'} value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && phone.length === requiredLength && next()} />
        </div>
      </div>
      <div className="sticky-action"><PrimaryButton onClick={next} disabled={phone.length < requiredLength}>أرسل الرمز</PrimaryButton></div>
    </div>
  )
}

function OtpScreen({ next, back }: { next: () => void; back: () => void }) {
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(BUSINESS.OTP_RESEND_SECONDS)
  useEffect(() => {
    if (code.length === BUSINESS.OTP_LENGTH) { const t = setTimeout(next, 320); return () => clearTimeout(t) }
  }, [code, next])
  useEffect(() => {
    if (!resendIn) return
    const timer = window.setInterval(() => setResendIn(v => Math.max(0, v - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn])
  return (
    <div className="screen form-screen">
      <StatusBar />
      <TopBar back={back} />
      <div className="form-content">
        <span className="form-icon"><ShieldCheck /></span>
        <h1>اكتب الرمز اللي وصلك</h1>
        <p>أرسلنا رمز التحقق المكوّن من {BUSINESS.OTP_LENGTH} أرقام.</p>
        {/* One real input (keeps paste and SMS autofill) drawn as one box per digit. */}
        <label className="otp-field" dir="ltr">
          <input className="otp-input" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={BUSINESS.OTP_LENGTH} value={code} aria-label="رمز التحقق" onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, BUSINESS.OTP_LENGTH))} />
          <span className="otp-boxes" aria-hidden="true">
            {Array.from({ length: BUSINESS.OTP_LENGTH }, (_, i) => (
              <span key={i} className={`otp-box ${code[i] ? 'filled' : ''} ${i === Math.min(code.length, BUSINESS.OTP_LENGTH - 1) ? 'current' : ''}`}>{code[i] || ''}</span>
            ))}
          </span>
        </label>
        <button className="text-button" disabled={resendIn > 0} onClick={() => { setCode(''); setResendIn(BUSINESS.OTP_RESEND_SECONDS) }}>
          {resendIn ? `إعادة الإرسال بعد ${resendIn} ث` : 'أرسل الرمز مرة ثانية'}
        </button>
      </div>
      <div className="sticky-action"><PrimaryButton onClick={next} disabled={code.length < BUSINESS.OTP_LENGTH}>تأكيد الرمز</PrimaryButton></div>
    </div>
  )
}

function LocationScreen({ next, manual, back }: { next: () => void; manual: () => void; back: () => void }) {
  return (
    <div className="screen location-screen">
      <StatusBar />
      <TopBar back={back} />
      <div className="location-visual"><div className="radar"><MapPin /><i /><i /></div></div>
      <div className="onboard-copy">
        <h1>خلنا نشوف وش حولك</h1>
        <p>نستخدم موقعك عشان نوريك الأقرب لك أول. موقعك الدقيق ما يظهر لأي أحد، يظهر بس اسم الكافيه.</p>
        <PrimaryButton onClick={next} icon={<LocateFixed />}>استخدم موقعي</PrimaryButton>
        <button className="text-button" onClick={manual}>أختار المدينة والحي بنفسي</button>
      </div>
    </div>
  )
}

function LocationSheet({ current, close, save }: { current: Loc; close: () => void; save: (l: Loc) => void }) {
  const [city, setCity] = useState(current.city)
  const [area, setArea] = useState(current.area)
  const { language } = useLanguage()
  return (
    <BottomSheet onClose={close}>
      <div className="sheet-title">
        <span className="sheet-icon"><MapPin /></span>
        <div><h2>وين أنت؟</h2><p>نرتّب لك الأشخاص والكافيهات من الأقرب لك</p></div>
      </div>
      <button type="button" className="select-row as-button" onClick={() => save(DEFAULT_LOC)}>
        <LocateFixed />
        <span><small>الأدق</small>استخدم موقعي الحالي</span>
        {current.mode === 'gps' && <Check className="row-check" />}
      </button>
      {/* «المدينة» is also the city of Madinah, so the label is picked here rather than by the translator. */}
      <label className="field-label" data-no-translate>{language === 'en' ? 'City' : 'المدينة'}</label>
      <div className="chip-row">{CITIES.map(c => <Chip key={c} active={city === c} onClick={() => setCity(c)}>{c}</Chip>)}</div>
      {city === LIVE_CITY ? (
        <>
          <label className="field-label">الحي</label>
          <div className="chip-row">{Object.keys(AREAS).map(a => <Chip key={a} active={area === a} onClick={() => setArea(a)}>{a}</Chip>)}</div>
        </>
      ) : (
        <p className="inline-empty">AroundMe متاح حاليًا في {LIVE_CITY} بس. تقدر تختار {city} ونبلغك أول ما نوصلها.</p>
      )}
      <PrimaryButton onClick={() => save({ mode: 'manual', city, area: city === LIVE_CITY ? area : '' })}>اعتمد الموقع</PrimaryButton>
    </BottomSheet>
  )
}

function MetPrompt({ name, onAnswer }: { name: string; onAnswer: (met: boolean) => void }) {
  return (
    <div className="met-prompt">
      <b>تقابلت مع {first(name)}؟</b>
      <div>
        <button className="met-no" onClick={() => onAnswer(false)}>لا، مو بعد</button>
        <button className="met-yes" onClick={() => onAnswer(true)}><Check /> إيه، تقابلنا</button>
      </div>
    </div>
  )
}

function HomeScreen({ onTab, unread, onHereNow, onGoing, active, onChat, onMet, onLocation, visit, now, onPlanVisit, onOpenVisit }: {
  visit?: Visit; now: number; onPlanVisit: () => void; onOpenVisit: (id: string) => void; onHereNow: () => void; onGoing: () => void;
  onTab: (t: Tab) => void; unread: number; active?: Connection;
  onChat: () => void; onMet: (met: boolean) => void; onLocation: () => void;
}) {
  const d = useData()
  const last = active && [...active.messages].reverse().find(m => m.from !== 'system')
  return (
    <div className={`screen app-screen home-screen ${active ? 'has-connection' : ''}`}>
      <StatusBar />
      <header className="brand-header">
        <div>
          <BrandLogo compact />
          <LocationChip onClick={onLocation} />
        </div>
      </header>

      {active && (
        <div className="active-meet home-active">
          <div className="active-top">
            <Avatar src={active.image} size={54} name={active.name} />
            <div><small>محادثة نشطة</small><h3>{active.name}</h3><p><MapPin /> {active.cafe} · {active.topic}</p></div>
            <span className="pulse-dot" />
          </div>
          {last && <p className="active-last">{last.from === 'me' ? 'أنت: ' : ''}{last.text}</p>}
          {active.askMet ? <MetPrompt name={active.name} onAnswer={onMet} /> : <PrimaryButton onClick={onChat} icon={<MessageCircle />}>{COPY.openChat}</PrimaryButton>}
        </div>
      )}

      {/* Three moments: already at a café, on the way, or planning a later visit. */}
      <section className={`journey-gateway moments ${visit ? '' : 'is-last'}`}>
        <div className="gateway-intro">
          <h1>تحديد حالة الزيارة</h1>
        </div>
        <div className="journey-cards">
          <button className="journey-card seek moment" onClick={onHereNow}>
            <span className="journey-icon"><MapPin /></span>
            <span className="journey-copy">
              <b>أنا في الكوفي الحين</b>
              <em>{d.live ? 'شوف مهارات واحتياجات اللي حولك' : `ما وصلنا ${d.loc.city} للحين`}</em>
            </span>
            <i><ChevronLeft /></i>
          </button>
          <button className="journey-card help moment" onClick={onGoing}>
            <span className="journey-icon"><Navigation /></span>
            <span className="journey-copy">
              <b>رايح للكوفي الآن</b>
              <em>علّمهم إنك بالطريق واطلب مسبقاً</em>
            </span>
            <i><ChevronLeft /></i>
          </button>
          <button className="journey-card help moment" onClick={onPlanVisit}>
            <span className="journey-icon"><CalendarPlus /></span>
            <span className="journey-copy">
              <b>جَدوِل زيارتك القادمة</b>
              <em>احجز طاولتك واطلب قبل توصل</em>
            </span>
            <i><ChevronLeft /></i>
          </button>
        </div>
        <div className="gateway-trust"><Sparkles /><span><small>يمكن تكون جالس جنب شخص يملك حل مشكلتك أو يحتاج خبرتك! AroundMe يبيّن لك اهتمامات ومهارات الناس المتواجدين معك بالكوفي، ويحوّل الجلسة لفرصة تعاون.</small></span></div>
      </section>

      {visit && (
        <section className="home-visit">
          <button className="home-visit-card" onClick={() => onOpenVisit(visit.id)}>
            <CafeThumb cafe={allCafes.find(c => c.name === visit.cafe)} />
            <span className="home-visit-copy">
              <small>{visit.going ? <Navigation /> : <CalendarClock />} {visit.going ? 'في طريقك' : 'زيارتك القادمة'}</small>
              <b>{visit.cafe}</b>
              <em>{visitWhen(visit.at, now)}</em>
              <i>{visit.at <= now ? (visit.order ? `بدأت زيارتك · رقم طلبك #${visit.order.code}` : 'بدأت زيارتك') : `${visit.going ? 'توصل' : 'تبدأ'} بعد ${timeLeft(visit.at, now)}`}</i>
            </span>
            <ChevronLeft />
          </button>
          {(visit.table || visit.order) && (
            <div className="home-visit-notes booking">
              {visit.table && <span><Armchair />{tableLabel(visit.table)}</span>}
              {visit.order && <span><Receipt />{`طلبك مدفوع · ${itemsLabel(linesCount(visit.order.lines))}`}</span>}
            </div>
          )}
          {(visitPurpose(visit) || visit.workOn) && (
            <div className="home-visit-notes">
              {visitPurpose(visit) && <span className={`visit-purpose ${visit.mode ?? ''}`}>{visit.mode === 'seek' ? <Search /> : <HeartHandshake />}{visitPurpose(visit)}</span>}
              {visit.workOn && <span>بشتغل على: {visit.workOn}</span>}
            </div>
          )}
        </section>
      )}

      <TabBar tab="home" onTab={onTab} unread={unread} />
    </div>
  )
}

function IntentScreen({ mode, cafe, back, mySkills, privateMode, onContinue }: {
  mode: ActionMode; cafe?: string; back: () => void; mySkills: string[]; privateMode: boolean; onContinue: (text: string, skills: string[]) => void;
}) {
  const [text, setText] = useState('')
  const seek = mode === 'seek'
  const choices = seek ? ['مراجعة عرض', 'Excel', 'تصميم', 'تطوير تطبيق', 'تسويق'] : Array.from(new Set([...mySkills, 'React Native', 'تطوير واجهات', 'تسويق', 'تصميم']))
  const [selected, setSelected] = useState<string[]>(seek ? [] : mySkills)
  const topics = seek ? understand(text) : []
  const ready = seek ? !!(text.trim() || selected.length) : selected.length > 0
  const toggle = (c: string) => setSelected(selected.includes(c) ? selected.filter(x => x !== c) : [...selected, c])
  return (
    <div className="screen intent-setup-screen">
      <StatusBar />
      <TopBar title={seek ? COPY.seek : COPY.help} back={back} />
      <main>
        <span className="intent-hero-icon">{seek ? <Search /> : <HeartHandshake />}</span>
        {cafe && <span className="intent-here"><MapPin />أنت في {cafe}</span>}
        <h1>{seek ? 'وش تحتاج تنجز اليوم؟' : 'وش تقدر تساعد فيه؟'}</h1>
        <p>{seek ? 'اكتب احتياجك بشكل بسيط أو اختر من الاقتراحات.' : 'اختر مهارة أو أكثر، وأضف تفاصيل لو تبي.'}</p>
        {seek && (
          <>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="مثلاً: أبغى أحد يراجع عرضي التقديمي" maxLength={BUSINESS.MAX_NEED_TEXT_CHARS} aria-label="احتياجك" />
            {topics.length > 0 && <div className="understood"><small>فهمنا:</small>{topics.map(t => <span key={t}>{t}</span>)}</div>}
          </>
        )}
        <div className="intent-choice-grid">
          {choices.map(c => <Chip key={c} active={selected.includes(c)} onClick={() => toggle(c)}>{selected.includes(c) && <Check />}{c}</Chip>)}
        </div>
        {!seek && <textarea value={text} onChange={e => setText(e.target.value)} placeholder="تفاصيل إضافية (اختياري): مثلاً أقدر أراجع كود React Native" maxLength={BUSINESS.MAX_NEED_TEXT_CHARS} aria-label="تفاصيل إضافية" />}
        <div className="intent-privacy">
          <ShieldCheck />
          <span>
            <b>خصوصيتك محفوظة</b>
            <small>{seek
              ? privateMode ? 'احتياجك يظهر بدون اسمك وصورتك حتى توافقون الاثنين.' : 'احتياجك يظهر مع اسمك للي حولك، والمحادثة ما تبدأ إلا بموافقتكم.'
              : 'مهاراتك تظهر فقط للأشخاص القريبين منك.'}</small>
          </span>
        </div>
      </main>
      <div className="sticky-action">
        <PrimaryButton onClick={() => onContinue(text.trim(), selected)} disabled={!ready}>
          {cafe ? (seek ? `اعرض اللي يقدرون يساعدوني هنا` : `اعرض اللي يحتاجون مساعدتي هنا`) : seek ? 'اعرض اللي يقدرون يساعدوني' : 'اعرض اللي يحتاجون مساعدتي'}
        </PrimaryButton>
      </div>
    </div>
  )
}

// "حولك": everyone nearby, grouped by café and ordered by distance from you.
function PeopleScreen({ onTab, unread, h, actionMode, onActionModeChange, presenceFilter, onPresenceFilterChange, onCafe, onLocation }: {
  onTab: (t: Tab) => void; unread: number; h: CardHandlers; actionMode: ActionMode; onActionModeChange: (m: ActionMode) => void;
  presenceFilter: PresenceFilter; onPresenceFilterChange: (f: PresenceFilter) => void; onCafe: (c: string) => void; onLocation: () => void;
}) {
  const d = useData()
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const match = useSearch(query)
  const byPresence = (p: Presence) => presenceFilter === 'all' || p === presenceFilter
  const seek = actionMode === 'seek'
  const pool: { presence: Presence }[] = seek ? d.people : d.needs
  const nowCount = pool.filter(x => x.presence === 'now').length
  const todayCount = pool.length - nowCount

  const fp = d.people.filter(p => byPresence(p.presence) && match(`${p.name} ${p.job} ${p.cafe} ${p.serviceOffer} ${p.skills.join(' ')}`))
  const fn = d.needs.filter(n => byPresence(n.presence) && match(`${n.topic} ${n.text} ${n.cafe} ${n.tags.join(' ')}`))
  const ordered = [...d.cafes].sort((a, b) => a.km - b.km)
  const groups = ordered
    .map(c => ({ cafe: c, people: fp.filter(p => p.cafe === c.name), needs: fn.filter(n => n.cafe === c.name) }))
    .filter(g => (seek ? g.people.length : g.needs.length) > 0)
  const count = seek ? fp.length : fn.length
  const resetAll = () => { setQuery(''); onPresenceFilterChange('all') }

  return (
    <div className="screen app-screen people-screen">
      <StatusBar />
      <header className="people-header">
        <div>
          <h1>{COPY.nearTab}</h1>
          <LocationChip onClick={onLocation} />
        </div>
        {d.live && (
          <button type="button" className="icon-btn" onClick={() => { setSearching(!searching); setQuery('') }} aria-label={searching ? 'إغلاق البحث' : 'بحث'}>
            {searching ? <X /> : <Search />}
          </button>
        )}
      </header>

      {!d.live ? <main className="people-discovery"><NotLiveState onChange={onLocation} /></main> : (
        <>
          <div className="screen-gutter"><IntentSwitch mode={actionMode} onChange={onActionModeChange} /></div>
          {searching && (
            <div className="search-field people-search">
              <Search />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={seek ? 'ابحث بالمهارة أو التخصص' : 'ابحث بنوع الاحتياج'} aria-label="بحث" />
            </div>
          )}
          <div className="presence-filter-bar">
            <button type="button" className={`presence-filter-pill ${presenceFilter === 'all' ? 'active' : ''}`} onClick={() => onPresenceFilterChange('all')}>الكل · {pool.length}</button>
            <button type="button" className={`presence-filter-pill ${presenceFilter === 'now' ? 'active active-now' : ''}`} onClick={() => onPresenceFilterChange('now')}><i className="live-dot" />الآن · {nowCount}</button>
            <button type="button" className={`presence-filter-pill ${presenceFilter === 'today' ? 'active active-today' : ''}`} onClick={() => onPresenceFilterChange('today')}><Clock3 className="time-clock-icon" />اليوم · {todayCount}</button>
          </div>

          <main className="people-discovery">
            {count === 0 && <EmptyState title="ما لقينا أحد بهالخيارات" hint="جرّب «الكل» أو كلمة بحث ثانية." action="اعرض الكل" onAction={resetAll} />}
            {groups.map(g => (
              <section key={g.cafe.id} className="cafe-group">
                <button type="button" className="cafe-group-head" onClick={() => onCafe(g.cafe.name)} aria-label={`${g.cafe.name}، ${g.cafe.area}، ${g.cafe.distance}`}>
                  <img className="cafe-group-thumb" src={g.cafe.image} alt="" onError={hidePhoto} />
                  <span className="cafe-group-copy"><b>{g.cafe.name}</b><small>{g.cafe.area} · {g.cafe.distance}</small></span>
                  <strong>{seek ? `${g.people.length} يقدرون يساعدون` : `${g.needs.length} يحتاجون مساعدة`}</strong>
                  <ChevronLeft />
                </button>
                <div className="card-stack cafe-thread">
                  {seek ? g.people.map(p => <HelperCard key={p.id} p={p} h={h} showCafe={false} />) : g.needs.map(n => <NeedCard key={n.id} n={n} h={h} showCafe={false} />)}
                </div>
              </section>
            ))}
            <ConsentNote />
          </main>
        </>
      )}
      <TabBar tab="people" onTab={onTab} unread={unread} />
    </div>
  )
}

function MapScreen({ onTab, unread, onCafe, actionMode, onActionModeChange, context, onLocation }: {
  onTab: (t: Tab) => void; unread: number; onCafe: (name: string) => void; actionMode: ActionMode; onActionModeChange: (m: ActionMode) => void;
  context: string; onLocation: () => void;
}) {
  const { language } = useLanguage()
  const d = useData()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'open' | 'quiet' | 'outdoor'>('all')
  const match = useSearch(query)
  const visible = d.cafes.filter(c =>
    match(`${c.name} ${c.area}`) &&
    (filter === 'all' || (filter === 'open' && c.isOpen) || (filter === 'quiet' && c.amenities.includes('هادئ للعمل')) || (filter === 'outdoor' && c.amenities.includes('جلسات خارجية'))))
  const counts = d.cafes.map(c => cafeCount(d, c.name, actionMode))
  const bestIdx = counts.indexOf(Math.max(0, ...counts))
  const bestId = counts[bestIdx] > 0 ? d.cafes[bestIdx].id : ''
  const badgeFor = (c: Cafe) => c.id === bestId ? <span><Sparkles /> الأنسب</span> : null

  return (
    <div className="screen app-screen map-screen cafe-list-screen">
      <StatusBar />
      <header className="cafes-header">
        <div><h1>الكافيهات</h1><LocationChip onClick={onLocation} /></div>
      </header>
      {!d.live ? <main className="cafes-browser"><NotLiveState onChange={onLocation} /></main> : (
        <>
          <div className="screen-gutter"><IntentSwitch mode={actionMode} onChange={onActionModeChange} /></div>
          {context && <p className="context-line clamp-1">{context}</p>}
          <div className="search-field cafe-search">
            <Search />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن كافيه أو حي" aria-label="ابحث عن كافيه أو حي" />
          </div>
          <div className="cafe-filter-row">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>الأقرب</Chip>
            <Chip active={filter === 'open'} onClick={() => setFilter('open')}>مفتوح الآن</Chip>
            <Chip active={filter === 'quiet'} onClick={() => setFilter('quiet')}>هادئ للعمل</Chip>
            <Chip active={filter === 'outdoor'} onClick={() => setFilter('outdoor')}>جلسات خارجية</Chip>
          </div>
          <main className="cafes-browser">
            {visible.length === 0 && <EmptyState title="ما لقينا كافيه بهالخيارات" hint={query ? 'جرّب اسم الحي بدل اسم الكافيه.' : 'جرّب فلتر ثاني.'} action="اعرض الكل" onAction={() => { setQuery(''); setFilter('all') }} />}
            {visible.map(cafe => (
              <button className="cafe-browse-card" key={cafe.id} onClick={() => onCafe(cafe.name)}>
                <div className="cafe-image"><CafeThumb cafe={cafe} />{badgeFor(cafe)}</div>
                <div className="cafe-browse-copy">
                  <div><h3>{cafe.name}</h3><ChevronLeft /></div>
                  <p>{cafe.area} · {cafe.distance} · {cafe.eta}</p>
                  {!cafe.isOpen && <span className="open-now closing">{cafe.open}</span>}
                  <div className="cafe-amenities">{cafe.amenities.slice(0, 2).map(t => <span key={t}>{t}</span>)}</div>
                  <div className="cafe-match">
                    {actionMode === 'help' ? <HeartHandshake /> : <div className="mini-avatars">{peopleAt(d, cafe.name).slice(0, 3).map(p => <Avatar key={p.id} src={p.image} size={24} name={p.name} online={false} />)}</div>}
                    <b>{countLine(d, cafe.name, actionMode)}</b>
                  </div>
                </div>
              </button>
            ))}
          </main>
        </>
      )}
      <TabBar tab="map" onTab={onTab} unread={unread} />
    </div>
  )
}

function CafeDetailScreen({ cafeName, back, saved, onToggleSave, actionMode, onActionModeChange, h, visit, onPlan, onOpenVisit, now }: {
  visit?: Visit; onPlan: () => void; onOpenVisit: (id: string) => void; now: number;
  cafeName: string; back: () => void; saved: boolean; onToggleSave: () => void; actionMode: ActionMode; onActionModeChange: (m: ActionMode) => void;
  h: CardHandlers;
}) {
  const { language } = useLanguage()
  const d = useData()
  const cafe = cafeOf(d, cafeName) ?? { ...allCafes[0], km: 0, distance: '', eta: '' }
  const cafePeople = peopleAt(d, cafeName)
  const cafeNeeds = needsAt(d, cafeName)
  const seek = actionMode === 'seek'
  const sortNow = <T extends { presence: Presence }>(xs: T[]) => [...xs].sort((a, b) => (a.presence === b.presence ? 0 : a.presence === 'now' ? -1 : 1))

  return (
    <div className="screen cafe-detail-screen">
      <div className="cafe-cover">
        <img src={cafe.image} alt="" onError={hidePhoto} />
        <div className="cover-shade" />
        <StatusBar />
        <button className="cover-back" onClick={back} aria-label="رجوع"><ChevronRight /></button>
        <button className={`cover-save ${saved ? 'saved' : ''}`} onClick={onToggleSave} aria-label={saved ? 'إلغاء الحفظ' : 'حفظ الكافيه'} aria-pressed={saved}><Bookmark /></button>
      </div>
      <main className="cafe-detail-content">
        <div className="cafe-title-row">
          {cafeLogo(cafe, language) && <img className="cafe-title-logo" src={cafeLogo(cafe, language)} alt="" />}
          <div>
            {!cafe.isOpen && <span className="open-now closing">{cafe.open}</span>}
            <h1>{cafeName}</h1>
            <p>{cafe.area} · {cafe.distance} منك · {cafe.eta}</p>
            <p className="cafe-hours"><Clock3 /> {hoursLine(cafe)}</p>
          </div>
        </div>
        <button className="plan-visit" onClick={() => (visit ? onOpenVisit(visit.id) : onPlan())}>
          <CalendarPlus />
          <span><b>{visit ? 'زيارتك القادمة هنا' : 'جَدوِل زيارتك هنا'}</b><small>{visit ? `${visitWhen(visit.at, now)}${visit.table ? ` · ${tableLabel(visit.table)}` : ''}${visit.order ? ' · طلبك مدفوع' : ''}` : 'احجز طاولتك واطلب قبل توصل'}</small></span>
          <ChevronLeft />
        </button>
        <section className="cafe-section">
          <IntentSwitch mode={actionMode} onChange={onActionModeChange} />
          <div className="section-head">
            <h2>{seek ? 'يقدرون يساعدونك هنا' : 'يحتاجون مساعدتك هنا'}</h2>
            <small>{seek ? cafePeople.length : cafeNeeds.length}</small>
          </div>
          {seek && (cafePeople.length
            ? <div className="card-stack">{sortNow(cafePeople).map(p => <HelperCard key={p.id} p={p} h={h} showCafe={false} />)}</div>
            : <EmptyState title="ما فيه أحد هنا يقدر يساعد حاليًا" hint="جرّب كافيه ثاني قريب." action="ارجع" onAction={back} />)}
          {!seek && (cafeNeeds.length
            ? <div className="card-stack">{sortNow(cafeNeeds).map(n => <NeedCard key={n.id} n={n} h={h} showCafe={false} />)}</div>
            : <EmptyState title="ما فيه احتياجات هنا حاليًا" hint="جرّب كافيهًا آخر قريبًا." />)}
        </section>
        <section className="cafe-section">
          <div className="section-head"><h2>المنيو</h2><button type="button" className="text-button" onClick={() => (visit && !visit.order ? onOpenVisit(visit.id) : onPlan())}>اطلب قبل توصل</button></div>
          <ul className="menu-preview">
            {MENU.filter(m => ['latte', 'v60', 'matcha', 'croissant'].includes(m.id)).map(m => <li key={m.id}><span className="menu-icon">{m.icon}</span><b>{m.name}</b><em>{sar(m.price)}</em></li>)}
          </ul>
          <p className="plan-note"><ShieldCheck />تطلب وتدفع من التطبيق قبل توصل، وما تدفع شي في الكافيه.</p>
        </section>
        <section className="cafe-section">
          <div className="section-head"><h2>عن المكان</h2></div>
          <div className="amenities-grid">{cafe.amenities.map(a => <span key={a}>{amenityIcon[a]} {a}</span>)}</div>
        </section>
      </main>
    </div>
  )
}

const GOAL_OPTIONS = ['مراجعة كود', 'مراجعة تصميم وهوية', 'استشارة تسويق', 'مراجعة عرض تقديمي', 'Excel ونماذج مالية', 'كتابة وتدقيق نصوص']

function MatchProfileScreen({ back, initialSkills, initialGoals, initialNeedDesc, initialAvailable, initialNotify, initialDuration, onSave, onExploreCafes, name, job }: {
  back: () => void;
  initialSkills: string[];
  initialGoals: string[];
  initialNeedDesc: string;
  initialAvailable: boolean;
  initialNotify: boolean;
  initialDuration: number;
  onSave: (data: { skills: string[]; goals: string[]; needDesc: string; availableForHelp: boolean; instantMatchNotify: boolean; preferredDuration: number }) => void;
  onExploreCafes: () => void;
  name: string;
  job: string;
}) {
  const [skills, setSkills] = useState<string[]>(initialSkills)
  const [newSkill, setNewSkill] = useState('')
  const [goals, setGoals] = useState<string[]>(initialGoals.filter(g => GOAL_OPTIONS.includes(g)))
  const [needDesc, setNeedDesc] = useState(initialNeedDesc)
  const [available, setAvailable] = useState(initialAvailable)
  const [notify, setNotify] = useState(initialNotify)
  const [duration, setDuration] = useState(initialDuration)

  const quickSkills = ['React Native', 'تطوير واجهات', 'تصميم UI/UX', 'تسويق رقمي', 'Excel ونمذجة', 'مراجعة عروض', 'ذكاء اصطناعي', 'بايثون', 'إدارة منتجات']
  const removeSkill = (s: string) => setSkills(prev => prev.filter(x => x !== s))
  const addSkill = (s: string) => {
    const trimmed = s.trim()
    if (trimmed && !skills.includes(trimmed)) { setSkills(prev => [...prev, trimmed]); setNewSkill('') }
  }
  const toggleGoal = (g: string) => setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  const handleSave = () => onSave({ skills, goals, needDesc, availableForHelp: available, instantMatchNotify: notify, preferredDuration: duration })

  return (
    <div className="screen match-profile-screen">
      <StatusBar />
      <TopBar title="مهاراتي واحتياجاتي" back={back} action={<button className="text-header-btn" onClick={handleSave}>حفظ</button>} />
      <main>
        <section className="match-hero-card">
          <span className="hero-icon"><Sparkles /></span>
          <div>
            <h2>اللي يشوفه الناس حولك</h2>
            <p>نستخدم مهاراتك واحتياجاتك عشان نوريك القريبين المناسبين، والتواصل دايمًا بموافقة الطرفين.</p>
          </div>
        </section>

        <section className="match-section">
          <div className="match-section-head">
            <h3><Code2 /> {`${COPY.help} في`}</h3>
            <span>{count(skills.length, 'مهارة', 'مهارتين', 'مهارات')}</span>
          </div>
          <p className="match-subtext">تظهر للموجودين في الكافيه لما يدورون على أحد يساعدهم في هالمجالات.</p>
          <div className="tag-cloud-editable">
            {skills.map(s => (
              <span key={s} className="editable-tag">
                {s}
                <button type="button" onClick={() => removeSkill(s)} aria-label={`حذف ${s}`}><X /></button>
              </span>
            ))}
            {skills.length === 0 && <small className="empty-tag-hint">ما أضفت مهارات بعد. اكتب مهارة تحت عشان تظهر للي يحتاجونها.</small>}
          </div>
          <div className="add-tag-box">
            <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill(newSkill))} placeholder="اكتب مهارة (مثلاً: Flutter، SEO)" aria-label="مهارة جديدة" />
            <button type="button" onClick={() => addSkill(newSkill)} disabled={!newSkill.trim()}>إضافة</button>
          </div>
          <div className="suggested-chips">
            <span className="suggested-label">اقتراحات:</span>
            {quickSkills.map(qs => (
              <Chip key={qs} active={skills.includes(qs)} onClick={() => skills.includes(qs) ? removeSkill(qs) : addSkill(qs)}>
                {skills.includes(qs) && <Check />}{qs}
              </Chip>
            ))}
          </div>
          <label className="field-label">الوقت اللي تقدر تعطيه عادةً</label>
          <div className="chip-row duration-row">
            {DURATIONS.map(m => <Chip key={m} active={duration === m} onClick={() => setDuration(m)}>{mins(m)}</Chip>)}
          </div>
        </section>

        <section className="match-section">
          <div className="match-section-head">
            <h3><Handshake /> {`${COPY.seek} في`}</h3>
            <span>{count(goals.length, 'مجال', 'مجالين', 'مجالات')}</span>
          </div>
          <p className="match-subtext">حدد المجالات اللي تحتاج فيها مساعدة عادةً، عشان نوريك القريبين اللي عندهم هالخبرة.</p>
          <div className="goal-chips-grid">
            {GOAL_OPTIONS.map(g => (
              <button key={g} type="button" className={`goal-btn ${goals.includes(g) ? 'active' : ''}`} onClick={() => toggleGoal(g)} aria-pressed={goals.includes(g)}>
                {goals.includes(g) && <Check />}<span>{g}</span>
              </button>
            ))}
          </div>
          <label className="field-label">وش تحتاج أو تبي تنجز حاليًا؟</label>
          <textarea className="help-typein-field" value={needDesc} onChange={e => setNeedDesc(e.target.value)} placeholder="مثلاً: أحتاج أحد يراجع معمارية قاعدة بيانات تطبيقي" rows={3} maxLength={BUSINESS.MAX_NEED_TEXT_CHARS} />
        </section>

        <section className="match-section">
          <div className="match-section-head"><h3><ShieldCheck /> التواجد والتنبيهات</h3></div>
          <button type="button" className="settings-row" onClick={() => setAvailable(!available)} role="switch" aria-checked={available}>
            <span><HeartHandshake /><i><b>متاح للمساعدة</b><small>تظهر في قائمة «يقدرون يساعدون» عند تفعيل هذا الخيار</small></i></span>
            <em className={available ? 'on' : ''} />
          </button>
          <button type="button" className="settings-row" onClick={() => setNotify(!notify)} role="switch" aria-checked={notify}>
            <span><Bell /><i><b>نبّهني بالمناسبين</b><small>لما يتواجد قريب مني أحد يقدر يساعدني أو يحتاج خبرتي</small></i></span>
            <em className={notify ? 'on' : ''} />
          </button>
        </section>

        <section className="preview-match-card">
          <div className="preview-badge-row"><span className="live-pulse"><i /> كيف يشوفك الآخرون</span></div>
          <div className="preview-user-row">
            <Avatar src={images.samer} size={58} name={name} />
            <div className="preview-user-info"><h4>{name}</h4><p>{job}</p></div>
          </div>
          <div className="account-tags">
            {skills.slice(0, 3).map(s => <span key={s}>{s} <Code2 /></span>)}
            {goals.slice(0, 2).map(g => <span key={g}>{g} <Handshake /></span>)}
            {available && <span>متاح للمساعدة <HeartHandshake /></span>}
          </div>
          {needDesc.trim() && <div className="preview-need-quote"><small>يحتاج حاليًا:</small><p>{needDesc}</p></div>}
        </section>

        <div className="match-action-box">
          <PrimaryButton onClick={handleSave} icon={<Check />}>حفظ التعديلات</PrimaryButton>
          <button type="button" className="text-button explore-cafes-btn" onClick={onExploreCafes}><Compass /> شوف المناسبين حولك</button>
        </div>
      </main>
    </div>
  )
}

function AccountScreen({ onTab, unread, onSettings, onCafe, onEdit, onMatchProfile, name, job, skills, goals, availableForHelp, savedCafes, visits, now, onPlanVisit, onOpenVisit }: {
  onTab: (t: Tab) => void;
  unread: number;
  onSettings: () => void;
  onCafe: (name: string) => void;
  onEdit: () => void;
  onMatchProfile: () => void;
  name: string;
  job: string;
  skills: string[];
  goals: string[];
  availableForHelp: boolean;
  savedCafes: string[];
  visits: Visit[];
  now: number;
  onPlanVisit: () => void;
  onOpenVisit: (id: string) => void;
}) {
  const d = useData()
  const history = [
    { name: 'عنوان القهوة', when: 'أمس', note: 'ساعدت شخصين · استفدت من شخص' },
    { name: 'ستاربكس', when: 'قبل 3 أيام', note: 'استفدت من مراجعة نموذج مالي' },
  ]
  return (
    <div className="screen app-screen account-screen account-refresh">
      <StatusBar />
      <header className="page-header">
        <div><small>ملفك في AroundMe</small><h1>حسابي</h1></div>
        <button className="icon-btn settings-button" onClick={onSettings} aria-label="الإعدادات"><Settings /></button>
      </header>
      <main>
        <section className="account-profile">
          <Avatar src={images.samer} size={92} name={name} online={availableForHelp} />
          <div>
            <span className={`profile-status ${availableForHelp ? '' : 'is-off'}`}>{availableForHelp ? 'متاح للمساعدة' : 'غير متاح حاليًا'}</span>
            <h2>{name}</h2>
            <p>{job}</p>
            <button onClick={onEdit}><Edit3 /> تعديل الملف الشخصي</button>
          </div>
        </section>
        <button className="account-row" onClick={onMatchProfile}>
          <div>
            <small className="eyebrow">اللي يشوفه الناس حولك</small>
            <h3>مهاراتي واحتياجاتي</h3>
            <div className="account-tags">
              {skills.slice(0, 2).map(s => <span key={s}>{s} <Code2 /></span>)}
              {goals.slice(0, 1).map(g => <span key={g}>{g} <Handshake /></span>)}
              {availableForHelp && <span>متاح للمساعدة <HeartHandshake /></span>}
            </div>
          </div>
          <ChevronLeft />
        </button>
        <div className="account-stats">
          <span><b>12</b><small>مرة ساعدت</small></span>
          <span><b>5</b><small>مرة استفدت</small></span>
          <span><b>3</b><small>أماكن زرتها</small></span>
        </div>

        <div className="section-head account-section-head">
          <h2>زياراتك القادمة</h2>
          <button onClick={onPlanVisit}>زيارة جديدة</button>
        </div>
        {visits.length === 0 && <p className="visit-empty">ما عندك زيارات قادمة</p>}
        {visits.map(v => {
          const c = allCafes.find(x => x.name === v.cafe)
          return (
            <button key={v.id} className="history-card visit-card" onClick={() => onOpenVisit(v.id)}>
              <CafeThumb cafe={c} />
              <div>
                <h3>{v.cafe}</h3>
                <p><CalendarClock /> {visitWhen(v.at, now)}</p>
                {(v.table || v.order) && <span className="visit-badges">{v.table && <i><Armchair />{tableLabel(v.table)}</i>}{visitPaid(v) > 0 && <i><Receipt />{`مدفوع ${sar(visitPaid(v))}`}</i>}</span>}
                {visitPurpose(v) && <small>{visitPurpose(v)}</small>}
              </div>
              <ChevronLeft />
            </button>
          )
        })}

        {savedCafes.length > 0 && (
          <>
            <div className="section-head account-section-head"><h2>أماكن حفظتها</h2></div>
            {savedCafes.map(n => {
              const c = cafeOf(d, n) ?? { ...allCafes.find(x => x.name === n)!, distance: '' }
              return (
                <button key={n} className="history-card" onClick={() => onCafe(n)}>
                  <CafeThumb cafe={c} />
                  <div><h3>{n}</h3><small>{c.area}{c.distance ? ` · ${c.distance}` : ''}</small><p><Bookmark /> محفوظ</p></div>
                  <ChevronLeft />
                </button>
              )
            })}
          </>
        )}

        <div className="section-head account-section-head">
          <h2>زياراتك الأخيرة</h2>
          <button onClick={() => onTab('map')}>كل الكافيهات</button>
        </div>
        {history.map(v => {
          const c = allCafes.find(x => x.name === v.name)!
          return (
            <button key={v.name} className="history-card" onClick={() => onCafe(v.name)}>
              <CafeThumb cafe={c} />
              <div><h3>{v.name}</h3><small>{v.when} · {c.area}</small><p><UsersRound /> {v.note}</p></div>
              <ChevronLeft />
            </button>
          )
        })}
      </main>
      <TabBar tab="account" onTab={onTab} unread={unread} />
    </div>
  )
}

function SettingsScreen({ back, privateMode, setPrivateMode, notifications, setNotifications, onLogout, onLocation, pref, setPref, wallet, setWallet }: {
  wallet: WalletKind;
  setWallet: (w: WalletKind) => void;
  onLocation: () => void;
  pref: MeetPref;
  setPref: (p: MeetPref) => void;
  back: () => void;
  privateMode: boolean;
  setPrivateMode: (v: boolean) => void;
  notifications: boolean;
  setNotifications: (v: boolean) => void;
  onLogout: () => void;
}) {
  const { loc } = useData()
  return (
    <div className="screen settings-screen">
      <StatusBar />
      <TopBar title="الإعدادات" back={back} />
      <main>
        <section>
          <h3>الخصوصية والتواصل</h3>
          <button className="settings-row" onClick={() => setPrivateMode(!privateMode)} role="switch" aria-checked={privateMode}>
            <span><ShieldCheck /><i><b>إخفاء هويتي قبل الموافقة</b><small>ما يظهر اسمك أو صورتك إلا بعد موافقة الطرفين</small></i></span>
            <em className={privateMode ? 'on' : ''} />
          </button>
          <button className="settings-row" onClick={() => setNotifications(!notifications)} role="switch" aria-checked={notifications}>
            <span><Bell /><i><b>الإشعارات</b><small>الطلبات والردود والرسائل الجديدة</small></i></span>
            <em className={notifications ? 'on' : ''} />
          </button>
        </section>
        <section>
          <h3>الموقع والظهور</h3>
          <button className="settings-link" onClick={onLocation}><span><MapPin /><i className="settings-link-copy"><b>موقعي</b><small>{locLabel(loc)}</small></i></span><ChevronLeft /></button>
          <button className="settings-row" onClick={() => setPref(pref === 'same' ? 'all' : 'same')} role="switch" aria-checked={pref === 'same'}>
            <span><UsersRound /><i><b>أتواصل مع نفس الجنس فقط</b><small>يظهر لك ويشوفك بس الأشخاص من نفس الجنس</small></i></span>
            <em className={pref === 'same' ? 'on' : ''} />
          </button>
        </section>
        <section>
          <h3>الدفع</h3>
          <p className="settings-hint">تدفع طلباتك من التطبيق قبل توصل، وما تدفع شي في الكافيه.</p>
          {(['apple', 'google'] as WalletKind[]).map(w => (
            <button key={w} className="settings-row" onClick={() => setWallet(w)} role="radio" aria-checked={wallet === w}>
              <span><WalletLogo kind={w} className="settings-wallet-logo" /><i><b dir="ltr">{WALLET_NAME[w]}</b><small>{wallet === w ? 'طريقة الدفع المفضلة' : 'استخدمها كطريقة مفضلة'}</small></i></span>
              {wallet === w ? <Check className="settings-check" /> : <span className="settings-check-empty" />}
            </button>
          ))}
        </section>
        <section>
          <button className="settings-link danger" onClick={onLogout}><span><LogOut />تسجيل الخروج</span><ChevronLeft /></button>
        </section>
      </main>
    </div>
  )
}

function InboxScreen({ onTab, unread, connections, openChat, cafeVisits, now, openCafeChat }: { onTab: (t: Tab) => void; unread: number; connections: Connection[]; openChat: (id: string) => void; cafeVisits: Visit[]; now: number; openCafeChat: (id: string) => void }) {
  const hasActive = connections.some(c => c.status === 'active')
  const [seg, setSeg] = useState<'active' | 'past'>(() => hasActive || !connections.length ? 'active' : 'past')
  const list = connections.filter(c => c.status === seg)

  return (
    <div className="screen app-screen inbox-screen">
      <StatusBar />
      <header className="page-header"><div><h1>الرسائل</h1></div></header>
      <div className="two-segment" role="tablist">
        <button role="tab" aria-selected={seg === 'active'} className={seg === 'active' ? 'active' : ''} onClick={() => setSeg('active')}>نشطة</button>
        <button role="tab" aria-selected={seg === 'past'} className={seg === 'past' ? 'active' : ''} onClick={() => setSeg('past')}>سابقة</button>
      </div>
      <main>
        {seg === 'active' && cafeVisits.map(v => {
          const t = cafeThread(v, now), last = t[t.length - 1], c = allCafes.find(x => x.name === v.cafe)
          return (
            <button className="conversation cafe-conversation" key={v.id} onClick={() => openCafeChat(v.id)}>
              <Avatar src={c?.image ?? ''} size={64} name={v.cafe} online={false} />
              <div>
                <div><h3>{v.cafe}</h3><time>{clock(last.at)}</time></div>
                <p>{last.from === 'me' ? 'أنت: ' : ''}{last.text}</p>
                <small><Receipt /> {v.order ? `طلب #${v.order.code}` : tableLabel(v.table!)} · {visitWhen(v.at, now)}</small>
              </div>
              {cafeUnread(v, now) > 0 && <i aria-label="رسائل جديدة" />}
            </button>
          )
        })}
        {list.length === 0 ? (seg === 'active' && cafeVisits.length ? null : (
          <div className="empty-note">
            <MessageCircle />
            <b>{seg === 'active' ? 'ما عندك محادثات الحين' : 'ما فيه محادثات سابقة'}</b>
            <small>{seg === 'active' ? 'لما توافق أنت وشخص ثاني، تنفتح بينكم محادثة هنا.' : 'المحادثات اللي انتهت تظهر هنا.'}</small>
            {seg === 'active' && <button className="text-button" onClick={() => onTab('people')}>شوف مين حولك</button>}
          </div>
        )) : (
          list.map(c => {
            const last = c.messages[c.messages.length - 1]
            return (
              <button className="conversation" key={c.id} onClick={() => openChat(c.id)}>
                <Avatar src={c.image} size={64} name={c.name} online={false} />
                <div>
                  <div><h3>{c.name}</h3><time>{last.time}</time></div>
                  <p>{last.from === 'me' ? 'أنت: ' : ''}{last.text}</p>
                  <small><MapPin /> {c.cafe} · {c.topic}</small>
                </div>
                {c.unread > 0 && <i aria-label="رسائل جديدة" />}
              </button>
            )
          })
        )}
      </main>
      <TabBar tab="inbox" onTab={onTab} unread={unread} />
    </div>
  )
}

const QUICK = ['أنا جايك', 'وين جالس؟', 'بتأخر شوي']

function ChatScreen({ c, back, send, onMenu, onMet }: { c: Connection; back: () => void; send: (text: string) => void; onMenu: () => void; onMet: (met: boolean) => void }) {
  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [c.messages.length, c.askMet])
  const submit = (text: string) => { if (text.trim()) { send(text.trim()); setDraft('') } }
  const open = c.status === 'active'

  return (
    <div className="screen chat-screen">
      <StatusBar />
      <header className="chat-header">
        <button className="icon-btn" onClick={back} aria-label="رجوع"><ChevronRight /></button>
        <Avatar src={c.image} size={43} name={c.name} online={false} />
        <div>
          <h3>{c.name}</h3>
          <p>{c.cafe} · {open ? c.topic : c.endedMet ? 'تقابلتوا' : 'انتهت المحادثة'}</p>
        </div>
        <button className="icon-btn" onClick={onMenu} aria-label="خيارات"><MoreHorizontal /></button>
      </header>
      <div className="chat-scroll" ref={scroller}>
        {c.messages.map((m, i) =>
          m.from === 'system'
            ? <div key={i} className="system-message">{m.text}</div>
            : <div key={i} className={`bubble ${m.from === 'me' ? 'mine' : 'theirs'}`}>{m.text}<time>{m.time}</time></div>
        )}
        {open && c.askMet && <MetPrompt name={c.name} onAnswer={onMet} />}
      </div>
      {open ? (
        <div className="chat-compose">
          <div className="quick-row">{QUICK.map(q => <Chip key={q} onClick={() => submit(q)}>{q}</Chip>)}</div>
          <div className="composer">
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit(draft)} placeholder="اكتب رسالة" aria-label="رسالة" />
            <button onClick={() => submit(draft)} aria-label="إرسال" disabled={!draft.trim()}><Send /></button>
          </div>
        </div>
      ) : (
        <div className="chat-compose chat-readonly">
          <span>{c.endedMet ? 'تقابلتوا. المحادثة صارت للقراءة بس.' : 'انتهت المحادثة، وتقدر تقراها بس.'}</span>
          <button className="chat-inbox-route-btn" onClick={back}><MessageCircle /> رجوع للرسائل</button>
        </div>
      )}
    </div>
  )
}

const DEMO_NAME = 'سامر خليلي'
const DEMO_JOB = 'مطور واجهات أمامية · الرياض'
// Inputs aren't page text, so the demo profile is shown in the current language until the person edits it.
const useDemoText = () => {
  const { language } = useLanguage()
  return (v: string) => (language === 'en' && (v === DEMO_NAME || v === DEMO_JOB) ? toEnglish(v) : v)
}

// ---------- Planned visits ----------
// mode: what the visit is for, the same two choices as the home screen. why is kept for visits saved before mode existed.
export type Visit = { id: string; cafe: string; at: number; mode?: ActionMode; detail?: string; workOn?: string; why?: string; canHelp?: string; table?: TableHold; order?: Order; chat?: CafeMessage[]; chatSeen?: number; going?: boolean }
const VISIT_GRACE = 60 * 60000 // a visit stays listed for an hour after its start time
const VISIT_DAYS = 7
const MINUTE_STEP = 5
const dayStart = (offset: number, now: number) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return d.getTime() }
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const visitDay = (at: number, now: number) => {
  const diff = Math.round((dayStart(0, at) - dayStart(0, now)) / 86400000)
  return diff <= 0 ? 'اليوم' : diff === 1 ? 'غدًا' : WEEKDAYS[new Date(at).getDay()]
}
const visitWhen = (at: number, now: number) => `${visitDay(at, now)} · ${clock(at)}`
// One line for a visit's purpose, wherever the visit is shown.
const visitPurpose = (v: Visit) => {
  if (v.mode === 'seek') return v.detail ? `أحتاج مساعدة في: ${v.detail}` : COPY.seek
  if (v.mode === 'help') return v.detail ? `أقدر أساعد في: ${v.detail}` : COPY.help
  return v.canHelp ? `أقدر أساعد في: ${v.canHelp}` : v.why ?? ''
}

// ---------- Booking a table, ordering ahead, paying ahead ----------
// Everything is paid in the app before the visit, so nothing is paid at the café.
export type WalletKind = 'apple' | 'google'
const WALLET_NAME: Record<WalletKind, string> = { apple: 'Apple Pay', google: 'Google Pay' }
const deviceWallet = (): WalletKind => (typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? 'apple' : 'google')
// The table fee is paid ahead with the order, and holds the table for an hour after the visit time.
export type TableHold = { party: number; seat: string; fee?: number; wallet?: WalletKind; bookedAt?: number }
export type OrderLine = { id: string; qty: number }
export type Order = { lines: OrderLine[]; note?: string; total: number; wallet: WalletKind; code: string; paidAt?: number }
type MenuCat = 'coffee' | 'drinks' | 'food'
type MenuItem = { id: string; cat: MenuCat; name: string; desc: string; price: number; icon: React.ReactNode }
const MENU_CATS: { id: MenuCat; label: string }[] = [{ id: 'coffee', label: 'قهوة' }, { id: 'drinks', label: 'مشروبات' }, { id: 'food', label: 'أكل' }]
const MENU: MenuItem[] = [
  { id: 'latte', cat: 'coffee', name: 'لاتيه', desc: 'إسبريسو مع حليب مبخر', price: 18, icon: <Coffee /> },
  { id: 'spanish', cat: 'coffee', name: 'سبانش لاتيه', desc: 'لاتيه بالحليب المكثف', price: 21, icon: <Coffee /> },
  { id: 'flatwhite', cat: 'coffee', name: 'فلات وايت', desc: 'دبل شوت بطبقة حليب خفيفة', price: 19, icon: <Coffee /> },
  { id: 'v60', cat: 'coffee', name: 'V60', desc: 'قهوة مقطرة، محصول اليوم', price: 22, icon: <Coffee /> },
  { id: 'coldbrew', cat: 'coffee', name: 'كولد برو', desc: 'منقوعة 18 ساعة', price: 20, icon: <CupSoda /> },
  { id: 'espresso', cat: 'coffee', name: 'إسبريسو', desc: 'دبل شوت', price: 12, icon: <Coffee /> },
  { id: 'matcha', cat: 'drinks', name: 'ماتشا لاتيه', desc: 'ماتشا ياباني مع حليب', price: 21, icon: <CupSoda /> },
  { id: 'tea', cat: 'drinks', name: 'شاي', desc: 'أحمر أو أخضر', price: 10, icon: <Coffee /> },
  { id: 'orange', cat: 'drinks', name: 'عصير برتقال', desc: 'طازج', price: 16, icon: <CupSoda /> },
  { id: 'water', cat: 'drinks', name: 'ماء', desc: '330 مل', price: 4, icon: <GlassWater /> },
  { id: 'croissant', cat: 'food', name: 'كرواسون بالزبدة', desc: 'مخبوز اليوم', price: 12, icon: <Croissant /> },
  { id: 'halloumi', cat: 'food', name: 'ساندويتش حلومي', desc: 'حلومي وطماطم وزعتر', price: 26, icon: <Sandwich /> },
  { id: 'cheesecake', cat: 'food', name: 'تشيز كيك', desc: 'قطعة', price: 22, icon: <CakeSlice /> },
  { id: 'cookie', cat: 'food', name: 'كوكيز', desc: 'بالشوكولاتة', price: 9, icon: <Cookie /> },
]
const menuItem = (id: string) => MENU.find(m => m.id === id)
const sar = (n: number) => `${n} ر.س`
const linesTotal = (lines: OrderLine[]) => lines.reduce((t, l) => t + (menuItem(l.id)?.price ?? 0) * l.qty, 0)
const linesCount = (lines: OrderLine[]) => lines.reduce((t, l) => t + l.qty, 0)
const itemsLabel = (n: number) => count(n, 'صنف', 'صنفين', 'أصناف')
const partyLabel = (n: number) => (n === 1 ? 'لحالي' : n === 2 ? 'شخصين' : `${n} أشخاص`)
const tableLabel = (t: TableHold) => `طاولة ${t.party === 1 ? 'لشخص' : t.party === 2 ? 'لشخصين' : `لـ${t.party} أشخاص`}${t.seat !== SEAT_ANY ? ` · ${t.seat}` : ''}`
const SEAT_ANY = 'أي مكان'
// Seating choices follow what the café actually has.
const seatOptions = (c?: { amenities: string[] }) => [
  SEAT_ANY,
  ...(c?.amenities.includes('هادئ للعمل') ? ['منطقة هادئة'] : []),
  ...(c?.amenities.includes('مقابس') ? ['قريب من مقبس'] : []),
  'عند النافذة',
  ...(c?.amenities.includes('جلسات خارجية') ? ['جلسات خارجية'] : []),
]
const TABLE_FEE = 5
const HOLD_LABEL = 'ساعة'
// What was paid for a visit (table fee plus order), and with which wallet.
const visitPaid = (v: Visit) => (v.table?.fee ?? 0) + (v.order?.total ?? 0)
const visitWallet = (v: Visit) => v.order?.wallet ?? v.table?.wallet
// Payments are final: cancelling frees the table and stops the order, but nothing is refunded.
const refundNote = (v: Visit) => {
  const what = v.table && v.order ? 'الحجز والطلب' : v.order ? 'الطلب' : v.table ? 'حجز الطاولة' : 'الزيارة'
  const paid = visitPaid(v)
  return paid ? `نلغي ${what}، والمبلغ المدفوع ${sar(paid)} ما يُسترجع.` : `نلغي ${what}.`
}

// ---------- The café's thread for a visit ----------
// The café writes as the booking and order move along; what the person writes is kept on the visit.
export type CafeMessage = { from: 'me' | 'them'; text: string; at: number }
const CAFE_PREP_MIN = 10
const cafeThread = (v: Visit, now: number): CafeMessage[] => {
  if (!v.table && !v.order) return []
  const out: CafeMessage[] = []
  const first = Math.min(v.table?.bookedAt ?? Infinity, v.order?.paidAt ?? Infinity)
  const start = Number.isFinite(first) ? first : v.at - 60 * 60000
  out.push({ from: 'them', at: start, text: `أهلًا فيك في ${v.cafe}! هنا تقدر تكلمنا عن زيارتك ${visitWhen(v.at, start)}.` })
  if (v.table) out.push({ from: 'them', at: (v.table.bookedAt ?? start) + 1, text: `طاولتك محجوزة: ${tableLabel(v.table)}. نمسكها لك ${HOLD_LABEL} من ${clock(v.at)}.` })
  if (v.order) out.push({ from: 'them', at: (v.order.paidAt ?? start) + 2, text: `استلمنا طلبك #${v.order.code} (${itemsLabel(linesCount(v.order.lines))}). بنجهزه على وقت وصولك.` })
  const prep = v.at - CAFE_PREP_MIN * 60000
  if (v.order && now >= prep) out.push({ from: 'them', at: Math.max(prep, start + 3), text: 'بدأنا نجهز طلبك ☕' })
  if (now >= v.at) out.push({ from: 'them', at: v.at, text: v.order ? `طلبك جاهز عند الكاشير. قول رقم الطلب #${v.order.code}.` : 'طاولتك جاهزة، حياك!' })
  return [...out, ...(v.chat ?? [])].sort((a, b) => a.at - b.at)
}
const cafeUnread = (v: Visit, now: number) => cafeThread(v, now).filter(m => m.from === 'them' && m.at > (v.chatSeen ?? 0)).length
const CAFE_QUICK = ['أنا في الطريق', 'بتأخر شوي', 'وين الطاولة؟']
const CAFE_REPLY = 'وصلتنا رسالتك، وبنبلغ الفريق. شكرًا لك!'

function CafeChatScreen({ v, now, back, send, onVisit }: { v: Visit; now: number; back: () => void; send: (text: string) => void; onVisit: () => void }) {
  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const thread = cafeThread(v, now)
  const c = allCafes.find(x => x.name === v.cafe)
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [thread.length])
  const submit = (text: string) => { if (text.trim()) { send(text.trim()); setDraft('') } }
  const open = v.at + VISIT_GRACE > now
  return (
    <div className="screen chat-screen cafe-chat">
      <StatusBar />
      <header className="chat-header">
        <button className="icon-btn" onClick={back} aria-label="رجوع"><ChevronRight /></button>
        <Avatar src={c?.image ?? ''} size={43} name={v.cafe} online={false} />
        <div>
          <h3>{v.cafe}</h3>
          <p>{v.order ? `طلب #${v.order.code} · ` : ''}{visitWhen(v.at, now)}</p>
        </div>
        <button className="icon-btn" onClick={onVisit} aria-label="تفاصيل الزيارة"><Receipt /></button>
      </header>
      <div className="chat-scroll" ref={scroller}>
        {thread.map((m, i) => <div key={i} className={`bubble ${m.from === 'me' ? 'mine' : 'theirs'}`}>{m.text}<time>{clock(m.at)}</time></div>)}
      </div>
      {open ? (
        <div className="chat-compose">
          <div className="quick-row">{CAFE_QUICK.map(q => <Chip key={q} onClick={() => submit(q)}>{q}</Chip>)}</div>
          <div className="composer">
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit(draft)} placeholder="اكتب للكافيه" aria-label="رسالة للكافيه" />
            <button onClick={() => submit(draft)} aria-label="إرسال" disabled={!draft.trim()}><Send /></button>
          </div>
        </div>
      ) : (
        <div className="chat-compose chat-readonly"><span>انتهت الزيارة، وتقدر تقرا المحادثة بس.</span></div>
      )}
    </div>
  )
}
const hourClock = (h: number) => clock(new Date(2020, 0, 1, h % 24).getTime())
const hoursLine = (c: { hours: [number, number] }) => `${hourClock(c.hours[0])} – ${hourClock(c.hours[1])}`
// Open at that time, with at least half an hour before closing.
const openAt = (c: { hours: [number, number] }, ts: number) => { const d = new Date(ts), h = d.getHours() + d.getMinutes() / 60; return h >= c.hours[0] && h <= c.hours[1] - 0.5 }
const orderCode = () => String(1000 + Math.floor(Math.random() * 9000))
const calendarHref = (v: Visit) => {
  const z = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    v.table ? tableLabel(v.table) : '',
    v.order ? `${itemsLabel(linesCount(v.order.lines))} · ${sar(v.order.total)} · #${v.order.code}` : '',
  ].filter(Boolean).join(' / ')
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AroundMe//EN', 'BEGIN:VEVENT', `UID:${v.id}@aroundme`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(v.at)}`, `DTEND:${z(v.at + 60 * 60000)}`, `SUMMARY:${v.cafe} · AroundMe`, `DESCRIPTION:${lines}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
}

// The wallets' own marks, so the pay buttons look like the ones people know.
function WalletLogo({ kind, className = '' }: { kind: WalletKind; className?: string }) {
  return kind === 'apple'
    ? <svg className={`wallet-logo ${className}`} viewBox="0 0 24 24" aria-hidden="true" stroke="none"><path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" /></svg>
    : <svg className={`wallet-logo ${className}`} viewBox="0 0 24 24" aria-hidden="true" stroke="none">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
}
// The wallet's name as its mark plus "Pay".
const WalletMark = ({ kind }: { kind: WalletKind }) => <span className={`wallet-mark ${kind}`} dir="ltr" aria-label={WALLET_NAME[kind]}><WalletLogo kind={kind} /><span aria-hidden="true">Pay</span></span>

function Stepper({ qty, onChange, label }: { qty: number; onChange: (n: number) => void; label: string }) {
  if (!qty) return <button type="button" className="stepper-add" onClick={() => onChange(1)} aria-label={`أضف ${label}`}><Plus /></button>
  return (
    <span className="stepper">
      <button type="button" onClick={() => onChange(qty - 1)} aria-label={`شيل ${label}`}><Minus /></button>
      <b aria-live="polite">{qty}</b>
      <button type="button" onClick={() => onChange(qty + 1)} aria-label={`أضف ${label}`}><Plus /></button>
    </span>
  )
}

// A stand-in for the phone's own payment sheet: confirm, a short wait, done.
function WalletPay({ wallet, total, merchant, onPaid, onCancel }: { wallet: WalletKind; total: number; merchant: string; onPaid: () => void; onCancel: () => void }) {
  const [stage, setStage] = useState<'confirm' | 'paying' | 'paid'>('confirm')
  useEffect(() => {
    if (stage === 'paying') { const t = window.setTimeout(() => setStage('paid'), 1300); return () => window.clearTimeout(t) }
    if (stage === 'paid') { const t = window.setTimeout(onPaid, 700); return () => window.clearTimeout(t) }
  }, [stage])
  return (
    <div className="wallet-layer" onMouseDown={e => e.target === e.currentTarget && stage === 'confirm' && onCancel()}>
      <section className={`wallet-sheet ${wallet}`} role="dialog" aria-modal="true" aria-label={WALLET_NAME[wallet]}>
        <header><WalletMark kind={wallet} />{stage === 'confirm' && <button type="button" onClick={onCancel}>إلغاء</button>}</header>
        <div className="wallet-row"><CreditCard /><span><b dir="ltr">Visa •••• 4242</b><small>البطاقة في محفظتك</small></span></div>
        <div className="wallet-row"><Store /><span><b>{merchant}</b><small>عن طريق AroundMe</small></span></div>
        <div className="wallet-total"><span>المبلغ</span><b>{sar(total)}</b></div>
        {stage === 'confirm' && <button type="button" className="wallet-confirm" onClick={() => setStage('paying')}>{wallet === 'apple' ? <ScanFace /> : <Smartphone />}ادفع الحين</button>}
        {stage === 'paying' && <p className="wallet-state"><LoaderCircle className="spin" />جاري الدفع…</p>}
        {stage === 'paid' && <p className="wallet-state done"><CircleCheck />تم الدفع</p>}
      </section>
    </div>
  )
}

const WHEEL_ROW = 40
// A scroll wheel like the phone's own time picker: drag or scroll, and the row in the middle band is the value.
function Wheel({ items, index, onChange, label }: { items: string[]; index: number; onChange: (i: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const settle = useRef<number | undefined>(undefined)
  useEffect(() => {
    const el = ref.current
    if (el && Math.round(el.scrollTop / WHEEL_ROW) !== index) el.scrollTop = index * WHEEL_ROW
  }, [index])
  const onScroll = () => {
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ROW)))
      if (i !== index) onChange(i)
    }, 90)
  }
  const step = (d: number) => { const i = Math.max(0, Math.min(items.length - 1, index + d)); ref.current?.scrollTo({ top: i * WHEEL_ROW, behavior: 'smooth' }); onChange(i) }
  return (
    <div className="wheel" ref={ref} onScroll={onScroll} role="listbox" aria-label={label} tabIndex={0}
      onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); step(1) } if (e.key === 'ArrowUp') { e.preventDefault(); step(-1) } }}>
      {items.map((it, i) => (
        <div key={it} role="option" aria-selected={i === index} className={`wheel-item ${i === index ? 'active' : ''}`}
          onClick={() => step(i - index)}>{it}</div>
      ))}
    </div>
  )
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => String(i * MINUTE_STEP).padStart(2, '0'))
const MERIDIEM = ['ص', 'م']
// The first suggested time: an hour from now, on the next 15 minutes.
const suggestedStart = (now: number) => { const q = 15 * 60000; return Math.ceil((now + 60 * 60000) / q) * q }

const PLAN_STEPS = ['الزيارة', 'الطاولة', 'الطلب', 'الدفع']
const ARRIVE_IN = [5, 10, 15, 20, 30, 45]

// "أنا في الكوفي الحين": confirm the café, then what you want to get done today.
function HereNowSheet({ cafes, initialCafe, close, next }: { cafes: Cafe[]; initialCafe?: string; close: () => void; next: (cafe: string, mode: ActionMode) => void }) {
  const open = cafes.filter(c => c.isOpen)
  const [cafe, setCafe] = useState(() => (open.some(c => c.name === initialCafe) ? initialCafe! : open[0]?.name ?? ''))
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ActionMode | null>(null)
  const match = useSearch(query)
  const shown = open.filter(c => match(c.name) || match(c.area))
  return (
    <BottomSheet onClose={close} tall>
      <div className="sheet-title plan-head">
        <span className="sheet-icon"><MapPin /></span>
        <div><h2>أنا في الكوفي الحين</h2><p>أكّد الكافيه، ونعرض لك مين فيه الحين</p></div>
      </div>
      {open.length ? (
        <>
          <label className="field-label" htmlFor="here-cafe-search">أنت في أي كافيه؟</label>
          <div className="search-field visit-search">
            <Search />
            <input id="here-cafe-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن كافيه أو حي" />
          </div>
          <div className="visit-cafe-list" role="radiogroup" aria-label="أنت في أي كافيه؟">
            {shown.map((c, i) => (
              <button key={c.id} type="button" role="radio" aria-checked={cafe === c.name} className={`visit-cafe ${cafe === c.name ? 'active' : ''}`} onClick={() => { setCafe(c.name); setQuery('') }}>
                <CafeThumb cafe={c} />
                <span><b>{c.name}</b><small>{i === 0 && !query ? 'الأقرب لك' : c.area} · {c.distance}</small></span>
                {cafe === c.name && <Check />}
              </button>
            ))}
            {shown.length === 0 && <p className="visit-empty">ما لقينا كافيه بهالاسم</p>}
          </div>
          <label className="field-label">وش حاب تسوي اليوم؟</label>
          <div className="visit-modes" role="radiogroup" aria-label="وش حاب تسوي اليوم؟">
            <button type="button" role="radio" aria-checked={mode === 'seek'} className={`visit-mode seek ${mode === 'seek' ? 'active' : ''}`} onClick={() => setMode('seek')}>
              <span className="journey-icon"><Search /></span><b>{COPY.seek}</b><small>عندي شيء أبي أنجزه</small>
            </button>
            <button type="button" role="radio" aria-checked={mode === 'help'} className={`visit-mode help ${mode === 'help' ? 'active' : ''}`} onClick={() => setMode('help')}>
              <span className="journey-icon"><HeartHandshake /></span><b>{COPY.help}</b><small>عندي خبرة أقدر أشاركها</small>
            </button>
          </div>
        </>
      ) : <p className="visit-empty">ما فيه كافيهات مفتوحة حولك حاليًا</p>}
      <div className="sheet-footer">
        <PrimaryButton onClick={() => cafe && mode && next(cafe, mode)} disabled={!cafe || !mode}>التالي</PrimaryButton>
      </div>
    </BottomSheet>
  )
}

function PlanVisitSheet({ cafes, initialCafe, now, skills, need, wallet: preferred, existing, going: goingNow = false, close, save, onOpenVisit, onSeeCafe }: {
  cafes: Cafe[]; initialCafe: string; now: number; skills: string[]; need: string; wallet: WalletKind;
  // "رايح للكوفي الآن": you pick when you'll arrive instead of a day and time, and there's no table step.
  going?: boolean; onSeeCafe?: (cafe: string, mode?: ActionMode) => void;
  // An already planned visit: the sheet opens on the menu to add an order to it.
  existing?: Visit;
  close: () => void; save: (v: Omit<Visit, 'id'>) => Visit; onOpenVisit: (id: string) => void;
}) {
  const going = existing?.going ?? goingNow
  const { language } = useLanguage()
  const inLanguage = (v: string) => (language === 'en' ? toEnglish(v) : v)
  // Adding to a planned visit starts at the table when none is booked yet, otherwise at the menu.
  const firstStep = existing ? (existing.table || going ? 2 : 1) : 0
  const [step, setStepRaw] = useState(firstStep)
  // On the way there's no table step: the visit step leads straight to the menu.
  const nextStep = (n: number) => (going && n === 1 ? 2 : n)
  const prevStep = (n: number) => (going && n === 1 ? 0 : n)
  // A quick second tap on the same footer spot shouldn't skip the next step.
  const stepAt = useRef(0)
  const setStep = (n: number) => { if (n > step && Date.now() - stepAt.current < 450) return; stepAt.current = Date.now(); setStepRaw(n) }
  const [cafe, setCafe] = useState(() => existing?.cafe ?? (cafes.some(c => c.name === initialCafe) ? initialCafe : cafes[0]?.name ?? ''))
  const [query, setQuery] = useState('')
  const match = useSearch(query)
  const shown = cafes.filter(c => match(c.name) || match(c.area))
  const place = cafes.find(c => c.name === cafe)
  const start = new Date(existing?.at ?? suggestedStart(now))
  const [day, setDay] = useState(() => Math.round((dayStart(0, start.getTime()) - dayStart(0, now)) / 86400000))
  const [hour, setHour] = useState(() => (start.getHours() % 12 || 12) - 1)
  const [minute, setMinute] = useState(() => start.getMinutes() / MINUTE_STEP)
  const [pm, setPm] = useState(() => (start.getHours() >= 12 ? 1 : 0))
  const [mode, setMode] = useState<ActionMode | null>(existing?.mode ?? null)
  const [helpWith, setHelpWith] = useState(() => inLanguage(skills.slice(0, 3).join('، ')))
  const [needWith, setNeedWith] = useState(() => inLanguage(need))
  const [workOn, setWorkOn] = useState(existing?.workOn ?? '')
  const [bookTable, setBookTable] = useState(!going)
  const [arriveIn, setArriveIn] = useState(15)
  const [party, setParty] = useState(existing?.table?.party ?? 1)
  const [seat, setSeat] = useState(existing?.table?.seat ?? SEAT_ANY)
  const [cat, setCat] = useState<MenuCat>('coffee')
  const [lines, setLines] = useState<OrderLine[]>([])
  const [note, setNote] = useState('')
  const [paying, setPaying] = useState<WalletKind | null>(null)
  const [saved, setSaved] = useState<Visit | null>(null)
  const sheetTop = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => { listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' }) }, [])
  // Scroll the sheet itself back to its top, so the grabber and close button stay in view on every step.
  useEffect(() => { sheetTop.current?.closest('.bottom-sheet')?.scrollTo({ top: 0 }) }, [step])

  const at = existing?.at ?? (going ? now + arriveIn * 60000 : new Date(dayStart(day, now)).setHours(((hour + 1) % 12) + pm * 12, minute * MINUTE_STEP, 0, 0))
  const past = at <= now
  const closed = !!place && !past && !openAt(place, at)
  const detail = existing ? existing.detail ?? '' : (mode === 'seek' ? needWith : helpWith).trim()
  const visitReady = !!place && !past && !closed && mode !== null && detail.length >= 3
  const qty = (id: string) => lines.find(l => l.id === id)?.qty ?? 0
  const setQty = (id: string, n: number) => setLines(ls => (n <= 0 ? ls.filter(l => l.id !== id) : ls.some(l => l.id === id) ? ls.map(l => (l.id === id ? { ...l, qty: n } : l)) : [...ls, { id, qty: n }]))
  const items = linesCount(lines)
  // The table fee is charged once, when the table is first booked.
  const fee = bookTable && !existing?.table ? TABLE_FEE : 0
  const total = linesTotal(lines)
  const due = total + fee
  const soonest = () => {
    const t = new Date(Math.ceil((now + 15 * 60000) / (MINUTE_STEP * 60000)) * MINUTE_STEP * 60000)
    setDay(Math.round((dayStart(0, t.getTime()) - dayStart(0, now)) / 86400000)); setHour((t.getHours() % 12 || 12) - 1); setMinute(t.getMinutes() / MINUTE_STEP); setPm(t.getHours() >= 12 ? 1 : 0)
  }
  const finish = (paidWith?: WalletKind) => {
    const v = save({
      ...existing,
      cafe, at, mode: mode ?? undefined, detail, workOn: workOn.trim(), going: going || undefined,
      table: bookTable ? (existing?.table ?? { party, seat, fee: TABLE_FEE, wallet: paidWith, bookedAt: Date.now() }) : undefined,
      order: paidWith && items ? { lines, note: note.trim() || undefined, total, wallet: paidWith, code: orderCode(), paidAt: Date.now() } : undefined,
    })
    setPaying(null); setSaved(v); setStep(4)
  }
  const wallets: WalletKind[] = preferred === 'apple' ? ['apple', 'google'] : ['google', 'apple']

  if (step === 4 && saved) {
    return (
      <BottomSheet onClose={close} tall>
        <div className="plan-done">
          <span className="plan-done-icon"><CircleCheck /></span>
          <h2>{going ? (saved.order ? 'تم الدفع، وطلبك يجهز لوصولك' : 'تمام، أنت في الطريق') : visitPaid(saved) > 0 ? 'تم الدفع وثبّتنا زيارتك' : 'ثبّتنا زيارتك'}</h2>
          <p>{saved.cafe} · {visitWhen(saved.at, now)}</p>
          {saved.order && <div className="order-code"><small>رقم طلبك</small><b dir="ltr">#{saved.order.code}</b><span>يجهز وقت وصولك. ما تدفع شي هناك.</span></div>}
          <ul className="plan-done-list">
            {saved.table && <li><Armchair />{tableLabel(saved.table)}<small>{`نمسكها لك ${HOLD_LABEL} من موعدك`}</small></li>}
            {saved.order && <li><Receipt />{`${itemsLabel(linesCount(saved.order.lines))} · ${sar(saved.order.total)}`}<small>{`مدفوع بـ ${WALLET_NAME[saved.order.wallet]}`}</small></li>}
            {!saved.order && saved.table?.wallet && <li><Receipt />{`رسوم الحجز · ${sar(saved.table.fee ?? TABLE_FEE)}`}<small>{`مدفوعة بـ ${WALLET_NAME[saved.table.wallet]}`}</small></li>}
            {going && <li><Navigation />{`توصل بعد ${timeLeft(saved.at, now)}`}<small>اللي في الكافيه يشوفون إنك جاي</small></li>}
            {!going && !saved.table && !saved.order && <li><CalendarClock />بدون حجز طاولة أو طلب<small>تقدر تضيفهم من تفاصيل الزيارة</small></li>}
          </ul>
          {going && onSeeCafe
            ? <button type="button" className="secondary-button" onClick={() => onSeeCafe(saved.cafe, saved.mode)}><UsersRound />شوف مين هناك</button>
            : <a className="secondary-button" href={calendarHref(saved)} download="aroundme-visit.ics"><CalendarPlus />أضف للتقويم</a>}
          {(saved.table || saved.order) && <p className="plan-note"><MessageCircle />{`${saved.cafe} بيراسلك عن طلبك في الرسائل، وتقدر ترد عليهم.`}</p>}
        </div>
        <div className="sheet-footer">
          <PrimaryButton onClick={close} icon={<Check />}>تم</PrimaryButton>
          <button type="button" className="text-button" onClick={() => onOpenVisit(saved.id)}>تفاصيل الزيارة</button>
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet onClose={close} tall>
      <div ref={sheetTop} className="sheet-title plan-head">
        {step > firstStep
          ? <button type="button" className="plan-back" onClick={() => setStep(prevStep(step - 1))} aria-label="رجوع"><ChevronRight /></button>
          : <span className="sheet-icon">{going ? <Navigation /> : <CalendarPlus />}</span>}
        <div>
          <h2>{step === 0 ? (going ? 'رايح للكوفي الآن' : 'زيارة جديدة') : step === 1 ? 'احجز طاولتك' : step === 2 ? 'اطلب قبل توصل' : 'راجع وادفع'}</h2>
          <p>{step === 0 ? (going ? 'اختر الكافيه ومتى توصل وهدف زيارتك' : 'اختر الكافيه والوقت وهدف زيارتك') : step === 1 ? `رسوم الحجز ${sar(TABLE_FEE)}، ونمسك طاولتك ${HOLD_LABEL}` : step === 2 ? (going ? 'اختياري، ويجهز طلبك وقت وصولك' : `اختياري، ويجهز طلبك ${visitWhen(at, now)}`) : 'تدفع الحين، وما تدفع شي عند وصولك'}</p>
        </div>
      </div>
      <ol className="plan-steps" aria-label="الخطوات">
        {PLAN_STEPS.map((s, i) => ({ s, i })).filter(({ i }) => !(going && i === 1)).map(({ s, i }, n) => <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}><span>{i < step ? <Check /> : n + 1}</span>{s}</li>)}
      </ol>

      {step === 0 && (
        <>
          <label className="field-label" htmlFor="visit-cafe-search">أي كافيه؟</label>
          {cafes.length ? (
            <>
              <div className="search-field visit-search">
                <Search />
                <input id="visit-cafe-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن كافيه أو حي" />
              </div>
              <div className="visit-cafe-list" ref={listRef} role="radiogroup" aria-label="أي كافيه؟">
                {shown.map(c => (
                  <button key={c.id} type="button" role="radio" aria-checked={cafe === c.name} className={`visit-cafe ${cafe === c.name ? 'active' : ''}`} onClick={() => { setCafe(c.name); setQuery(''); setSeat(SEAT_ANY) }}>
                    <CafeThumb cafe={c} />
                    <span><b>{c.name}</b><small>{c.area} · {c.distance} · {hoursLine(c)}</small></span>
                    {cafe === c.name && <Check />}
                  </button>
                ))}
                {shown.length === 0 && <p className="visit-empty">ما لقينا كافيه بهالاسم</p>}
              </div>
            </>
          ) : <p className="visit-empty">ما فيه كافيهات متاحة في مدينتك حاليًا</p>}

          {going ? (
            <>
              <label className="field-label">متى توصل؟</label>
              <div className="chip-row">{ARRIVE_IN.map(m => <Chip key={m} active={arriveIn === m} onClick={() => setArriveIn(m)}>{mins(m)}</Chip>)}</div>
              <p className={`visit-when ${closed ? 'is-past' : ''}`}>{closed && place ? `${place.name} مقفل هالوقت. يفتح ${hoursLine(place)}` : `توصل تقريبًا ${clock(at)}`}</p>
            </>
          ) : (<>
          <label className="field-label">أي يوم؟</label>
          <div className="chip-row visit-days">
            {Array.from({ length: VISIT_DAYS }, (_, i) => <Chip key={i} active={day === i} onClick={() => setDay(i)}>{visitDay(dayStart(i, now), now)}</Chip>)}
          </div>

          <div className="field-label-row"><label className="field-label">أي وقت؟</label><button type="button" className="text-button" onClick={soonest}><Clock3 />أقرب وقت</button></div>
          <div className="time-wheel" dir="ltr">
            <span className="time-wheel-band" aria-hidden="true" />
            <Wheel items={HOURS} index={hour} onChange={setHour} label="الساعة" />
            <span className="time-wheel-colon" aria-hidden="true">:</span>
            <Wheel items={MINUTES} index={minute} onChange={setMinute} label="الدقيقة" />
            <Wheel items={language === 'en' ? ['AM', 'PM'] : MERIDIEM} index={pm} onChange={setPm} label="صباحًا أو مساءً" />
          </div>
          <p className={`visit-when ${past || closed ? 'is-past' : ''}`}>
            {past ? 'هالوقت راح، اختر وقت بعده' : closed && place ? `${place.name} مقفل هالوقت. يفتح ${hoursLine(place)}` : visitWhen(at, now)}
          </p>
          </>)}

          <label className="field-label">وش هدف زيارتك؟</label>
          <div className="visit-modes" role="radiogroup" aria-label="وش هدف زيارتك؟">
            <button type="button" role="radio" aria-checked={mode === 'seek'} className={`visit-mode seek ${mode === 'seek' ? 'active' : ''}`} onClick={() => setMode('seek')}>
              <span className="journey-icon"><Search /></span><b>{COPY.seek}</b><small>عندي شيء أبي أنجزه</small>
            </button>
            <button type="button" role="radio" aria-checked={mode === 'help'} className={`visit-mode help ${mode === 'help' ? 'active' : ''}`} onClick={() => setMode('help')}>
              <span className="journey-icon"><HeartHandshake /></span><b>{COPY.help}</b><small>عندي خبرة أقدر أشاركها</small>
            </button>
          </div>
          {mode === 'seek' && (
            <>
              <label className="field-label" htmlFor="visit-detail">وش تحتاج مساعدة فيه؟</label>
              <input id="visit-detail" className="field" value={needWith} onChange={e => setNeedWith(e.target.value)} maxLength={120} placeholder="مثلاً: مراجعة تصميم تطبيقي" />
            </>
          )}
          {mode === 'help' && (
            <>
              <label className="field-label" htmlFor="visit-detail">وش تقدر تساعد فيه؟</label>
              <input id="visit-detail" className="field" value={helpWith} onChange={e => setHelpWith(e.target.value)} maxLength={120} placeholder="مثلاً: مراجعة كود React" />
            </>
          )}
          <label className="field-label" htmlFor="visit-work">وش بتشتغل عليه هناك؟ <span className="field-optional">اختياري</span></label>
          <input id="visit-work" className="field" value={workOn} onChange={e => setWorkOn(e.target.value)} maxLength={80} placeholder="مثلاً: أبني واجهة تطبيقي الجديد" />
        </>
      )}

      {step === 1 && (
        <>
          <button type="button" className="settings-row plan-switch" onClick={() => setBookTable(!bookTable)} role="switch" aria-checked={bookTable}>
            <span><Armchair /><i><b>احجز لي طاولة</b><small>{place?.name} · {visitWhen(at, now)}</small></i></span>
            <em className={bookTable ? 'on' : ''} />
          </button>
          {bookTable && (
            <>
              <label className="field-label">كم شخص؟</label>
              <div className="chip-row">{[1, 2, 3, 4].map(n => <Chip key={n} active={party === n} onClick={() => setParty(n)}>{partyLabel(n)}</Chip>)}</div>
              <label className="field-label">وين تحب تجلس؟</label>
              <div className="chip-row">{seatOptions(place).map(s => <Chip key={s} active={seat === s} onClick={() => setSeat(s)}>{s}</Chip>)}</div>
              <p className="plan-note"><ShieldCheck />{existing?.table ? `طاولتك محجوزة، ونمسكها لك ${HOLD_LABEL} من موعدك.` : `رسوم الحجز ${sar(TABLE_FEE)} تدفعها مع طلبك، ونمسك طاولتك ${HOLD_LABEL} كاملة من موعدك. المبالغ المدفوعة ما تُسترجع عند الإلغاء.`}</p>
            </>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <div className="service-segmented-tabs menu-tabs" role="tablist">
            {MENU_CATS.map(c => <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} className={`service-tab-btn ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>{c.label}</button>)}
          </div>
          <ul className="menu-list">
            {MENU.filter(m => m.cat === cat).map(m => (
              <li key={m.id} className={qty(m.id) ? 'in-cart' : ''}>
                <span className="menu-icon">{m.icon}</span>
                <span className="menu-copy"><b>{m.name}</b><small>{m.desc}</small><em>{sar(m.price)}</em></span>
                <Stepper qty={qty(m.id)} onChange={n => setQty(m.id, n)} label={m.name} />
              </li>
            ))}
          </ul>
          {items > 0 && (
            <>
              <label className="field-label" htmlFor="order-note">ملاحظة للكافيه <span className="field-optional">اختياري</span></label>
              <input id="order-note" className="field" value={note} onChange={e => setNote(e.target.value)} maxLength={80} placeholder="مثلاً: حليب شوفان، بدون سكر" />
            </>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <div className="checkout-card">
            <div className="checkout-place">
              <CafeThumb cafe={place} />
              <span><b>{cafe}</b><small>{visitWhen(at, now)}</small></span>
              {!existing && <button type="button" className="text-button" onClick={() => setStep(0)}>تعديل</button>}
            </div>
            {!going && <div className="checkout-row"><Armchair /><span>{bookTable ? tableLabel({ party, seat }) : 'بدون حجز طاولة'}{fee > 0 && <small>{`نمسكها لك ${HOLD_LABEL} من موعدك`}</small>}</span>{fee > 0 && <b className="checkout-fee">{sar(fee)}</b>}{!existing && <button type="button" className="text-button" onClick={() => setStep(1)}>تعديل</button>}</div>}
            {items > 0 ? (
              <>
                <ul className="checkout-lines">
                  {lines.map(l => { const m = menuItem(l.id)!; return <li key={l.id}><span>{l.qty}× {m.name}</span><b>{sar(m.price * l.qty)}</b></li> })}
                </ul>
                {note.trim() && <p className="checkout-note">ملاحظتك: {note.trim()}</p>}
                </>
            ) : (
              <div className="checkout-row"><Receipt /><span>بدون طلب مسبق</span><button type="button" className="text-button" onClick={() => setStep(2)}>أضف طلب</button></div>
            )}
            {due > 0 && <div className="checkout-total"><span>الإجمالي<small>شامل الضريبة</small></span><b>{sar(due)}</b></div>}
          </div>
        </>
      )}

      <div className="sheet-footer">
        {step === 0 && <PrimaryButton onClick={() => visitReady && setStep(nextStep(1))} disabled={!visitReady}>التالي</PrimaryButton>}
        {step === 1 && <PrimaryButton onClick={() => setStep(2)}>التالي</PrimaryButton>}
        {step === 2 && <PrimaryButton onClick={() => setStep(3)} icon={items ? <Receipt /> : undefined}>{items ? `راجع الطلب · ${itemsLabel(items)} · ${sar(total)}` : 'تابع بدون طلب'}</PrimaryButton>}
        {step === 3 && (due > 0
          ? <div className="wallet-buttons">{wallets.map(w => <button key={w} type="button" className={`wallet-button ${w}`} onClick={() => setPaying(w)}><WalletMark kind={w} /></button>)}</div>
          : <PrimaryButton onClick={() => finish()} icon={going ? <Navigation /> : <CalendarClock />}>{going ? 'تمام، أنا في الطريق' : 'ثبّت الزيارة'}</PrimaryButton>)}
      </div>
      {paying && <WalletPay wallet={paying} total={due} merchant={cafe} onCancel={() => setPaying(null)} onPaid={() => finish(paying)} />}
    </BottomSheet>
  )
}

// Everything about one visit in one place: order number, table, what was paid, and cancelling.
function VisitSheet({ visit: v, now, close, onCafe, onCancel, onOrder, onChat }: { visit: Visit; now: number; close: () => void; onCafe: () => void; onCancel: () => void; onOrder: () => void; onChat: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const c = allCafes.find(x => x.name === v.cafe)
  const started = v.at <= now
  return (
    <BottomSheet onClose={close} tall>
      <div className="visit-hero">
        <CafeThumb cafe={c} />
        <div><small>{v.going ? <Navigation /> : <CalendarClock />} {started ? 'زيارتك الحين' : v.going ? 'في طريقك' : 'زيارتك القادمة'}</small><h2>{v.cafe}</h2><p>{visitWhen(v.at, now)}{started ? '' : ` · ${v.going ? 'توصل' : 'تبدأ'} بعد ${timeLeft(v.at, now)}`}</p></div>
      </div>
      {v.order && (
        <div className="order-code">
          <small>رقم طلبك</small><b dir="ltr">#{v.order.code}</b>
          <span>{started ? 'وريه الكاشير أو قول اسمك، طلبك جاهز ومدفوع' : 'يجهز وقت وصولك، وما تدفع شي هناك'}</span>
        </div>
      )}
      <ul className="visit-facts">
        {v.going && !v.table ? null : v.table ? <li><Armchair /><span><b>{tableLabel(v.table)}</b><small>{`نمسكها لك ${HOLD_LABEL} من موعدك`}</small></span></li> : <li><Armchair /><span><b>بدون حجز طاولة</b></span></li>}
        {visitPurpose(v) && <li>{v.mode === 'seek' ? <Search /> : <HeartHandshake />}<span><b>{visitPurpose(v)}</b>{v.workOn && <small>بشتغل على: {v.workOn}</small>}</span></li>}
      </ul>
      {v.order ? (
        <div className="checkout-card">
          <ul className="checkout-lines">
            {v.order.lines.map(l => { const m = menuItem(l.id); return m ? <li key={l.id}><span>{l.qty}× {m.name}</span><b>{sar(m.price * l.qty)}</b></li> : null })}
            {v.table?.fee ? <li><span>رسوم حجز الطاولة</span><b>{sar(v.table.fee)}</b></li> : null}
          </ul>
          {v.order.note && <p className="checkout-note">ملاحظتك: {v.order.note}</p>}
          <div className="checkout-total"><span>مدفوع<small>{WALLET_NAME[v.order.wallet]} · شامل الضريبة</small></span><b>{sar(visitPaid(v))}</b></div>
        </div>
      ) : null}
      {!v.order && !!v.table?.fee && v.table.wallet && <div className="checkout-card"><div className="checkout-total"><span>رسوم الحجز مدفوعة<small>{WALLET_NAME[v.table.wallet]} · شامل الضريبة</small></span><b>{sar(v.table.fee)}</b></div></div>}
      {!v.order && !started && <button type="button" className="secondary-button" onClick={onOrder}><Receipt />{v.table || v.going ? 'اطلب قبل توصل' : 'احجز طاولة أو اطلب قبل توصل'}</button>}
      {(v.table || v.order) && (() => { const t = cafeThread(v, now), last = t[t.length - 1], n = cafeUnread(v, now); return (
        <button type="button" className="cafe-thread-link" onClick={onChat}>
          <MessageCircle /><span><b>رسائل الكافيه</b><small>{last.text}</small></span>{n > 0 && <i aria-label="رسائل جديدة">{n}</i>}<ChevronLeft />
        </button>) })()}
      <div className="visit-actions">
        <button type="button" className="secondary-button" onClick={onCafe}><Store />صفحة الكافيه</button>
        <a className="secondary-button" href={calendarHref(v)} download="aroundme-visit.ics"><CalendarPlus />أضف للتقويم</a>
      </div>
      {!confirming
        ? <button type="button" className="text-button danger visit-cancel-link" onClick={() => setConfirming(true)}>ألغِ الزيارة</button>
        : (
          <div className="cancel-confirm" role="alert">
            <p>{refundNote(v)}</p>
            <div><button type="button" className="secondary-button" onClick={() => setConfirming(false)}>لا، خلها</button><button type="button" className="danger-button" onClick={onCancel}>نعم، ألغِ</button></div>
          </div>
        )}
    </BottomSheet>
  )
}

function ProfileSetupSheet({ close, next, editing = false, name, setName, job, setJob, gender, setGender, pref, setPref, privateMode, setPrivateMode }: {
  pref: MeetPref;
  setPref: (p: MeetPref) => void;
  close: () => void;
  next: () => void;
  editing?: boolean;
  name: string;
  setName: (v: string) => void;
  job: string;
  setJob: (v: string) => void;
  gender: Gender;
  setGender: (v: Gender) => void;
  privateMode: boolean;
  setPrivateMode: (v: boolean) => void;
}) {
  const demoText = useDemoText()
  return (
    <BottomSheet onClose={close} tall>
      <div className="sheet-title">
        <span className="sheet-icon"><CircleUserRound /></span>
        <div>
          <h2>{editing ? 'تعديل الملف الشخصي' : 'عرّفنا عليك'}</h2>
          <p>{editing ? 'اسمك ووظيفتك يظهرون للي توافق تتواصل معهم' : 'مرة وحدة بس، عشان يكون اللقاء واضح وآمن للطرفين'}</p>
        </div>
      </div>
      <label className="photo-picker">
        <Avatar src={images.samer} size={86} name={name} online={false} />
        <span><Camera /> غيّر الصورة</span>
      </label>
      <label className="field-label" htmlFor="me-name">وش اسمك؟</label>
      <input id="me-name" className="field" value={demoText(name)} onChange={e => setName(e.target.value)} />
      <label className="field-label" htmlFor="me-job">وش تشتغل؟</label>
      <input id="me-job" className="field" value={demoText(job)} onChange={e => setJob(e.target.value)} placeholder="مثلاً: مطور واجهات أمامية · الرياض" />
      <label className="field-label">أنت</label>
      <div className="chip-row"><Chip active={gender === 'm'} onClick={() => setGender('m')}>رجل</Chip><Chip active={gender === 'f'} onClick={() => setGender('f')}>امرأة</Chip></div>
      <label className="field-label">تفضّل تتواصل مع</label>
      <div className="chip-row"><Chip active={pref === 'all'} onClick={() => setPref('all')}>الكل</Chip><Chip active={pref === 'same'} onClick={() => setPref('same')}>نفس الجنس فقط</Chip></div>
      <button className="settings-row sheet-toggle" onClick={() => setPrivateMode(!privateMode)} role="switch" aria-checked={privateMode}>
        <span><ShieldCheck /><i><b>إخفاء هويتي قبل الموافقة</b><small>ما يظهر اسمك أو صورتك إلا بعد موافقة الطرفين</small></i></span>
        <em className={privateMode ? 'on' : ''} />
      </button>
      <PrimaryButton onClick={next} disabled={name.trim().length < 2}>{editing ? 'حفظ التعديلات' : 'التالي'}</PrimaryButton>
    </BottomSheet>
  )
}

function SkillsSheet({ close, initial, save }: { close: () => void; initial: string[]; save: (skills: string[]) => void }) {
  const [skills, setSkills] = useState(initial)
  const [query, setQuery] = useState('')
  const options = Array.from(new Set([...initial, 'React Native', 'تطوير واجهات', 'تصميم', 'تسويق', 'Excel', 'ذكاء اصطناعي'])).filter(x => !query.trim() || x.includes(query.trim()))
  const custom = query.trim().replace(/\s+/g, ' ')
  const canAdd = custom.length >= 2 && !skills.some(s => s.toLowerCase() === custom.toLowerCase()) && skills.length < BUSINESS.MAX_SKILLS_PER_USER
  const addCustom = () => {
    if (!canAdd) return
    setSkills([...skills, custom])
    setQuery('')
  }
  const toggle = (skill: string) => {
    if (skills.includes(skill)) setSkills(skills.filter(s => s !== skill))
    else if (skills.length < BUSINESS.MAX_SKILLS_PER_USER) setSkills([...skills, skill])
  }
  return (
    <BottomSheet onClose={close}>
      <div className="sheet-title">
        <span className="sheet-icon"><Sparkles /></span>
        <div><h2>وش تقدر تساعد فيه؟</h2><p>اختر مهارة وحدة على الأقل</p></div>
      </div>
      <div className="search-field">
        <Search />
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} placeholder="ابحث أو اكتب مهارة" aria-label="ابحث أو اكتب مهارة" />
      </div>
      {canAdd && <button type="button" className="custom-skill-suggestion" onClick={addCustom}><span>إضافة «{custom}»</span><Check /></button>}
      <div className="skill-grid">
        {options.map(x => (
          <Chip key={x} active={skills.includes(x)} onClick={() => toggle(x)}>
            {skills.includes(x) && <Check />}{x}
          </Chip>
        ))}
      </div>
      <p className="skill-entry-hint">{`${skills.length} من ${BUSINESS.MAX_SKILLS_PER_USER} مهارات`}</p>
      <PrimaryButton onClick={() => save(skills)} disabled={!skills.length}>حفظ ومتابعة</PrimaryButton>
    </BottomSheet>
  )
}

// One consent step for both ways of reaching someone: ask for help, or offer it.
function RequestSheet({ target, privateMode, close, send }: { target: Target; privateMode: boolean; close: () => void; send: (minutes: number, text: string) => void }) {
  const { language } = useLanguage()
  const [commit, setCommit] = useState(target.kind === 'offer' ? target.need.minutes : 15)
  const [text, setText] = useState(target.kind === 'ask' ? target.need : '')
  const person = target.kind === 'ask' ? target.person : null
  const who = person ? gx(person, 'بيشوف', 'بتشوف') : 'بيشوف'
  return (
    <BottomSheet onClose={close}>
      <div className="request-person">
        {person ? <Avatar src={person.image} size={78} name={person.name} online={person.presence === 'now'} /> : <span className="anonymous-avatar big"><UserRound /></span>}
        <h2>{person ? `تطلب مساعدة ${first(language === 'en' ? toEnglish(person.name) : person.name)}؟` : 'تعرض مساعدتك؟'}</h2>
        <p>{privateMode ? `${who} طلبك بدون اسمك وصورتك، ويظهرون بعد الموافقة` : `${who} اسمك وصورتك مع الطلب`}</p>
      </div>
      {target.kind === 'offer' ? (
        <div className="summary-box"><small>الاحتياج · {target.need.topic}</small><p>{target.need.text}</p></div>
      ) : (
        <>
          <label className="field-label" htmlFor="req-text">وش تحتاج بالضبط؟</label>
          <textarea id="req-text" className="help-typein-field" rows={3} value={text} onChange={e => setText(e.target.value)} maxLength={BUSINESS.MAX_NEED_TEXT_CHARS} />
        </>
      )}
      <label className="field-label">{person ? `كم تحتاج من ${gx(person, 'وقته', 'وقتها')} تقريبًا؟` : 'كم تقدر تعطي من وقتك؟'}</label>
      <div className="chip-row duration-row">{DURATIONS.map(v => <Chip key={v} active={commit === v} onClick={() => setCommit(v)}>{mins(v)}</Chip>)}</div>
      <PrimaryButton onClick={() => send(commit, text.trim())} icon={<Send />} disabled={target.kind === 'ask' && text.trim().length < 3}>{person ? 'أرسل الطلب' : 'أرسل العرض'}</PrimaryButton>
    </BottomSheet>
  )
}

function PendingSheet({ kind, name, image, declined, close, cancel, retry }: {
  kind: Target['kind'];
  name: string;
  image: string;
  declined: boolean;
  close: () => void;
  cancel: () => void;
  retry: () => void;
}) {
  const noun = kind === 'ask' ? 'طلبك' : 'عرضك'
  const to = kind === 'offer' ? 'إلى صاحب الاحتياج' : `إلى ${name}`
  if (declined) {
    return (
      <BottomSheet onClose={close}>
        <div className="success-symbol muted"><Clock3 /></div>
        <h2 className="center">{kind === 'offer' ? 'صاحب الاحتياج' : name} {COPY.declined}</h2>
        <p className="center muted">ما تيسّر هالمرة. فيه أشخاص ثانيين حولك.</p>
        <PrimaryButton onClick={retry}>شوف غيره حولك</PrimaryButton>
        <button className="text-button" onClick={close}>تمام</button>
      </BottomSheet>
    )
  }
  return (
    <BottomSheet onClose={close}>
      <div className="success-symbol"><Send /></div>
      <h2 className="center">أرسلنا {noun} {to}</h2>
      <p className="center muted">نبلغك أول ما يرد. المحادثة تنفتح بس إذا وافق.</p>
      <div className="pending-card">
        {kind === 'offer' ? <AnonAvatar size={48} /> : <Avatar src={image} size={48} name={name} online={false} />}
        <div><b>{COPY.pending}</b><small><Clock3 /> ينتهي خلال 7 دقائق</small></div>
        <span className="typing"><i /><i /><i /></span>
      </div>
      <PrimaryButton onClick={close}>تمام</PrimaryButton>
      <button className="text-button danger" onClick={cancel}>{kind === 'ask' ? 'إلغاء الطلب' : 'إلغاء العرض'}</button>
    </BottomSheet>
  )
}

function MatchSheet({ c, myName, chat, later }: { c: Connection; myName: string; chat: () => void; later: () => void }) {
  return (
    <div className="match-overlay" role="dialog" aria-modal="true">
      <div className="confetti">✦ · ✧ · ✦</div>
      <div className="match-avatars">
        <Avatar src={images.samer} size={115} name={myName} online={false} />
        <span><Handshake /></span>
        <Avatar src={c.image} size={115} name={c.name} online={false} />
      </div>
      <h1>اتفقت مع {first(c.name)} 🤝</h1>
      <p>الحين تقدرون تتواصلون وتنسقون اللقاء في {c.cafe}.</p>
      <PrimaryButton onClick={chat} icon={<MessageCircle />}>{COPY.openChat}</PrimaryButton>
      <button className="text-button" onClick={later}>بعدين</button>
    </div>
  )
}

function ChatMenuSheet({ name, close, end, report, block }: { name: string; close: () => void; end: () => void; report: () => void; block: () => void }) {
  return (
    <BottomSheet onClose={close}>
      <h2 className="center">خيارات</h2>
      <div className="menu-list">
        <button onClick={end}><XCircle /> أنهِ المحادثة</button>
        <button onClick={report}><Flag /> بلّغ عن مشكلة</button>
        <button className="danger" onClick={block}><Ban /> احظر {first(name)}</button>
      </div>
    </BottomSheet>
  )
}

function ReportSheet({ name, close, send }: { name: string; close: () => void; send: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <BottomSheet onClose={close}>
      <h2 className="center">بلّغ عن {first(name)}</h2>
      <p className="center muted">بلاغك سري، وما نقول له مين بلّغ.</p>
      <div className="skill-grid">
        {['تصرف غير لائق', 'حساب مزيّف', 'رسائل مزعجة', 'شي ثاني'].map(r => <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}
      </div>
      <PrimaryButton onClick={send} disabled={!reason}>أرسل البلاغ</PrimaryButton>
    </BottomSheet>
  )
}

const replyTo = (text: string, seat: string) =>
  text.includes('وين') ? `أنا ${seat}` : text.includes('بتأخر') ? 'ولا يهمك، أنتظرك' : text.includes('جاي') ? 'تمام، أنتظرك' : 'تمام 👍'

const load = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
const store = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ } }

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const requested = new URLSearchParams(window.location.search).get('lang')
    return requested === 'en' || requested === 'ar' ? requested : load('around-language', 'ar')
  })
  const toggleLanguage = () => setLanguage(current => {
    const next = current === 'ar' ? 'en' : 'ar'
    store('around-language', next)
    return next
  })
  // A real back stack, so "رجوع" always returns to where you came from.
  const [stack, setStack] = useState<Screen[]>(() => [load('around-onboarded', 0) ? 'home' : 'onboarding'])
  const screen = stack[stack.length - 1]
  const go = (s: Screen) => setStack(st => (st[st.length - 1] === s ? st : [...st, s]))
  const back = () => setStack(st => (st.length > 1 ? st.slice(0, -1) : ['home']))
  const reset = (s: Screen) => setStack([s])

  const [sheet, setSheet] = useState<Sheet>(null)
  const [profileReady, setProfileReady] = useState(false)
  const [myName, setMyName] = useState(DEMO_NAME)
  const [myJob, setMyJob] = useState(DEMO_JOB)
  const [myGender, setMyGender] = useState<Gender>('m')
  const [meetPref, setMeetPref] = useState<MeetPref>('all')
  const [loc, setLocRaw] = useState<Loc>(() => load('around-loc', DEFAULT_LOC))
  const [mySkills, setMySkillsRaw] = useState<string[]>(() => load('around-skills', ['React Native', 'تطوير واجهات', 'TypeScript']))
  const [myGoals, setMyGoals] = useState<string[]>(() => load('around-goals', ['مراجعة كود', 'استشارة تسويق']))
  const [myNeedDesc, setMyNeedDesc] = useState<string>(() => load('around-need-desc', 'أبني مشروع ناشئ وأحتاج مشورة في معمارية التطبيق وقاعدة البيانات.'))
  const [isAvailableForHelp, setIsAvailableForHelp] = useState(true)
  const [instantMatchNotify, setInstantMatchNotify] = useState(true)
  const [preferredDuration, setPreferredDuration] = useState(15)
  const [privateMode, setPrivateMode] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [actionMode, setActionMode] = useState<ActionMode>('seek')
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('all')
  const [previewPerson, setPreviewPerson] = useState<Person | null>(null)
  const [needText, setNeedText] = useState('')
  const [selectedCafe, setSelectedCafe] = useState(allCafes[0].name)
  const [savedCafes, setSavedCafes] = useState<string[]>(() => load('around-saved', []))
  const [visits, setVisits] = useState<Visit[]>(() => load('around-visits', []))
  const [visitCafe, setVisitCafe] = useState(allCafes[0].name)
  const [openVisitId, setOpenVisitId] = useState<string | null>(null)
  const [orderFor, setOrderFor] = useState<string | null>(null)
  const [wallet, setWalletRaw] = useState<WalletKind>(() => load('around-wallet', deviceWallet()))
  const setWallet = (w: WalletKind) => { setWalletRaw(w); store('around-wallet', w); say(`${WALLET_NAME[w]} صارت طريقة الدفع المفضلة`) }
  const [target, setTarget] = useState<Target | null>(null)
  const [requests, setRequests] = useState<Record<string, 'pending' | 'declined'>>({})
  const [pending, setPending] = useState<{ id: string; kind: Target['kind'] } | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [isWideMode, setIsWideMode] = useState(false)
  const [locationFromOnboarding, setLocationFromOnboarding] = useState(false)
  const cancelled = useRef(new Set<string>())
  const seats = useRef<Record<string, string>>({})
  const chatIdRef = useRef<string | null>(null)
  chatIdRef.current = screen === 'chat' ? chatId : null

  const setMySkills = (s: string[]) => { setMySkillsRaw(s); store('around-skills', s) }
  const setLoc = (l: Loc) => { setLocRaw(l); store('around-loc', l); setSheet(null); say(l.city === LIVE_CITY ? `نعرض لك الأقرب من ${locLabel(l)}` : `اخترت ${l.city}`) }
  const clockNow = useNow(15000)
  const data = buildData(loc, myGender, meetPref, clockNow)
  const cafeVisits = visits.filter(v => (v.table || v.order) && v.at + VISIT_GRACE > clockNow).sort((a, b) => a.at - b.at)
  const unread = connections.reduce((n, c) => n + c.unread, 0) + cafeVisits.reduce((n, v) => n + cafeUnread(v, clockNow), 0)
  const active = connections.find(c => c.status === 'active')
  const chat = connections.find(c => c.id === chatId)
  const say = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast(t => (t === text ? '' : t)), 3000)
  }

  // ---------- Navigation ----------
  const onTab = (t: Tab) => {
    setPreviewPerson(null)
    reset(t)
  }
  const openCafe = (cafe: string) => {
    setPreviewPerson(null)
    setSelectedCafe(cafe)
    go('cafe')
  }
  const openChat = (id: string) => {
    setPreviewPerson(null)
    setChatId(id)
    setConnections(cs => cs.map(c => (c.id === id ? { ...c, unread: 0 } : c)))
    go('chat')
  }
  const activeWith = (personId: string) => connections.find(c => c.personId === personId && c.status === 'active')
  const openChatFor = (personId: string) => { const c = activeWith(personId); if (c) openChat(c.id) }

  // ---------- Requests: one consent pipeline for ask / offer ----------
  const requestState = (personId: string): RequestState => (activeWith(personId) ? 'connected' : requests[personId] ?? null)
  const updateConn = (id: string, fn: (c: Connection) => Connection) => setConnections(cs => cs.map(c => (c.id === id ? fn(c) : c)))

  const startTarget = (t: Target) => {
    const id = targetId(t)
    setPreviewPerson(null)
    const st = requestState(id)
    if (st === 'connected') return openChatFor(id)
    if (st) { setPending({ id, kind: t.kind }); setSheet('pending'); return }
    setTarget(t)
    setSheet(profileReady ? 'request' : 'profileSetup')
  }

  const h: CardHandlers = {
    stateOf: requestState,
    onOpenPerson: p => setPreviewPerson(p),
    onAsk: p => startTarget({ kind: 'ask', person: p, need: needText || myNeedDesc }),
    onOffer: n => startTarget({ kind: 'offer', need: n }),
    onOpenChat: openChatFor,
  }

  const connect = (a: { personId: string; name: string; image: string; cafe: string; topic: string; minutes: number; seat: string; mine?: string; reply: string }) => {
    const id = `${a.personId}-${Date.now()}`
    const messages: Message[] = [{ from: 'system', text: `اتفقتوا 🤝 · ${a.cafe} · ${a.topic}`, time: now() }]
    if (a.mine) messages.push({ from: 'me', text: a.mine, time: now() })
    setConnections(cs => [{ id, personId: a.personId, name: a.name, image: a.image, cafe: a.cafe, topic: a.topic, minutes: a.minutes, status: 'active', unread: 0, askMet: false, messages }, ...cs])
    seats.current[id] = a.seat
    setMatchId(id)
    setSheet('match')
    window.setTimeout(() => {
      updateConn(id, c => ({ ...c, unread: c.id === chatIdRef.current ? 0 : c.unread + 1, messages: [...c.messages, { from: 'them', text: a.reply, time: now() }] }))
    }, 1500)
    window.setTimeout(() => updateConn(id, c => (c.status === 'active' ? { ...c, askMet: true } : c)), a.minutes * DEMO_MS_PER_MINUTE)
  }

  const sendRequest = (minutes: number, text: string) => {
    if (!target) return
    const t = target
    const id = targetId(t)
    cancelled.current.delete(id)
    setRequests(r => ({ ...r, [id]: 'pending' }))
    setPending({ id, kind: t.kind })
    setSheet('pending')
    window.setTimeout(() => {
      if (cancelled.current.has(id)) { cancelled.current.delete(id); return }
      if (t.kind === 'ask' && t.person.busy) {
        setRequests(r => ({ ...r, [id]: 'declined' }))
        say(`${first(t.person.name)} ${COPY.declined}`)
        return
      }
      setRequests(r => { const { [id]: _, ...rest } = r; return rest })
      setPending(p => (p?.id === id ? null : p))
      if (t.kind === 'offer') {
        const n = t.need
        connect({ personId: id, name: n.name, image: n.image, cafe: n.cafe, topic: n.topic, minutes, seat: n.seat, mine: `هلا، أقدر أساعدك في ${n.topic}`, reply: `هلا، شكرًا إنك وافقت تساعدني! أنا ${n.seat}` })
      } else {
        const p = t.person
        const where = p.presence === 'now' ? `أنا ${p.seat}` : `أوصل ${p.time} وأكون ${p.seat}`
        connect({ personId: id, name: p.name, image: p.image, cafe: p.cafe, minutes, seat: p.seat, topic: p.tag, mine: text.split(/\s+/).length <= 2 ? `أحتاج مساعدة في ${text}` : text, reply: `هلا! ${where}. تعال متى ما جهزت 👋` })
      }
    }, 3500)
  }

  const afterProfile = () => {
    setProfileReady(true)
    if (target?.kind === 'offer') return setSheet('skills')
    if (target) return setSheet('request')
    setSheet(null)
  }

  const answerMet = (id: string, met: boolean) => {
    if (met) {
      updateConn(id, c => ({ ...c, askMet: false, status: 'past', endedMet: true, messages: [...c.messages, { from: 'system', text: 'تقابلتوا. نتمنى إنه كان لقاء مفيد', time: now() }] }))
      say('نتمنى إنه كان لقاء مفيد')
    } else {
      updateConn(id, c => ({ ...c, askMet: false, messages: [...c.messages, { from: 'system', text: 'ما تقابلتوا بعد. كمّلوا التنسيق هنا', time: now() }] }))
    }
  }

  const sendMessage = (text: string) => {
    if (!chat) return
    const id = chat.id
    updateConn(id, c => ({ ...c, messages: [...c.messages, { from: 'me', text, time: now() }] }))
    window.setTimeout(() => {
      updateConn(id, c => c.status === 'active'
        ? { ...c, unread: chatIdRef.current === id ? 0 : c.unread + 1, messages: [...c.messages, { from: 'them', text: replyTo(text, seats.current[id] || 'عند النافذة'), time: now() }] }
        : c)
    }, 1600)
  }

  const endChat = (blocked: boolean) => {
    if (!chat) return
    updateConn(chat.id, c => ({ ...c, askMet: false, status: 'past', messages: [...c.messages, { from: 'system', text: blocked ? 'حظرت هذا الشخص' : 'أنهيت المحادثة', time: now() }] }))
    setSheet(null)
    if (blocked) { say(`حظرت ${first(chat.name)}`); back() }
  }

  const saveMatchProfile = (data: { skills: string[]; goals: string[]; needDesc: string; availableForHelp: boolean; instantMatchNotify: boolean; preferredDuration: number }) => {
    setMySkills(data.skills)
    setMyGoals(data.goals); store('around-goals', data.goals)
    setMyNeedDesc(data.needDesc); store('around-need-desc', data.needDesc)
    setIsAvailableForHelp(data.availableForHelp)
    setInstantMatchNotify(data.instantMatchNotify)
    setPreferredDuration(data.preferredDuration)
    say('حفظنا مهاراتك واحتياجاتك')
    back()
  }

  const toggleSave = (name: string) => {
    const next = savedCafes.includes(name) ? savedCafes.filter(n => n !== name) : [...savedCafes, name]
    setSavedCafes(next); store('around-saved', next)
    say(next.includes(name) ? 'حفظنا الكافيه في حسابك' : 'شلنا الكافيه من المحفوظة')
  }

  const upcomingVisits = visits.filter(v => v.at + VISIT_GRACE > clockNow).sort((a, b) => a.at - b.at)
  const [goingNow, setGoingNow] = useState(false)
  const planVisit = (cafe: string, going = false) => { setVisitCafe(cafe); setOrderFor(null); setGoingNow(going); setSheet('planVisit') }
  // The café picked in "أنا في الكوفي الحين"; the intent screen then shows who's there.
  const [hereCafe, setHereCafe] = useState<string | null>(null)
  const openVisit = (id: string) => { setOpenVisitId(id); setSheet('visit') }
  // The sheet stays open on its confirmation step, so saving doesn't close it.
  const saveVisit = ({ cafe, at, ...details }: Omit<Visit, 'id'>): Visit => {
    const v: Visit = { ...details, id: `${cafe}-${at}`, cafe, at }
    setVisits(vs => { const next = [...vs.filter(x => x.id !== v.id), v]; store('around-visits', next); return next })
    return v
  }
  const updateVisit = (id: string, fn: (v: Visit) => Visit) => setVisits(vs => { const next = vs.map(v => (v.id === id ? fn(v) : v)); store('around-visits', next); return next })
  const [cafeChatId, setCafeChatId] = useState<string | null>(null)
  const cafeChat = visits.find(v => v.id === cafeChatId)
  const openCafeChat = (id: string) => { setSheet(null); setCafeChatId(id); updateVisit(id, v => ({ ...v, chatSeen: Date.now() })); go('cafeChat') }
  // While the thread is open, everything in it counts as read.
  useEffect(() => { if (screen === 'cafeChat' && cafeChat && cafeUnread(cafeChat, clockNow)) updateVisit(cafeChat.id, v => ({ ...v, chatSeen: Date.now() })) }, [screen, cafeChat, clockNow])
  const sendCafe = (id: string, text: string) => {
    updateVisit(id, v => ({ ...v, chat: [...(v.chat ?? []), { from: 'me', text, at: Date.now() }], chatSeen: Date.now() }))
    window.setTimeout(() => updateVisit(id, v => ({ ...v, chat: [...(v.chat ?? []), { from: 'them', text: CAFE_REPLY, at: Date.now() }] })), 1500)
  }
  const cancelVisit = (id: string) => {
    const v = visits.find(x => x.id === id)
    const next = visits.filter(x => x.id !== id)
    setVisits(next); store('around-visits', next)
    setSheet(null)
    say(v && visitPaid(v) ? 'ألغينا الزيارة، والمبلغ المدفوع ما يُسترجع' : 'ألغينا الزيارة')
  }
  const visitOpen = visits.find(v => v.id === openVisitId)
  const orderVisit = visits.find(v => v.id === orderFor)

  const logout = () => {
    try { localStorage.clear() } catch { /* storage unavailable */ }
    setProfileReady(false)
    setConnections([])
    setRequests({})
    setPending(null)
    setSavedCafes([])
    setVisits([])
    setLocRaw(DEFAULT_LOC)
    setSheet(null)
    setPreviewPerson(null)
    reset('onboarding')
  }

  const completeLocation = (to: Screen) => { store('around-onboarded', 1); reset(to) }

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [screen])

  const pendingPerson = pending ? allPeople.find(p => p.id === pending.id) : undefined
  const match = connections.find(c => c.id === matchId)
  const profileSheetProps = { name: myName, setName: setMyName, job: myJob, setJob: setMyJob, gender: myGender, setGender: setMyGender, pref: meetPref, setPref: setMeetPref, privateMode, setPrivateMode }
  const openLocation = () => {
    setLocationFromOnboarding(false)
    setSheet('location')
  }
  const openOnboardingLocation = () => {
    setLocationFromOnboarding(true)
    setSheet('location')
  }
  const saveLocation = (nextLoc: Loc) => {
    setLoc(nextLoc)
    if (locationFromOnboarding) {
      setLocationFromOnboarding(false)
      completeLocation('home')
    }
  }

  return (
    <LanguageCtx.Provider value={{ language, toggleLanguage }}>
    <DataCtx.Provider value={data}>
    <div className="app-shell" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <LanguageBridge language={language} />
      <div className="device-mode-switch" aria-label="وضع العرض">
        <button className={!isWideMode ? 'active' : ''} onClick={() => setIsWideMode(false)}><Smartphone /><span>محاكي الجوال</span></button>
        <button className={isWideMode ? 'active' : ''} onClick={() => setIsWideMode(true)}><Monitor /><span>العرض الموسع</span></button>
      </div>

      <div className={`screen-wrapper ${isWideMode ? 'is-wide' : ''}`}>
        {screen === 'onboarding' && <Onboarding next={() => go('phone')} />}
        {screen === 'phone' && <PhoneScreen next={() => go('otp')} back={back} />}
        {screen === 'otp' && <OtpScreen next={() => go('location')} back={back} />}
        {screen === 'location' && <LocationScreen next={() => completeLocation('home')} manual={openOnboardingLocation} back={back} />}
        {screen === 'home' && (
          <HomeScreen
            onTab={onTab}
            unread={unread}
            onHereNow={() => setSheet('hereNow')}
            onGoing={() => planVisit(data.cafes[0]?.name ?? selectedCafe, true)}
            active={active}
            onChat={() => active && openChat(active.id)}
            onMet={met => active && answerMet(active.id, met)}
            onLocation={openLocation}
            visit={upcomingVisits[0]}
            now={clockNow}
            onPlanVisit={() => planVisit(selectedCafe)}
            onOpenVisit={openVisit}
          />
        )}
        {screen === 'intent' && (
          <IntentScreen
            mode={actionMode}
            cafe={hereCafe ?? undefined}
            back={back}
            mySkills={mySkills}
            privateMode={privateMode}
            onContinue={(text, skills) => {
              if (actionMode === 'seek') setNeedText(text || skills.join('، '))
              else setMySkills(skills)
              if (hereCafe) { setSelectedCafe(hereCafe); setStack(['home', 'cafe']) } else onTab('people')
            }}
          />
        )}
        {screen === 'map' && (
          <MapScreen
            onTab={onTab}
            unread={unread}
            onCafe={openCafe}
            actionMode={actionMode}
            onActionModeChange={setActionMode}
            context={actionMode === 'seek' ? (needText ? `الأنسب لـ: ${needText}` : '') : `حسب مهاراتك: ${mySkills.slice(0, 2).join('، ')}`}
            onLocation={openLocation}
          />
        )}
        {screen === 'cafe' && (
          <CafeDetailScreen
            cafeName={selectedCafe}
            back={back}
            saved={savedCafes.includes(selectedCafe)}
            onToggleSave={() => toggleSave(selectedCafe)}
            actionMode={actionMode}
            onActionModeChange={setActionMode}
            h={h}
            visit={upcomingVisits.find(v => v.cafe === selectedCafe)}
            onPlan={() => planVisit(selectedCafe)}
            onOpenVisit={openVisit}
            now={clockNow}
          />
        )}
        {screen === 'people' && (
          <PeopleScreen
            onTab={onTab}
            unread={unread}
            h={h}
            actionMode={actionMode}
            onActionModeChange={setActionMode}
            presenceFilter={presenceFilter}
            onPresenceFilterChange={setPresenceFilter}
            onCafe={openCafe}
            onLocation={openLocation}
          />
        )}
        {screen === 'account' && (
          <AccountScreen
            onTab={onTab}
            unread={unread}
            onSettings={() => go('settings')}
            onCafe={openCafe}
            onEdit={() => setSheet('editProfile')}
            onMatchProfile={() => go('matchProfile')}
            name={myName}
            job={myJob}
            skills={mySkills}
            goals={myGoals}
            availableForHelp={isAvailableForHelp}
            savedCafes={savedCafes}
            visits={upcomingVisits}
            now={clockNow}
            onPlanVisit={() => planVisit(selectedCafe)}
            onOpenVisit={openVisit}
          />
        )}
        {screen === 'matchProfile' && (
          <MatchProfileScreen
            back={back}
            initialSkills={mySkills}
            initialGoals={myGoals}
            initialNeedDesc={myNeedDesc}
            initialAvailable={isAvailableForHelp}
            initialNotify={instantMatchNotify}
            initialDuration={preferredDuration}
            onSave={saveMatchProfile}
            onExploreCafes={() => onTab('people')}
            name={myName}
            job={myJob}
          />
        )}
        {screen === 'settings' && (
          <SettingsScreen
            back={back}
            privateMode={privateMode}
            setPrivateMode={setPrivateMode}
            notifications={notifications}
            setNotifications={setNotifications}
            onLogout={logout}
            onLocation={openLocation}
            pref={meetPref}
            setPref={setMeetPref}
            wallet={wallet}
            setWallet={setWallet}
          />
        )}
        {screen === 'inbox' && <InboxScreen onTab={onTab} unread={unread} connections={connections} openChat={openChat} cafeVisits={cafeVisits} now={clockNow} openCafeChat={openCafeChat} />}
        {screen === 'cafeChat' && cafeChat && (
          <CafeChatScreen v={cafeChat} now={clockNow} back={back} send={text => sendCafe(cafeChat.id, text)} onVisit={() => openVisit(cafeChat.id)} />
        )}
        {screen === 'chat' && chat && (
          <ChatScreen c={chat} back={back} send={sendMessage} onMenu={() => setSheet('chatMenu')} onMet={met => answerMet(chat.id, met)} />
        )}
      </div>

      {sheet === 'profileSetup' && (
        <ProfileSetupSheet {...profileSheetProps} close={() => setSheet(null)} next={afterProfile} />
      )}
      {sheet === 'editProfile' && (
        <ProfileSetupSheet {...profileSheetProps} editing close={() => setSheet(null)} next={() => { setSheet(null); say('حفظنا التعديلات') }} />
      )}
      {sheet === 'skills' && (
        <SkillsSheet
          close={() => setSheet(null)}
          initial={mySkills}
          save={skills => { setMySkills(skills); setSheet(target ? 'request' : null) }}
        />
      )}
      {sheet === 'planVisit' && (
        <PlanVisitSheet
          key={orderFor ?? (goingNow ? 'going' : 'new')}
          cafes={data.cafes} initialCafe={visitCafe} now={clockNow} skills={mySkills} need={myNeedDesc} wallet={wallet}
          existing={orderVisit} going={goingNow} close={() => setSheet(null)} save={saveVisit} onOpenVisit={openVisit}
          onSeeCafe={(cafe, mode) => { setSheet(null); if (mode) setActionMode(mode); openCafe(cafe) }}
        />
      )}
      {sheet === 'hereNow' && (
        <HereNowSheet
          cafes={data.cafes} initialCafe={selectedCafe} close={() => setSheet(null)}
          next={(cafe, mode) => { setSheet(null); setHereCafe(cafe); setActionMode(mode); go('intent') }}
        />
      )}
      {sheet === 'visit' && visitOpen && (
        <VisitSheet
          visit={visitOpen} now={clockNow} close={() => setSheet(null)}
          onCafe={() => { setSheet(null); openCafe(visitOpen.cafe) }}
          onCancel={() => cancelVisit(visitOpen.id)}
          onOrder={() => { setOrderFor(visitOpen.id); setSheet('planVisit') }}
          onChat={() => openCafeChat(visitOpen.id)}
        />
      )}
      {sheet === 'request' && target && <RequestSheet target={target} privateMode={privateMode} close={() => setSheet(null)} send={sendRequest} />}
      {sheet === 'pending' && pending && (
        <PendingSheet
          kind={pending.kind}
          name={pendingPerson ? first(pendingPerson.name) : ''}
          image={pendingPerson?.image ?? ''}
          declined={requests[pending.id] === 'declined'}
          close={() => setSheet(null)}
          cancel={() => {
            const noun = pending.kind === 'ask' ? 'الطلب' : 'العرض'
            cancelled.current.add(pending.id)
            setRequests(r => { const { [pending.id]: _, ...rest } = r; return rest })
            setPending(null)
            setSheet(null)
            say(`ألغينا ${noun}`)
          }}
          retry={() => { setSheet(null); onTab('people') }}
        />
      )}
      {sheet === 'match' && match && (
        <MatchSheet c={match} myName={myName} chat={() => { setSheet(null); openChat(match.id) }} later={() => setSheet(null)} />
      )}
      {sheet === 'chatMenu' && chat && (
        <ChatMenuSheet name={chat.name} close={() => setSheet(null)} end={() => endChat(false)} report={() => setSheet('report')} block={() => endChat(true)} />
      )}
      {sheet === 'report' && chat && (
        <ReportSheet name={chat.name} close={() => setSheet(null)} send={() => { setSheet(null); say('وصلنا بلاغك، وبنراجعه بأسرع وقت') }} />
      )}

      {previewPerson && (
        <ProfilePreviewDrawer
          person={previewPerson}
          h={h}
          onClose={() => setPreviewPerson(null)}
          onOpenCafe={openCafe}
        />
      )}

      {sheet === 'location' && (
        <LocationSheet
          current={loc}
          close={() => { setSheet(null); setLocationFromOnboarding(false) }}
          save={saveLocation}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      {screen !== 'onboarding' && DEMO && (
        <button className="demo-reset" title="إعادة التجربة من شاشة البداية" aria-label="إعادة تعيين التجربة" onClick={logout}>
          <Compass />
        </button>
      )}
    </div>
    </DataCtx.Provider>
    </LanguageCtx.Provider>
  )
}
