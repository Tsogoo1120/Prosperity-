<script setup>
import { reactive, watch } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'
import { supabase } from '@/lib/supabase.js'

const props = defineProps({
  slots: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  actingSlotId: { type: String, default: null },
  actErr: { type: String, default: '' },
})
const emit = defineEmits(['approve', 'deny'])

const screenshotUrls = reactive({})

watch(() => props.slots, (slots) => {
  for (const slot of slots) {
    if (slot.payment_screenshot_path && !screenshotUrls[slot.id]) {
      supabase.storage
        .from('payment-screenshots')
        .createSignedUrl(slot.payment_screenshot_path, 3600)
        .then(({ data: u }) => { if (u?.signedUrl) screenshotUrls[slot.id] = u.signedUrl })
    }
  }
}, { immediate: true })

function fmtDt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
</script>

<template>
  <div class="scroll-y" style="flex: 1; overflow-y: auto">
    <div class="page-inset" style="max-width: 800px">
      <div v-if="actErr" style="margin-bottom: 14px; padding: 12px 16px; background: var(--bad-tint); border-radius: 10px; font-size: 13.5px; color: var(--bad)">
        {{ actErr }}
      </div>

      <div v-if="loading" style="padding: 48px; text-align: center; color: var(--muted)">
        <UiIcon name="clock" :size="22" style="display: block; margin: 0 auto 8px; opacity: 0.35" />
        Уншиж байна…
      </div>

      <div v-else-if="!slots.length" class="card card-pad" style="border-radius: 16px; text-align: center; padding: 56px; color: var(--muted)">
        <UiIcon name="calendar" :size="36" style="display: block; margin: 0 auto 14px; opacity: 0.25" />
        <p style="font-size: 15px">Хүлээгдэж буй захиалга байхгүй байна.</p>
      </div>

      <div v-else class="flex flex-col" style="gap: 12px">
        <div
          v-for="slot in slots"
          :key="slot.id"
          class="card"
          style="border-radius: 14px; padding: 18px 22px; border-left: 4px solid var(--warn)"
        >
          <div class="flex items-start flex-wrap" style="gap: 16px">
            <!-- User info -->
            <div class="flex items-center" style="gap: 12px; flex: 1; min-width: 200px">
              <UiAvatar :name="slot.profiles?.full_name || slot.profiles?.email || '?'" :size="44" />
              <div>
                <div style="font-weight: 600; font-size: 15px">{{ slot.profiles?.full_name || '—' }}</div>
                <div class="muted" style="font-size: 13px">{{ slot.profiles?.email }}</div>
              </div>
            </div>

            <!-- Slot info -->
            <div style="flex: 1; min-width: 180px">
              <div style="font-weight: 600; font-size: 14.5px; margin-bottom: 4px">
                {{ slot.service_type === 'tarot_reading' ? 'Тарот уншлага' : '1:1 Coaching' }}
              </div>
              <div class="muted" style="font-size: 13px; display: flex; align-items: center; gap: 6px">
                <UiIcon name="calendar" :size="14" />
                {{ fmtDt(slot.start_at) }} – {{ new Date(slot.end_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) }}
              </div>
              <div v-if="slot.description" class="muted" style="font-size: 13px; margin-top: 4px">
                <UiIcon name="note" :size="13" style="vertical-align: -2px" /> {{ slot.description }}
              </div>
            </div>

            <!-- Screenshot + meet link + actions -->
            <div style="width: 100%; margin-top: 12px; display: flex; flex-direction: column; gap: 12px">
              <div v-if="slot.payment_screenshot_path" style="border-radius: 10px; overflow: hidden; border: 1px solid var(--line); max-height: 160px; background: var(--surface-2)">
                <img
                  v-if="screenshotUrls[slot.id]"
                  :src="screenshotUrls[slot.id]"
                  alt="Баримт"
                  style="width: 100%; max-height: 160px; object-fit: contain; display: block"
                />
                <div v-else style="padding: 18px; text-align: center; font-size: 12.5px; color: var(--muted)">Баримт уншиж байна…</div>
              </div>
              <div v-else style="padding: 12px; border-radius: 10px; background: var(--warn-tint); font-size: 12.5px; color: var(--warn)">
                Төлбөрийн баримт байхгүй
              </div>

              <div style="font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px">
                <UiIcon name="check" :size="14" style="color: var(--good)" />
                Батлахад Google Meet линк автоматаар үүсч имэйлээр илгээгдэнэ.
              </div>

              <div class="flex items-center" style="gap: 8px">
                <button
                  class="btn btn-ghost btn-sm"
                  style="color: var(--bad); border-color: var(--bad-tint)"
                  :disabled="actingSlotId === slot.id"
                  @click="emit('deny', slot)"
                >
                  <UiIcon name="x" :size="16" /> Татгалзах
                </button>
                <button
                  class="btn btn-sm"
                  style="background: var(--good); color: #fff"
                  :disabled="actingSlotId === slot.id"
                  @click="emit('approve', { slot })"
                >
                  <UiIcon name="check" :size="16" />
                  {{ actingSlotId === slot.id ? 'Уншиж байна…' : 'Батлах' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
