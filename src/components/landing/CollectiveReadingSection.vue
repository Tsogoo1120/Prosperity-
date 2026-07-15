<script setup>
import UiIcon from '@/components/common/UiIcon.vue'

const emit = defineEmits(['nav'])

const steps = [
  {
    icon: 'layers',
    title: '1 · Багцаа сонго',
    text: 'Сар бүр шинэ уншлага гарна. Амьсгаагаа тэгшлээд 3 багцаас өөрт чинь татагдсаныг сонго.',
  },
  {
    icon: 'video',
    title: '2 · Видео уншлагаа үз',
    text: 'Сонгосон багцын чинь видео уншлага, зураг болон бичгэн тайлбар шууд нээгдэнэ.',
  },
  {
    icon: 'message',
    title: '3 · Сэтгэгдлээ хуваалц',
    text: 'Уншлага танд юу мэдрүүлснийг сэтгэгдэл хэсэгт үлдээж, бусадтай хуваалцаарай.',
  },
]

function goEnrollReading() {
  sessionStorage.setItem(
    'union-enroll-intent',
    JSON.stringify({ serviceId: 'reading' }),
  )
  emit('nav', 'enroll')
}
</script>

<template>
  <section id="collective-reading" class="landing-section">
    <div class="mx-auto max-w-wrap">
      <div class="landing-reveal" style="text-align: center; max-width: 640px; margin: 0 auto 42px">
        <div class="kicker cool" style="justify-content: center; margin-bottom: 14px">Шинэ үйлчилгээ</div>
        <h2 style="font-size: clamp(28px, 5vw, 38px); line-height: 1.12; margin-bottom: 14px">
          Хамтын Тарот уншлага
        </h2>
        <p style="font-size: 17px; color: var(--ink-soft); line-height: 1.65">
          Цаг захиалах шаардлагагүй — өөрийн багцаа сонгоод видео уншлагаа
          хүссэн үедээ үзээрэй. Сар бүр шинэчлэгдэнэ.
        </p>
      </div>

      <div class="reading-steps">
        <div
          v-for="(s, i) in steps"
          :key="s.title"
          class="card landing-reveal reading-step"
          :style="{ transitionDelay: i * 0.07 + 's' }"
        >
          <div class="reading-step__icon">
            <UiIcon :name="s.icon" :size="22" />
          </div>
          <h3 style="font-size: 17px; margin-bottom: 8px">{{ s.title }}</h3>
          <p class="muted" style="font-size: 14.5px; line-height: 1.6">{{ s.text }}</p>
        </div>
      </div>

      <div class="card landing-reveal reading-cta">
        <div style="flex: 1; min-width: 240px">
          <div class="flex items-baseline" style="gap: 8px; margin-bottom: 6px">
            <span style="font-family: var(--serif); font-weight: 700; font-size: 32px">15,000 ₮</span>
            <span class="muted" style="font-size: 14px">/сар</span>
          </div>
          <p class="flex items-center" style="gap: 8px; font-size: 14px; color: var(--sage-deep)">
            <UiIcon name="checkCircle" :size="16" />
            Сарын гишүүнчлэлтэй (50,000 ₮) хэрэглэгчдэд <strong>үнэгүй</strong> багтсан
          </p>
        </div>
        <button class="btn btn-primary btn-lg" @click="goEnrollReading">
          <UiIcon name="spark" :size="18" /> Уншлагад нэгдэх
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.reading-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-bottom: 26px;
}
@media (max-width: 760px) {
  .reading-steps {
    grid-template-columns: 1fr;
  }
}
.reading-step {
  border-radius: 18px;
  padding: 26px 24px;
}
.reading-step__icon {
  width: 46px;
  height: 46px;
  border-radius: 13px;
  background: var(--primary-tint);
  color: var(--primary-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.reading-cta {
  border-radius: 18px;
  padding: 24px 28px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  background: linear-gradient(120deg, var(--primary-tint), var(--card));
}
</style>
