<script setup>
import UiLogo from '@/components/common/UiLogo.vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'

const props = defineProps({
  view: { type: String, required: true },
  open: { type: Boolean, default: false },
  userName: { type: String, default: 'Student' },
  // Reading-pass user (collective reading only): every view except Community
  // is locked and routes to the subscription upgrade flow.
  readerOnly: { type: Boolean, default: false },
})
const emit = defineEmits(['set-view', 'nav', 'close', 'logout', 'upgrade'])

const items = [
  ['dashboard', 'home', 'Dashboard'],
  ['learn', 'video', 'Continue learning'],
  ['assess', 'compass', 'Psychology tests'],
  // ['challenge', 'flame', 'The Challenge'],
  ['sessions', 'calendar', 'Meeting time'],
  ['community', 'users', 'Community'],
]

function isLocked(id) {
  return props.readerOnly && id !== 'community'
}

function pick(id) {
  if (isLocked(id)) {
    emit('upgrade')
  } else {
    emit('set-view', id)
  }
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
          opacity: isLocked(id) ? 0.55 : 1,
          transition: 'background .15s, color .15s',
        }"
        @click="pick(id)"
      >
        <UiIcon :name="ic" :size="20" />
        <span style="flex: 1">{{ lbl }}</span>
        <UiIcon v-if="isLocked(id)" name="lock" :size="15" style="color: var(--faint)" />
        <span v-else-if="id === 'challenge'" class="chip clay" style="padding: 2px 8px; font-size: 11.5px">Day 12</span>
      </button>
      <div
        v-if="readerOnly"
        style="margin: 10px 14px 0; padding: 12px 14px; border-radius: 12px; background: var(--sage-tint); font-size: 12.5px; line-height: 1.5; color: var(--sage-deep)"
      >
        Та Хамтын уншлагын эрхтэй байна. Бүх хичээл, тест нээхийг хүсвэл сарын
        гишүүнчлэл аваарай.
        <button
          class="btn btn-sm"
          style="margin-top: 8px; width: 100%; justify-content: center; background: var(--sage-deep); color: #fff; border: none"
          @click="emit('upgrade'); emit('close')"
        >
          Гишүүнчлэл авах
        </button>
      </div>
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
