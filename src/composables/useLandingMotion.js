import { onMounted, onBeforeUnmount } from 'vue'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const HEADER_OFFSET = 68

/** Smooth-scroll a section into view inside the landing scroll container. */
export function scrollToLandingSection(sectionId) {
  const root = document.querySelector('[data-scroll="landing"]')
  const target = document.getElementById(sectionId)
  if (!root || !target) return

  const rootTop = root.getBoundingClientRect().top
  const targetTop = target.getBoundingClientRect().top
  const top = root.scrollTop + (targetTop - rootTop) - HEADER_OFFSET

  root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

/** Intersection-based reveal for elements marked `.landing-reveal`. */
export function useLandingMotion() {
  let observer = null

  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.landing-reveal').forEach((el) => el.classList.add('is-inview'))
      return
    }

    const root = document.querySelector('[data-scroll="landing"]')
    if (!root) return

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-inview')
          observer.unobserve(entry.target)
        })
      },
      { root, rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )

    root.querySelectorAll('.landing-reveal').forEach((el) => observer.observe(el))
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
  })
}

export { EASE, HEADER_OFFSET }
