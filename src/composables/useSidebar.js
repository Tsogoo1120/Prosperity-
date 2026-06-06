import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useSidebar() {
  const open = ref(false)
  const toggle = () => {
    open.value = !open.value
  }
  const close = () => {
    open.value = false
  }

  const onResize = () => {
    if (window.innerWidth >= 768) open.value = false
  }

  onMounted(() => window.addEventListener('resize', onResize))
  onBeforeUnmount(() => window.removeEventListener('resize', onResize))

  return { open, toggle, close }
}
