/* UNION — mock data layer (ES module) */

export const services = [
  {
    id: 'subscription',
    title: 'Сарын гишүүнчлэл',
    subtitle: 'Онлайн хичээлүүд · Psychology тест · 31 өдрийн даалгавар',
    priceDisplay: '50,000 ₮',
    price: 50000,
    period: '/сар',
    hue: 'var(--primary)',
    requiresBooking: false,
    features: [
      'Онлайн хичээлүүд',
      'Psychology test',
      '31 өдрийн даалгавар',
    ],
  },
  {
    id: 'tarot',
    title: 'Хувийн Тарот уншлага',
    subtitle: '30 минут · Онлайн · Цаг захиалах шаардлагатай',
    priceDisplay: '75,000 ₮',
    price: 75000,
    period: '',
    hue: 'var(--clay)',
    requiresBooking: true,
    tarotOptions: [
      {
        id: 'single',
        title: 'Single-чүүдийн мэргэ',
        lead: 'Яагаад хувахай Single байгааг чинь харах болно',
        bullets: [
          'Чиний ямар vibration саад болоод байгаа',
          'Дараа гарч ирэх хүн та хоёрын сүнсний гэрээ',
          'Зөвлөгөөг харна',
        ],
      },
      {
        id: 'current-love',
        title: 'Одоогийн хайр дурлал',
        lead: 'Хэрвээ чиний одоогийн хайр мэдрэл муутай, яахаа мэдэхгүй байвал энэ уншлага яг тохирно.',
        bullets: [
          'Дундаа ямар энерги хуваалцаж байгааг',
          'Нөгөө хүн чинь нөхцөл байдлаа яаж харж байгаа',
          'Цаашаа яавал дээр вэ гэх зөвлөгөө',
        ],
      },
      {
        id: 'past-love',
        title: 'Баларч одсон хайр дурлал',
        lead: 'EX чинь Fuck Around хийж байгаа юу гэдгийг findout хийнэ.',
        bullets: [
          'Нөгөө хүн чинь нөхцөл байдлаа яаж харж байгаа',
          'Дундаа ямар энерги хуваалцаж байгааг',
          'Мэдрэл нь арилаад хүн шиг болсон уу гэдгийг харж өгнө',
          'Зарим тохиолдолд чи өөрөө мэдрэл муутай нь байдаг',
        ],
      },
      {
        id: 'career',
        title: 'Ажил мэргэжил',
        lead: 'Хэрвээ чи үнэхээр ангайгаад эргэлзсэн, яахаа мэдэхгүй үед уншуулна.',
        bullets: [
          'Яагаад гацсан, юу саад болж байгааг',
          'Аль чиглэлд анхаарах ёстойг',
          'Ирэх боломж ба зөвлөгөө',
        ],
      },
      {
        id: 'general',
        title: 'Ерөнхий унших',
        lead: 'Чи дээрх сонголтуудаас сонгохгүй бол хүссэн 2 асуултаа асууж болно.',
        bullets: [
          'Асуултын чинь дагуу уншлага явна',
          'Эцэст нь хамгийн чухал зөвлөгөөг харна',
        ],
      },
    ],
  },
  {
    id: 'coaching',
    title: 'coaching үйлчилгээ',
    subtitle: '1 цаг · Онлайн · Цаг захиалах шаардлагатай',
    priceDisplay: '150,000 ₮',
    price: 150000,
    period: '',
    hue: 'var(--sage-deep)',
    requiresBooking: true,
    features: [
      'Хүсвэл тарот хөзрөөс 3 асуулт асууж болно',
      'Амьдралд тань болж буй үйл явдлуудын талаар дэлгэрэнгүй ярилцаж, хамтдаа гаргалгаа олно',
      'Spirituality талаас нь дийлэнх тохиолдолд ярилцана',
    ],
  },
]

export const courses = [
  {
    id: 'foundations',
    title: 'Foundations of Self',
    subtitle: 'Map your inner landscape before you try to change it.',
    description:
      'Өөрийгөө өөрчлөхөөс өмнө дотоод ландшафтаа тодорхойлох суурь зам. Админы нэмсэн видео болон унших материалууд энд автоматаар харагдана — үзэх эрх бүртгэл баталгаажсны дараа нээгдэнэ.',
    level: 'Core Path',
    // coverImage: optional URL/path when admin uploads course art
    hue: 'var(--primary)',
    lessons: 14,
    hours: 6.5,
    students: 2840,
    progress: 0.42,
    modules: [
      {
        id: 'm1',
        title: 'Orientation',
        lessons: [
          { id: 'l1', title: 'Why introspection works', type: 'video', dur: '8:24', done: true },
          { id: 'l2', title: 'The reflective posture', type: 'video', dur: '11:02', done: true },
          { id: 'l3', title: 'Setting your intention', type: 'reading', dur: '5 min', done: true },
        ],
      },
      {
        id: 'm2',
        title: 'Naming Your Patterns',
        lessons: [
          { id: 'l4', title: 'The stories we inherit', type: 'video', dur: '13:40', done: true },
          { id: 'l5', title: 'Triggers and tells', type: 'video', dur: '9:18', done: true },
          { id: 'l6', title: 'Journaling the loop', type: 'reading', dur: '7 min', done: false, current: true },
          { id: 'l7', title: 'Working with resistance', type: 'video', dur: '12:55', done: false },
        ],
      },
      {
        id: 'm3',
        title: 'Values in Motion',
        lessons: [
          { id: 'l8', title: 'Excavating core values', type: 'video', dur: '10:30', done: false },
          { id: 'l9', title: 'When values collide', type: 'video', dur: '14:12', done: false },
          { id: 'l10', title: 'A values compass', type: 'reading', dur: '6 min', done: false },
        ],
      },
      {
        id: 'm4',
        title: 'Integration',
        lessons: [
          { id: 'l11', title: 'From insight to habit', type: 'video', dur: '11:48', done: false },
          { id: 'l12', title: 'Designing your week', type: 'video', dur: '9:05', done: false },
          { id: 'l13', title: 'Accountability without shame', type: 'video', dur: '12:20', done: false },
          { id: 'l14', title: 'Closing reflection', type: 'reading', dur: '4 min', done: false },
        ],
      },
    ],
  },
  { id: 'eq', title: 'Emotional Fluency', subtitle: 'Read, name, and move with your emotions.', level: 'Core Path', hue: 'var(--sage-deep)', lessons: 11, hours: 5.0, students: 1960, progress: 0.0 },
  { id: 'resilience', title: 'The Resilient Mind', subtitle: 'Build a steadier nervous system under pressure.', level: 'Specialization', hue: 'var(--clay)', lessons: 9, hours: 4.2, students: 1410, progress: 0.0 },
  { id: 'clarity', title: 'Professional Clarity', subtitle: 'Align your work with who you are becoming.', level: 'Specialization', hue: 'var(--gold)', lessons: 12, hours: 5.5, students: 980, progress: 0.0 },
]


// 31-Day Growth Challenge
export const challengeDays = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1
  const themes = ['Notice', 'Name', 'Question', 'Soften', 'Choose']
  return {
    day: d,
    theme: themes[i % themes.length],
    prompt: [
      'Write down one belief about yourself you’ve never questioned.',
      'Name the emotion you avoided most today.',
      'What would the calmest version of you do right now?',
      'Recall a setback. What did it quietly teach you?',
      'Where did you choose growth over comfort today?',
      'Who do you compare yourself to, and why?',
      'Describe a moment you felt fully yourself.',
    ][i % 7],
    tasks: ['5-min grounding breath', 'Today’s lesson', 'Reflection entry'],
    done: d < 12,
    current: d === 12,
    streak: d <= 12,
  }
})


export const introVideo = {
  title: 'Танилцуулга бичлэг',
  headline: 'subscription үйлчилгээний талаар',
  description:
    'Сар болгоны subscription төлбөрт багтсан видео хичээлүүд болон psygology тэст зэргээр өөрийгөө танин мэдэх хөгжүүлэхэд тусална.',
  duration: '3:33',
  caption: 'Танилцуулга бичлэгээс дэлгэрэнгүй мэдээлэл аваарай',
  highlights: [
    'Spirituality сэдвүүд болон филисофи чиглэлүүдээр хичээлүүд',
    'Community хэсэгт өөрсдийнхөө туршлагыг хуваалцах боломжтой',
    '7 хоног болгон psycology tests',
  ],
}

export const instructor = {
  name: 'Онлайн уулзалт товлох',
  role: 'Founder & Mentor',
  bio: 'Надтай цаг товлож холбогдсоноор таны нөхцөл байдлын гаргалгааг хамтдаа тодорхойлж чиглэл олох талаас хамтран ажиллах болно',
}


// Course prices keyed by id (was inlined in the enroll flow).
export const coursePrices = { foundations: 149, eq: 129, resilience: 119, clarity: 139 }

// Student community — journey vlog feed
export const currentStudent = {
  id: 'u-avery',
  name: 'Avery Quinn',
  avatar: 'var(--clay)',
  day: 12,
  course: 'Foundations of Self',
}

export const journeyPosts = [
  {
    id: 'jp1',
    authorId: 'u-lena',
    author: 'Lena Whitfield',
    avatar: 'var(--primary)',
    day: 18,
    title: 'Day 18 — Letting the guard down',
    body:
      'Filmed this after today\'s lesson on resistance. I realized I\'ve been treating vulnerability like a weakness instead of a signal. Still shaky saying it out loud, but that\'s the point.',
    mediaType: 'video',
    mediaDur: '2:14',
    hue: 'var(--primary)',
    createdAt: '2 hours ago',
    likes: 24,
    liked: false,
    comments: [
      {
        id: 'c1',
        authorId: 'u-marcus',
        author: 'Marcus Adeyemi',
        avatar: 'var(--sage-deep)',
        body: 'The part about naming the fear before acting on it — that landed hard. Thank you for sharing this.',
        createdAt: '1 hour ago',
      },
      {
        id: 'c2',
        authorId: 'u-priya',
        author: 'Priya Raman',
        avatar: 'var(--clay)',
        body: 'Day 18 crew! Your honesty makes it easier for the rest of us to show up real.',
        createdAt: '45 min ago',
      },
    ],
  },
  {
    id: 'jp2',
    authorId: 'u-marcus',
    author: 'Marcus Adeyemi',
    avatar: 'var(--sage-deep)',
    day: 9,
    title: 'Week one check-in',
    body:
      'No fancy setup — just me, my notebook, and what shifted after the values exercise. If you\'re stuck on Day 9, watch this before you skip the reflection.',
    mediaType: 'video',
    mediaDur: '3:42',
    hue: 'var(--sage-deep)',
    createdAt: 'Yesterday',
    likes: 31,
    liked: true,
    comments: [
      {
        id: 'c3',
        authorId: 'u-aiko',
        author: 'Aiko Tanaka',
        avatar: '#51736a',
        body: 'Needed this today. The “compare less, notice more” line is going on a sticky note.',
        createdAt: 'Yesterday',
      },
    ],
  },
  {
    id: 'jp3',
    authorId: 'u-sofia',
    author: 'Sofia Greco',
    avatar: 'var(--gold)',
    day: 5,
    title: 'First time posting — nervous but here',
    body:
      'Text-only today. Three things I noticed since starting Foundations: I interrupt myself less, I write before I react, and I finally told a friend I\'m doing this work. Small wins count.',
    mediaType: null,
    mediaDur: null,
    hue: 'var(--gold)',
    createdAt: '3 days ago',
    likes: 18,
    liked: false,
    comments: [
      {
        id: 'c4',
        authorId: 'u-tomas',
        author: 'Tomas Eriksen',
        avatar: '#c79a45',
        body: 'Welcome! Day 5 was when it clicked for me too. Keep going.',
        createdAt: '3 days ago',
      },
      {
        id: 'c5',
        authorId: 'u-avery',
        author: 'Avery Quinn',
        avatar: 'var(--clay)',
        body: 'Same here on the writing before reacting — game changer.',
        createdAt: '2 days ago',
      },
    ],
  },
  {
    id: 'jp4',
    authorId: 'u-priya',
    author: 'Priya Raman',
    avatar: 'var(--clay)',
    day: 22,
    title: 'Soften — a morning walk vlog',
    body:
      'Took the Day 22 prompt outside. Filmed while walking because sitting still felt too heavy. Sharing the raw version, no edits.',
    mediaType: 'video',
    mediaDur: '1:58',
    hue: 'var(--clay)',
    createdAt: '4 days ago',
    likes: 42,
    liked: false,
    comments: [],
  },
]

export default {
  courses,
  challengeDays,
  instructor,
  introVideo,
  coursePrices,
  currentStudent,
  journeyPosts,
}
