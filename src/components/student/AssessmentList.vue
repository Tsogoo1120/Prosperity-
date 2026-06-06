<script setup>
import UiIcon from '@/components/common/UiIcon.vue'

const props = defineProps({
  tests: { type: Array, default: () => [] },
  myResults: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
})
const emit = defineEmits(['start', 'viewResult'])

const HUES = ['var(--primary)', 'var(--sage-deep)', 'var(--clay)', 'var(--gold)']
const ICONS = ['compass', 'heart', 'trend', 'shield']

function hue(i) { return HUES[i % HUES.length] }
function icon(i) { return ICONS[i % ICONS.length] }
function qCount(test) { return test.questions?.length ?? 0 }
function minEst(test) { return Math.max(1, Math.ceil(qCount(test) * 0.75)) }
function lastScore(test) {
  const r = props.myResults[test.id]
  if (!r) return null
  if (r.score?.value != null) return r.score.value
  return null
}
</script>

<template>
  <div class="scroll-y" style="flex: 1; height: calc(100vh - 73px); overflow-y: auto">
    <div class="page-inset-narrow">
      <!-- header card -->
      <div
        class="card rise"
        style="border-radius: 18px; padding: 26px 30px; margin-bottom: 26px; background: linear-gradient(120deg, var(--primary-soft), var(--card))"
      >
        <div class="kicker cool" style="margin-bottom: 12px">Сэтгэл зүйн тестүүд</div>
        <h2 style="font-size: 26px; margin-bottom: 8px">Өөрийгөө танин мэдэх</h2>
        <p class="muted" style="font-size: 15px; max-width: 380px; line-height: 1.55">
          Хэрэгцээт тестийг сонгон дүгнэлтээ авч, өөрийнхөө дотоод дүрслэлийг үнэлэн дэлгэрүүлнэ үү.
        </p>
      </div>

      <!-- loading -->
      <div v-if="loading" class="flex items-center justify-center" style="padding: 60px 0">
        <span class="muted">Ачааллаж байна...</span>
      </div>

      <!-- error -->
      <div v-else-if="error" style="padding: 20px; color: var(--bad)">{{ error }}</div>

      <!-- empty -->
      <div v-else-if="!tests.length" class="muted" style="padding: 40px 0; text-align: center">
        Тест одоогоор нэмэгдээгүй байна.
      </div>

      <!-- test cards -->
      <div v-else class="grid-cols-2">
        <div
          v-for="(test, i) in tests"
          :key="test.id"
          class="card pop"
          :style="{ borderRadius: '16px', padding: '22px', animationDelay: i * 0.06 + 's' }"
        >
          <div class="flex items-center justify-between" style="margin-bottom: 14px">
            <div
              :style="{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: `color-mix(in srgb, ${hue(i)} 14%, var(--card))`,
                color: hue(i),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }"
            >
              <UiIcon :name="icon(i)" :size="24" />
            </div>
            <div v-if="lastScore(test) != null" style="text-align: right">
              <div style="font-family: var(--serif); font-weight: 700; font-size: 24px; line-height: 1">
                {{ lastScore(test) }}
              </div>
            </div>
            <span v-else-if="myResults[test.id]" class="chip">Дүгнэгдсэн</span>
            <span v-else class="chip">Өгөөгүй</span>
          </div>

          <h3 style="font-size: 19px; margin-bottom: 7px">{{ test.title }}</h3>
          <p class="muted" style="font-size: 14px; line-height: 1.5; min-height: 42px">{{ test.description }}</p>

          <div class="flex items-center justify-between" style="margin-top: 16px">
            <span class="muted" style="font-size: 12.5px">{{ qCount(test) }} асуулт · {{ minEst(test) }} мин</span>
            <div class="flex items-center" style="gap: 8px">
              <button
                v-if="myResults[test.id]"
                class="btn btn-quiet btn-sm"
                @click="emit('viewResult', test)"
              >
                Үр дүн
                <UiIcon name="trend" :size="15" />
              </button>
              <button class="btn btn-soft btn-sm" @click="emit('start', test)">
                {{ myResults[test.id] ? 'Дахин өгөх' : 'Эхлэх' }}
                <UiIcon name="arrowRight" :size="15" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
