<script setup>
import { ref } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'

const props = defineProps({
  course: { type: Object, required: true },
  activeId: { type: String, required: true },
})
const emit = defineEmits(['pick'])

const open = ref(props.course.modules.map((m, i) => i <= 1))
const toggle = (mi) => (open.value[mi] = !open.value[mi])
const doneCount = (m) => m.lessons.filter((l) => l.done).length
</script>

<template>
  <div class="flex flex-col" style="gap: 8px">
    <div v-for="(m, mi) in course.modules" :key="m.id" class="card" style="border-radius: 12px; overflow: hidden">
      <button
        class="flex w-full items-center justify-between"
        style="padding: 13px 15px; background: transparent; border: none; cursor: pointer"
        @click="toggle(mi)"
      >
        <div class="flex items-center" style="gap: 12px; text-align: left">
          <div
            :style="{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              flex: 'none',
              background: doneCount(m) === m.lessons.length ? 'var(--sage-tint)' : 'var(--surface-2)',
              color: doneCount(m) === m.lessons.length ? 'var(--sage-deep)' : 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12.5px',
              fontWeight: 700,
            }"
          >
            <UiIcon v-if="doneCount(m) === m.lessons.length" name="check" :size="15" />
            <template v-else>{{ mi + 1 }}</template>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 14px">{{ m.title }}</div>
            <div class="muted" style="font-size: 12px">{{ doneCount(m) }}/{{ m.lessons.length }} complete</div>
          </div>
        </div>
        <UiIcon name="chevDown" :size="17" :style="{ color: 'var(--faint)', transform: open[mi] ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }" />
      </button>
      <div v-if="open[mi]" style="border-top: 1px solid var(--line-soft)">
        <button
          v-for="l in m.lessons"
          :key="l.id"
          class="lesson-row flex w-full items-center text-left"
          :style="{
            gap: '11px',
            padding: '10px 15px 10px 18px',
            border: 'none',
            cursor: 'pointer',
            background: l.id === activeId ? 'var(--primary-tint)' : 'transparent',
          }"
          @click="emit('pick', l)"
        >
          <span :style="{ color: l.done ? 'var(--sage-deep)' : l.id === activeId ? 'var(--clay)' : 'var(--faint)', flex: 'none' }">
            <UiIcon :name="l.done ? 'checkCircle' : l.type === 'reading' ? 'doc' : 'play'" :size="17" :fill="l.id === activeId && !l.done" />
          </span>
          <span :style="{ flex: 1, fontSize: '13.5px', fontWeight: l.id === activeId ? 600 : 500, color: l.id === activeId ? 'var(--primary-deep)' : 'var(--ink-soft)' }">{{ l.title }}</span>
          <span class="muted" style="font-size: 11.5px">{{ l.dur }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lesson-row:hover {
  background: var(--surface-2) !important;
}
</style>
