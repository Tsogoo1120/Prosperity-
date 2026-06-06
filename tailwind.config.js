/** @type {import('tailwindcss').Config} */
// Colors, radii, shadows and fonts all resolve to CSS custom properties defined
// in src/assets/main.css. That keeps light/dark theming + the live "tweaks"
// (accent, radius, font) working through one source of truth while still letting
// us write idiomatic Tailwind utilities like `bg-clay text-ink rounded-md`.
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        primary: {
          DEFAULT: 'var(--primary)',
          deep: 'var(--primary-deep)',
          tint: 'var(--primary-tint)',
          soft: 'var(--primary-soft)',
        },
        sage: {
          DEFAULT: 'var(--sage)',
          deep: 'var(--sage-deep)',
          tint: 'var(--sage-tint)',
        },
        clay: {
          DEFAULT: 'var(--clay)',
          deep: 'var(--clay-deep)',
          tint: 'var(--clay-tint)',
        },
        gold: {
          DEFAULT: 'var(--gold)',
          tint: 'var(--gold-tint)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        card: 'var(--card)',
        line: {
          DEFAULT: 'var(--line)',
          soft: 'var(--line-soft)',
        },
        good: { DEFAULT: 'var(--good)', tint: 'var(--good-tint)' },
        warn: { DEFAULT: 'var(--warn)', tint: 'var(--warn-tint)' },
        bad: { DEFAULT: 'var(--bad)', tint: 'var(--bad-tint)' },
      },
      fontFamily: {
        serif: 'var(--serif)',
        sans: 'var(--sans)',
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
      },
      boxShadow: {
        sm: 'var(--sh-sm)',
        DEFAULT: 'var(--sh)',
        md: 'var(--sh-md)',
        lg: 'var(--sh-lg)',
        ring: 'var(--ring)',
      },
      maxWidth: {
        wrap: 'var(--maxw)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
        fade: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(.97)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        rise: 'rise .6s cubic-bezier(.2,.7,.2,1) both',
        fade: 'fade .5s ease both',
        pop: 'scaleIn .4s cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [],
}
