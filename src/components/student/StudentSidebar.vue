<script setup>
import UiLogo from '@/components/common/UiLogo.vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'

defineProps({
  view: { type: String, required: true },
  open: { type: Boolean, default: false },
  userName: { type: String, default: 'Student' },
})
const emit = defineEmits(['set-view', 'nav', 'close', 'logout'])

const items = [
  ['dashboard', 'home', 'Dashboard'],
  ['learn', 'video', 'Continue learning'],
  ['assess', 'compass', 'Psychology tests'],
  // ['challenge', 'flame', 'The Challenge'],
  ['sessions', 'calendar', 'Meeting time'],
  ['community', 'users', 'Community'],
]

function pick(id) {
  emit('set-view', id)
  emit('close')
}
</script>

<template>
  <aside
    class="app-sidebar app-sidebar--student"
    :class="{ 'is-open': open }"
  >
    <div style="padding: 22px 22px 18px"><UiLogo :size="20" /></div>
    <nav class="flex flex-col" style="gap: 4px; padding: 6px 14px; flex: 1">
      <div
        class="muted"
        style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 8px 14px 6px"
      >
        Your path
      </div>
      <button
        v-for="[id, ic, lbl] in items"
        :key="id"
        class="side-item flex w-full items-center text-left"
        :style="{
          gap: '13px',
          padding: '11px 14px',
          borderRadius: '10px',
          border: 'none',
          cursor: 'pointer',
          background: view === id ? 'var(--primary-tint)' : 'transparent',
          color: view === id ? 'var(--primary-deep)' : 'var(--ink-soft)',
          fontWeight: view === id ? 600 : 500,
          fontSize: '14.5px',
          transition: 'background .15s, color .15s',
        }"
        @click="pick(id)"
      >
        <UiIcon :name="ic" :size="20" />
        <span style="flex: 1">{{ lbl }}</span>
        <span v-if="id === 'challenge'" class="chip clay" style="padding: 2px 8px; font-size: 11.5px">Day 12</span>
      </button>
    </nav>
    <div style="padding: 14px; border-top: 1px solid var(--line)">
      <div class="flex items-center justify-between" style="padding: 6px 8px">
        <div class="flex items-center" style="gap: 12px">
          <UiAvatar :name="userName" color="var(--clay)" :size="38" />
          <div>
            <div style="font-weight: 600; font-size: 14px">{{ userName }}</div>
            <div class="muted" style="font-size: 12px">Student</div>
          </div>
        </div>
        <button class="btn btn-quiet" style="padding: 7px" title="Sign out" @click="emit('logout')">
          <UiIcon name="logout" :size="18" />
        </button>
      </div>
    </div>
  </aside>
</template>
