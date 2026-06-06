<script setup>
import { ref, computed, watch } from 'vue'
import { challengeDays } from '@/data/union.js'
import UiIcon from '@/components/common/UiIcon.vue'
import UiBar from '@/components/common/UiBar.vue'
import CalmField from '@/components/common/CalmField.vue'

const days = challengeDays
const sel = ref(days.find((d) => d.current))
const tasks = ref({ 0: true, 1: true, 2: false })
const reflect = ref('')
const saved = ref(true)
let timer = null

watch(
  () => sel.value.day,
  (day) => {
    reflect.value = localStorage.getItem('union-reflect-' + day) || ''
    saved.value = true
  },
  { immediate: true },
)

function onReflect() {
  saved.value = false
  clearTimeout(timer)
  timer = setTimeout(() => {
    localStorage.setItem('union-reflect-' + sel.value.day, reflect.value)
    saved.value = true
  }, 600)
}

const doneCount = computed(() => days.filter((d) => d.done).length)
const taskDone = computed(() => Object.values(tasks.value).filter(Boolean).length)

const banner = computed(() => [
  ['Days complete', doneCount.value + '/31'],
  ['Reflections', '11'],
  ['Best streak', '12'],
])

function cellBg(d) {
  return d.done ? 'var(--sage-deep)' : d.current ? 'var(--clay)' : 'var(--card)'
}
function cellColor(d) {
  return d.done || d.current ? '#fff' : 'var(--faint)'
}
function cellBorder(d, active) {
  return active ? '2px solid var(--ink)' : d.done || d.current ? '1.5px solid transparent' : '1.5px solid var(--line)'
}
</script>

<template>
  <div class="scroll-y" style="flex: 1; height: calc(100vh - 73px); overflow-y: auto">
    <div class="page-inset-narrow">
      <!-- streak banner -->
      <div
        class="card rise"
        style="border-radius: 18px; padding: 24px 30px; margin-bottom: 24px; position: relative; overflow: hidden; background: linear-gradient(120deg, var(--ink), #1c3d4d)"
      >
        <CalmField :style-override="{ opacity: 0.5 }" />
        <div class="flex flex-wrap items-center justify-between" style="position: relative; gap: 20px">
          <div class="flex items-center" style="gap: 20px">
            <div style="width: 62px; height: 62px; border-radius: 16px; background: rgba(255, 255, 255, 0.12); display: flex; align-items: center; justify-content: center; color: var(--gold)">
              <UiIcon name="flame" :size="32" />
            </div>
            <div>
              <div style="color: rgba(255, 255, 255, 0.65); font-size: 13.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase">Current streak</div>
              <div style="font-family: var(--serif); font-weight: 700; font-size: 34px; color: #fff; line-height: 1">12 days</div>
            </div>
          </div>
          <div class="flex items-center" style="gap: 24px">
            <div v-for="[l, v] in banner" :key="l" style="text-align: center">
              <div style="font-family: var(--serif); font-weight: 700; font-size: 22px; color: #fff">{{ v }}</div>
              <div style="color: rgba(255, 255, 255, 0.6); font-size: 12.5px">{{ l }}</div>
            </div>
          </div>
        </div>
        <div style="position: relative; margin-top: 22px">
          <UiBar :value="doneCount / 31" color="var(--gold)" :h="8" />
        </div>
      </div>

      <div class="grid-split-challenge">
        <!-- calendar grid -->
        <div class="card card-pad rise d1" style="border-radius: 16px">
          <div class="flex items-center justify-between" style="margin-bottom: 18px">
            <h3 style="font-size: 18px">Your 31 days</h3>
            <div class="flex items-center" style="gap: 12px; font-size: 12px; color: var(--muted)">
              <span class="flex items-center" style="gap: 6px"><span style="width: 10px; height: 10px; border-radius: 3px; background: var(--sage-deep)" /> Done</span>
              <span class="flex items-center" style="gap: 6px"><span style="width: 10px; height: 10px; border-radius: 3px; background: var(--clay)" /> Today</span>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px">
            <button
              v-for="d in days"
              :key="d.day"
              class="day-cell flex flex-col items-center justify-center"
              :title="'Day ' + d.day"
              :style="{
                aspectRatio: '1',
                borderRadius: '11px',
                cursor: 'pointer',
                position: 'relative',
                border: cellBorder(d, sel.day === d.day),
                background: cellBg(d),
                color: cellColor(d),
                gap: '2px',
                transition: 'transform .12s',
                fontFamily: 'var(--sans)',
              }"
              @click="sel = d"
            >
              <span style="font-size: 14px; font-weight: 700">{{ d.day }}</span>
              <UiIcon v-if="d.done" name="check" :size="12" />
              <span v-else-if="d.current" style="width: 5px; height: 5px; border-radius: 50%; background: #fff" />
            </button>
          </div>
        </div>

        <!-- today panel -->
        <div class="card rise d2" style="border-radius: 16px; overflow: hidden">
          <div style="padding: 22px 26px; border-bottom: 1px solid var(--line)">
            <div class="flex items-center justify-between">
              <span class="chip clay"><UiIcon name="flame" :size="13" /> Day {{ sel.day }}</span>
              <span class="chip sage">{{ sel.theme }}</span>
            </div>
            <p style="font-family: var(--serif); font-style: italic; font-size: 21px; line-height: 1.4; margin-top: 16px; color: var(--ink)">
              “{{ sel.prompt }}”
            </p>
          </div>
          <div style="padding: 20px 26px">
            <div class="flex items-center justify-between" style="margin-bottom: 14px">
              <div style="font-weight: 600; font-size: 14.5px">Today’s practice</div>
              <span class="muted" style="font-size: 12.5px">{{ taskDone }}/3 done</span>
            </div>
            <div class="flex flex-col" style="gap: 8px; margin-bottom: 22px">
              <button
                v-for="(t, i) in sel.tasks"
                :key="i"
                class="task-row flex w-full items-center text-left"
                :style="{
                  gap: '12px',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: '11px',
                  border: '1.5px solid var(--line)',
                  background: tasks[i] ? 'var(--sage-tint)' : 'var(--card)',
                }"
                @click="tasks = { ...tasks, [i]: !tasks[i] }"
              >
                <span
                  :style="{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    flex: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: tasks[i] ? 'var(--sage-deep)' : 'transparent',
                    border: tasks[i] ? 'none' : '2px solid var(--line)',
                    color: '#fff',
                  }"
                >
                  <UiIcon v-if="tasks[i]" name="check" :size="14" />
                </span>
                <span :style="{ fontSize: '14.5px', fontWeight: 500, color: tasks[i] ? 'var(--sage-deep)' : 'var(--ink)', textDecoration: tasks[i] ? 'line-through' : 'none' }">{{ t }}</span>
              </button>
            </div>

            <div class="flex items-center justify-between" style="margin-bottom: 10px">
              <div style="font-weight: 600; font-size: 14.5px">Reflection log</div>
              <span :style="{ fontSize: '12px', color: saved ? 'var(--sage-deep)' : 'var(--muted)' }">{{ saved ? 'Saved' : 'Saving…' }}</span>
            </div>
            <textarea
              v-model="reflect"
              class="textarea"
              rows="4"
              placeholder="What surfaced as you sat with today’s prompt?"
              style="font-size: 14.5px; line-height: 1.65"
              @input="onReflect"
            />
            <button class="btn btn-primary btn-block" style="margin-top: 16px" :disabled="taskDone < 3">
              {{ taskDone < 3 ? 'Complete today’s practice to log' : 'Complete Day ' + sel.day }}
              <UiIcon v-if="taskDone >= 3" name="check" :size="17" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.day-cell:hover {
  transform: scale(1.06);
}
.task-row {
  transition: background 0.15s, border-color 0.15s;
}
.task-row:hover {
  border-color: var(--sage-deep);
}
</style>
