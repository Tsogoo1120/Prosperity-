import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function useAvailableSlots() {
  const rawSlots = ref([])

  const dayMap = computed(() => {
    const map = {}
    for (const s of rawSlots.value) {
      const iso = s.start_at.slice(0, 10)
      if (!map[iso]) {
        const d = new Date(s.start_at)
        map[iso] = { iso, d: DAY_NAMES[d.getDay()], n: d.getDate(), items: [] }
      }
      const d = new Date(s.start_at)
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      map[iso].items.push({ id: s.id, time: `${hh}:${mm}`, serviceType: s.service_type })
    }
    return map
  })

  const availDays = computed(() => Object.values(dayMap.value))

  async function loadAvailableSlots() {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('coaching_slots')
      .select('id, start_at, end_at, service_type')
      .eq('status', 'available')
      .is('user_id', null)
      .gte('start_at', now)
      .order('start_at', { ascending: true })
    rawSlots.value = data ?? []
  }

  return { rawSlots, dayMap, availDays, loadAvailableSlots }
}
