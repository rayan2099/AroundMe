export type Text = { ar: string; en: string }
export type IconKey = 'coffee' | 'iced' | 'drink' | 'cake' | 'pastry' | 'cookie' | 'sandwich' | 'salad' | 'tea' | 'other'

export type Category = { id: string; name: Text; icon: IconKey }
export type Item = {
  id: string
  cat: string
  name: Text
  desc: Text
  price: number | null
  photo?: string
  soldOut: boolean
  // What the menu reader wasn't sure about. Cleared once the owner checks it.
  flag?: 'price' | 'name'
}

export type Place = { id: string; name: Text; area: Text; rating: number; reviews: number; phone: string; logo?: string }

// Cafés as they come back from Google Places when the owner searches for their own.
export const PLACES: Place[] = [
  { id: 'unwan', name: { ar: 'عنوان القهوة', en: 'Unwan Coffee' }, area: { ar: 'العليا، الرياض', en: 'Olaya, Riyadh' }, rating: 4.7, reviews: 1284, phone: '4421', logo: '/assets/logos/unwan.png' },
  { id: 'javatime', name: { ar: 'جافا تايم', en: 'Java Time' }, area: { ar: 'الملز، الرياض', en: 'Al Malaz, Riyadh' }, rating: 4.4, reviews: 862, phone: '7730', logo: '/assets/logos/javatime.png' },
  { id: 'drcafe', name: { ar: 'د. كيف', en: 'Dr. Cafe' }, area: { ar: 'الياسمين، الرياض', en: 'Al Yasmin, Riyadh' }, rating: 4.3, reviews: 2210, phone: '1185', logo: '/assets/logos/drcafe.png' },
  { id: 'bloom', name: { ar: 'بلوم روستري', en: 'Bloom Roastery' }, area: { ar: 'حطين، الرياض', en: 'Hittin, Riyadh' }, rating: 4.8, reviews: 391, phone: '5062' },
  { id: 'nakhla', name: { ar: 'نخلة كافيه', en: 'Nakhla Cafe' }, area: { ar: 'الورود، الرياض', en: 'Al Wurud, Riyadh' }, rating: 4.5, reviews: 517, phone: '9314' },
]

// Ready-made sections so an owner never starts from a blank page.
export const SUGGESTED: Category[] = [
  { id: 'hot', name: { ar: 'قهوة ساخنة', en: 'Hot coffee' }, icon: 'coffee' },
  { id: 'cold', name: { ar: 'قهوة باردة', en: 'Iced coffee' }, icon: 'iced' },
  { id: 'drinks', name: { ar: 'مشروبات', en: 'Drinks' }, icon: 'drink' },
  { id: 'tea', name: { ar: 'شاي', en: 'Tea' }, icon: 'tea' },
  { id: 'sweets', name: { ar: 'حلا', en: 'Desserts' }, icon: 'cake' },
  { id: 'pastry', name: { ar: 'معجنات', en: 'Pastries' }, icon: 'pastry' },
  { id: 'cookies', name: { ar: 'كوكيز', en: 'Cookies' }, icon: 'cookie' },
  { id: 'sandwich', name: { ar: 'ساندويتشات', en: 'Sandwiches' }, icon: 'sandwich' },
  { id: 'healthy', name: { ar: 'أكل صحي', en: 'Healthy food' }, icon: 'salad' },
]

const cat = (id: string) => SUGGESTED.find(c => c.id === id)!

let seq = 0
const item = (c: string, ar: string, en: string, dar: string, den: string, price: number | null, flag?: Item['flag']): Item =>
  ({ id: `i${++seq}`, cat: c, name: { ar, en }, desc: { ar: dar, en: den }, price, soldOut: false, flag })

// What the menu reader "finds" in a photo of a printed menu. Two lines were hard to read and need the owner's check.
export function scannedMenu(): { cats: Category[]; items: Item[] } {
  return {
    cats: ['hot', 'cold', 'sweets', 'pastry', 'drinks', 'sandwich'].map(cat),
    items: [
      item('hot', 'لاتيه', 'Latte', 'إسبريسو مع حليب مبخر', 'Espresso with steamed milk', 18),
      item('hot', 'سبانش لاتيه', 'Spanish latte', 'لاتيه بالحليب المكثف', 'Latte with condensed milk', 21),
      item('hot', 'فلات وايت', 'Flat white', 'جرعتان من الإسبريسو بطبقة حليب خفيفة', 'Double shot with a thin layer of milk', 19),
      item('hot', 'كورتادو', 'Cortado', 'إسبريسو وحليب بنفس الكمية', 'Equal parts espresso and milk', 16),
      item('hot', 'V60', 'V60', 'قهوة مقطرة، محصول اليوم', "Pour-over, today's single origin", 22),
      item('cold', 'آيس لاتيه', 'Iced latte', 'إسبريسو وحليب بارد على ثلج', 'Espresso and cold milk over ice', 20),
      item('cold', 'آيس سبانش لاتيه', 'Iced Spanish latte', 'بالحليب المكثف على ثلج', 'With condensed milk, over ice', 23),
      item('cold', 'كولد برو', 'Cold brew', 'منقوعة 18 ساعة', 'Steeped for 18 hours', 20),
      item('sweets', 'تشيز كيك سان سباستيان', 'San Sebastián cheesecake', 'قطعة بوجه محروق', 'A slice, burnt on top', 28),
      item('sweets', 'تشيز كيك لوتس', 'Lotus cheesecake', 'قطعة بصوص اللوتس', 'A slice with Lotus sauce', 26),
      item('sweets', 'كيكة العسل', 'Honey cake', 'طبقات بكريمة العسل', 'Layers with honey cream', 24),
      item('sweets', 'براونيز', 'Brownie', 'بالشوكولاتة الداكنة', 'Dark chocolate', null, 'price'),
      item('pastry', 'كرواسون بالزبدة', 'Butter croissant', 'مخبوز اليوم', 'Baked today', 12),
      item('pastry', 'كرواسون زعتر', 'Zaatar croissant', 'زعتر وزيت زيتون', 'Zaatar and olive oil', 14, 'name'),
      item('pastry', 'كرواسون شوكولاتة', 'Chocolate croissant', 'بالشوكولاتة البلجيكية', 'Belgian chocolate', 15),
      item('pastry', 'كوكيز', 'Cookie', 'بقطع الشوكولاتة', 'Chocolate chip', 9),
      item('drinks', 'ماتشا لاتيه', 'Matcha latte', 'ماتشا ياباني مع حليب', 'Japanese matcha with milk', 24),
      item('drinks', 'عصير برتقال', 'Orange juice', 'طازج', 'Fresh', 15),
      item('drinks', 'ماء', 'Water', '330 مل', '330 ml', 3),
      item('sandwich', 'ساندويتش حلومي', 'Halloumi sandwich', 'حلومي وطماطم وزعتر', 'Halloumi, tomato and zaatar', 26),
      item('sandwich', 'ساندويتش تركي وجبن', 'Turkey and cheese sandwich', 'بخبز الساوردو', 'On sourdough', 29),
    ],
  }
}

// A menu pulled in from a delivery app is already typed out, so nothing needs a second look.
export function importedMenu(): { cats: Category[]; items: Item[] } {
  const m = scannedMenu()
  return { cats: m.cats, items: m.items.map(i => ({ ...i, flag: undefined, price: i.price ?? 14 })) }
}

export const PLATFORMS = [
  { id: 'hunger', name: { ar: 'هنقرستيشن', en: 'HungerStation' } },
  { id: 'jahez', name: { ar: 'جاهز', en: 'Jahez' } },
  { id: 'foodics', name: { ar: 'فودكس', en: 'Foodics' } },
]
