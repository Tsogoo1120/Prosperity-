import { reactive, watch } from 'vue'

/*
 * Live theme "tweaks" — accent color, headline font, corner radius, dark mode.
 * A single reactive store, persisted to localStorage and applied to
 * document.documentElement as CSS custom properties (which every component
 * reads through the Tailwind token mapping).
 */
const ACCENTS = {
  Clay: { c: '#bd7350', d: '#a35e3d', t: '#f5e6dc', tDark: '#3a2a20' },
  Blue: { c: '#4a6d8c', d: '#36546e', t: '#e4edf3', tDark: '#243a48' },
  Sage: { c: '#5f8a73', d: '#4a6f5b', t: '#e3efe7', tDark: '#233530' },
  Plum: { c: '#8a6a86', d: '#6f5270', t: '#efe5ef', tDark: '#352a35' },
}

const HEAD_FONTS = {
  Literata: "'Literata', Georgia, serif",
  Lora: "'Lora', Georgia, serif",
  Spectral: "'Spectral', Georgia, serif",
  Newsreader: "'Newsreader', Georgia, serif",
}

const DEFAULTS = { accent: 'Clay', headFont: 'Literata', radius: 8, dark: true }

function load() {
  try {
    const raw = localStorage.getItem('union-tweaks')
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS }
}

const tweaks = reactive(load())

function apply(t) {
  const r = document.documentElement
  const a = ACCENTS[t.accent] || ACCENTS.Clay
  r.style.setProperty('--clay', a.c)
  r.style.setProperty('--clay-deep', a.d)
  r.style.setProperty('--clay-tint', t.dark ? a.tDark : a.t)
  r.style.setProperty('--serif', HEAD_FONTS[t.headFont] || HEAD_FONTS.Literata)
  r.style.setProperty('--r', t.radius + 'px')
  r.style.setProperty('--r-md', t.radius + 4 + 'px')
  r.setAttribute('data-theme', t.dark ? 'dark' : 'light')
}

watch(
  tweaks,
  (t) => {
    apply(t)
    try {
      localStorage.setItem('union-tweaks', JSON.stringify(t))
    } catch {
      /* ignore */
    }
  },
  { deep: true, immediate: true },
)

export function useTweaks() {
  const setTweak = (key, value) => {
    tweaks[key] = value
  }
  return { tweaks, setTweak }
}
