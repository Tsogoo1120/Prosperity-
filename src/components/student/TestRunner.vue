<script setup>
import { ref, computed } from 'vue'
import UiIcon from '@/components/common/UiIcon.vue'
import UiBar from '@/components/common/UiBar.vue'

const props = defineProps({
  test: { type: Object, required: true },
})
const emit = defineEmits(['exit', 'finish'])

const questions = computed(() => props.test.questions ?? [])
const i = ref(0)
const answers = ref({})  // { [questionId]: optionId }

const pct = computed(() => (questions.value.length ? i.value / questions.value.length : 0))
const currentQ = computed(() => questions.value[i.value])
const answered = computed(() => answers.value[currentQ.value?.id])

function pick(optionId) {
  const qId = currentQ.value.id
  answers.value = { ...answers.value, [qId]: optionId }
  setTimeout(() => {
    if (i.value < questions.value.length - 1) i.value++
    else emit('finish', answers.value)
  }, 220)
}
</script>

<template>
  <div class="scroll-y" style="flex: 1; height: calc(100vh - 73px); overflow-y: auto; background: var(--surface-2)">
    <div class="page-inset-centered">
      <div class="flex items-center justify-between" style="margin-bottom: 22px">
        <button class="btn btn-quiet btn-sm" @click="emit('exit')">
          <UiIcon name="arrowLeft" :size="16" /> Гарах
        </button>
        <span class="muted" style="font-size: 13.5px; font-weight: 600">
          {{ i + 1 }} / {{ questions.length }}
        </span>
      </div>
      <UiBar :value="pct" color="var(--primary)" :h="6" />

      <div v-if="currentQ" :key="i" class="rise" style="margin-top: 40px; text-align: center">
        <div class="kicker cool" style="margin-bottom: 18px">{{ test.title }}</div>
        <h2 style="font-size: clamp(20px, 4vw, 28px); line-height: 1.3; max-width: 540px; margin: 0 auto 40px">
          {{ currentQ.text }}
        </h2>

        <div class="flex flex-col" style="gap: 11px; max-width: 440px; margin: 0 auto">
          <button
            v-for="opt in currentQ.options"
            :key="opt.id"
            class="scale-btn flex items-center text-left"
            :style="{
              gap: '14px',
              padding: '15px 18px',
              borderRadius: '12px',
              cursor: 'pointer',
              border: answered === opt.id ? '2px solid var(--clay)' : '2px solid var(--line)',
              background: answered === opt.id ? 'var(--clay-tint)' : 'var(--card)',
            }"
            @click="pick(opt.id)"
          >
            <span
              :style="{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                flex: 'none',
                border: answered === opt.id ? 'none' : '2px solid var(--line)',
                background: answered === opt.id ? 'var(--clay)' : 'transparent',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }"
            >
              <UiIcon v-if="answered === opt.id" name="check" :size="15" />
            </span>
            <span :style="{ fontWeight: 500, fontSize: '15.5px', color: answered === opt.id ? 'var(--clay-deep)' : 'var(--ink)' }">
              {{ opt.text }}
            </span>
          </button>
        </div>

        <button v-if="i > 0" class="btn btn-quiet btn-sm" style="margin-top: 26px" @click="i--">
          <UiIcon name="arrowLeft" :size="15" /> Өмнөх
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scale-btn {
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}
.scale-btn:hover { border-color: var(--clay); }
.scale-btn:active { transform: scale(0.99); }
</style>
