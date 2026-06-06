<script setup>
import { ref, computed } from 'vue'
import { courses } from '@/data/union.js'
import UiIcon from '@/components/common/UiIcon.vue'
import UiBar from '@/components/common/UiBar.vue'
import LessonRow from './LessonRow.vue'

const cid = ref('foundations')
const course = computed(() => courses.find((c) => c.id === cid.value))
const totalLessons = computed(() => (course.value.modules || []).reduce((s, m) => s + m.lessons.length, 0))

const completion = [
  { label: 'Enrolled', v: 412 },
  { label: 'Started', v: 388 },
  { label: 'Halfway', v: 246 },
  { label: 'Completed', v: 198 },
]
const funnelColors = ['var(--primary)', 'var(--sage-deep)', 'var(--gold)', 'var(--clay)']
</script>

<template>
  <div class="flex flex-col" style="flex: 1; height: calc(100vh - 72px)">
    <!-- course tabs -->
    <div
      class="topbar-row flex-wrap"
      style="padding: 14px 36px; border-bottom: 1px solid var(--line); background: var(--card); gap: 16px"
    >
      <div class="scroll-y flex items-center" style="gap: 8px; overflow-x: auto; flex: 1; min-width: 0">
        <button
          v-for="c in courses"
          :key="c.id"
          class="btn btn-sm"
          :style="{
            background: cid === c.id ? 'var(--ink)' : 'transparent',
            color: cid === c.id ? 'var(--surface)' : 'var(--ink-soft)',
            border: cid === c.id ? 'none' : '1px solid var(--line)',
            whiteSpace: 'nowrap',
          }"
          @click="cid = c.id"
        >
          {{ c.title }}
        </button>
      </div>
      <button class="btn btn-primary btn-sm hide-mobile" style="flex: none"><UiIcon name="plus" :size="16" /> New course</button>
    </div>

    <div class="scroll-y" style="flex: 1; overflow-y: auto">
      <div class="grid-split-course">
        <!-- builder -->
        <div>
          <div class="flex items-center justify-between" style="margin-bottom: 6px">
            <h2 style="font-size: 25px">{{ course.title }}</h2>
            <button class="btn btn-ghost btn-sm"><UiIcon name="eye" :size="16" /> Preview</button>
          </div>
          <p class="muted" style="font-size: 14.5px; margin-bottom: 22px">
            {{ course.subtitle }} · {{ totalLessons }} lessons across {{ (course.modules || []).length }} modules
          </p>

          <div v-if="course.modules" class="flex flex-col" style="gap: 16px">
            <div v-for="(m, mi) in course.modules" :key="m.id" class="card" style="border-radius: 14px; overflow: hidden">
              <div class="flex items-center justify-between" style="padding: 14px 18px; background: var(--surface-2); border-bottom: 1px solid var(--line)">
                <div class="flex items-center" style="gap: 12px">
                  <span style="color: var(--faint); cursor: grab"><UiIcon name="dots" :size="16" /></span>
                  <div style="width: 26px; height: 26px; border-radius: 7px; background: var(--ink); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700">{{ mi + 1 }}</div>
                  <span style="font-weight: 600; font-size: 15px">{{ m.title }}</span>
                  <span class="muted" style="font-size: 12.5px">{{ m.lessons.length }} lessons</span>
                </div>
                <button class="btn btn-quiet btn-sm" style="font-size: 12.5px"><UiIcon name="plus" :size="15" /> Lesson</button>
              </div>
              <div class="flex flex-col" style="gap: 8px; padding: 14px">
                <LessonRow v-for="l in m.lessons" :key="l.id" :lesson="l" />
              </div>
            </div>
            <button class="btn btn-ghost" style="border-style: dashed; justify-content: center; padding: 16px">
              <UiIcon name="plus" :size="18" /> Add module
            </button>
          </div>
          <div v-else class="card card-pad" style="border-radius: 14px; text-align: center; padding: 48px; color: var(--muted)">
            <UiIcon name="layers" :size="32" style="margin: 0 auto 14px; color: var(--faint)" />
            <p style="margin-bottom: 16px">This course doesn’t have a curriculum yet.</p>
            <button class="btn btn-primary btn-sm" style="margin: 0 auto"><UiIcon name="plus" :size="16" /> Build curriculum</button>
          </div>
        </div>

        <!-- stats panel -->
        <div class="flex flex-col course-stats-panel" style="gap: 18px; position: sticky; top: 26px">
          <div class="card card-pad" style="border-radius: 16px">
            <h3 style="font-size: 16px; margin-bottom: 18px">Completion funnel</h3>
            <div class="flex flex-col" style="gap: 14px">
              <div v-for="(c, i) in completion" :key="c.label">
                <div class="flex items-center justify-between" style="font-size: 13px; margin-bottom: 6px">
                  <span class="muted">{{ c.label }}</span><span style="font-weight: 700">{{ c.v }}</span>
                </div>
                <UiBar :value="c.v / completion[0].v" :color="funnelColors[i]" />
              </div>
            </div>
            <div class="hr" style="margin: 18px 0 14px" />
            <div class="flex items-center justify-between">
              <span class="muted" style="font-size: 13.5px">Completion rate</span>
              <span style="font-family: var(--serif); font-weight: 700; font-size: 22px; color: var(--sage-deep)">48%</span>
            </div>
          </div>
          <div class="card card-pad" style="border-radius: 16px">
            <h3 style="font-size: 16px; margin-bottom: 14px">Content mix</h3>
            <div class="flex flex-col" style="gap: 12px">
              <div class="flex items-center justify-between" style="font-size: 14px">
                <span class="flex items-center" style="gap: 8px"><span style="width: 26px; height: 26px; border-radius: 7px; background: var(--primary-tint); color: var(--primary); display: flex; align-items: center; justify-content: center"><UiIcon name="video" :size="15" /></span> Video lessons</span>
                <span style="font-weight: 700">10</span>
              </div>
              <div class="flex items-center justify-between" style="font-size: 14px">
                <span class="flex items-center" style="gap: 8px"><span style="width: 26px; height: 26px; border-radius: 7px; background: var(--sage-tint); color: var(--sage-deep); display: flex; align-items: center; justify-content: center"><UiIcon name="doc" :size="15" /></span> Readings</span>
                <span style="font-weight: 700">4</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
