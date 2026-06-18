<script setup>
import UiLogo from '@/components/common/UiLogo.vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'

defineProps({
  view: { type: String, required: true },
  pending: { type: Number, default: 0 },
  open: { type: Boolean, default: false },
  userName: { type: String, default: 'Admin' },
})
const emit = defineEmits(['set-view', 'nav', 'close', 'logout'])

const items = [
  ['overview', 'grid', 'Overview'],
  ['schedule', 'calendar', 'Schedule'],
  ['payments', 'bank', 'Payments'],
  ['videos', 'video', 'Видео'],
  ['tests', 'compass', 'Тестүүд'],
  ['community', 'users', 'Community'],
  ['members', 'star', 'Members'],
]

function pick(id) {
  emit('set-view', id)
  emit('close')
}
</script>

<template>
  <aside
    class="app-sidebar app-sidebar--admin"
    :class="{ 'is-open': open }"
  >
    <div style="padding: 22px 22px 18px"><UiLogo :size="20" light /></div>
    <div style="padding: 0 22px 14px">
      <span class="chip" style="background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.8); border: none; font-size: 11.5px">Admin workspace</span>
    </div>
    <nav class="flex flex-col" style="gap: 4px; padding: 6px 14px; flex: 1">
      <button
        v-for="[id, ic, lbl] in items"
        :key="id"
        class="flex w-full items-center text-left"
        :style="{
          gap: '13px',
          padding: '11px 14px',
          borderRadius: '10px',
          border: 'none',
          cursor: 'pointer',
          background: view === id ? 'rgba(255,255,255,.12)' : 'transparent',
          color: view === id ? '#fff' : 'rgba(255,255,255,.62)',
          fontWeight: view === id ? 600 : 500,
          fontSize: '14.5px',
          transition: 'background .15s, color .15s',
        }"
        @click="pick(id)"
      >
        <UiIcon :name="ic" :size="20" /><span style="flex: 1">{{ lbl }}</span>
        <span
          v-if="id === 'payments' && pending > 0"
          class="chip"
          style="background: var(--clay); color: #fff; border: none; padding: 2px 8px; font-size: 11px"
          >{{ pending }}</span
        >
      </button>
    </nav>
    <div style="padding: 14px; border-top: 1px solid rgba(255, 255, 255, 0.1)">
      <div class="flex items-center justify-between" style="padding: 6px 8px">
        <div class="flex items-center" style="gap: 12px">
          <UiAvatar :name="userName" color="var(--clay)" :size="36" />
          <div>
            <div style="font-weight: 600; font-size: 13.5px; color: #fff">{{ userName }}</div>
            <div style="font-size: 11.5px; color: rgba(255, 255, 255, 0.5)">Administrator</div>
          </div>
        </div>
        <button
          title="Sign out"
          style="background: none; border: none; color: rgba(255, 255, 255, 0.6); cursor: pointer; padding: 6px"
          @click="emit('logout')"
        >
          <UiIcon name="logout" :size="18" />
        </button>
      </div>
    </div>
  </aside>
</template>
