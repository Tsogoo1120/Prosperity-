<script setup>
import { scrollToLandingSection } from '@/composables/useLandingMotion.js'
import { services } from '@/data/union.js'
import UiIcon from '@/components/common/UiIcon.vue'
import CalmField from '@/components/common/CalmField.vue'
import ImageSlot from '@/components/common/ImageSlot.vue'
import profileImg from '../../../imgs.video/profile.jpg'

const emit = defineEmits(['book'])

const tarotService = services.find((service) => service.id === 'tarot')
const subscriptionService = services.find((service) => service.id === 'subscription')

function showSubscription() {
  scrollToLandingSection('intro')
}
</script>

<template>
  <section id="hero" class="grain landing-hero">
    <CalmField intense />

    <div class="mx-auto max-w-wrap grid-hero-landing hero-grid">
      <div class="hero-copy">
        <h1 class="hero-title rise d1">
          Your fav sacrastic <br />
          <em>tarot reader</em>
        </h1>

        <p class="hero-lead rise d2">
         Чиний амьдралд яг юу болоод байгаа юмбээ хамаёо. gwenchana?
        </p>

        <div class="hero-facts rise d3" aria-label="Уншлагын мэдээлэл">
          <span><UiIcon name="clock" :size="16" /> 30 минут</span>
          <span><UiIcon name="video" :size="16" /> video call</span>
        </div>

        <div class="hero-actions rise d3 btn-row btn-row--stack-mobile">
          <button class="btn btn-primary btn-lg" @click="emit('book')">
            Тарот уншлага авах
          </button>
          <button class="btn btn-ghost btn-lg" @click="showSubscription">
            Subscription үзэх <UiIcon name="chevDown" :size="18" />
          </button>
        </div>


      </div>

      <div class="pop d2 hero-visual">
        <div class="hero-visual__frame">
          <div class="hero-visual__gradient" />
          <ImageSlot
            id="union-hero"
            :src="profileImg"
            :radius="20"
            placeholder="Зураг"
            class="hero-visual__img"
          />
        </div>

        <button
          type="button"
          class="card rise d7 hero-float-card hero-float-card--subscription"
          @click="showSubscription"
        >
          <span class="hero-float-card__icon hero-float-card__icon--blue">
            <UiIcon name="book" :size="19" />
          </span>
          <span>
            <strong>Subscription</strong>
            <small> онлайн хичээл· {{ subscriptionService?.priceDisplay }}</small>
          </span>
          <UiIcon name="arrowRight" :size="16" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.landing-hero {
  position: relative;

  overflow: hidden;
}

.hero-title {
  margin: 0;

  font-size: clamp(40px, 5vw, 62px);

  line-height: 1.04;

  letter-spacing: -0.025em;
}

.hero-title em {
  font-style: italic;

  color: var(--clay);
}

.hero-lead {
  margin: 22px 0 0;

  max-width: 460px;

  font-size: 19px;

  line-height: 1.6;

  color: var(--ink-soft);
}

.hero-actions {
  margin-top: 32px;
}

.hero-kicker {
  margin-bottom: 16px;
}

.hero-facts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.hero-facts span,
.hero-facts strong {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--card) 76%, transparent);
  color: var(--ink-soft);
  font-size: 13.5px;
  line-height: 1;
}

.hero-facts strong {
  border-color: color-mix(in srgb, var(--clay) 35%, var(--line));
  background: var(--clay-tint);
  color: var(--clay-deep);
}

.hero-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 480px;
  margin-top: 18px;
  color: var(--sage-deep);
  font-size: 13.5px;
  line-height: 1.5;
}

.hero-note :deep(svg) {
  flex: none;
  margin-top: 2px;
}

.hero-metrics {
  display: flex;

  flex-wrap: wrap;

  align-items: flex-start;

  gap: 30px 36px;

  margin-top: 44px;
}

.hero-metric__value {
  font-family: var(--serif);

  font-size: 26px;

  font-weight: 600;

  line-height: 1.15;

  color: var(--ink);
}

.hero-metric__label {
  margin-top: 4px;

  font-size: 13.5px;

  line-height: 1.35;
}

.hero-visual {
  position: relative;

  min-height: 480px;
}

.hero-visual__frame {
  position: absolute;

  inset: 0 0 0 14%;

  border-radius: 20px;

  box-shadow: var(--sh-lg);

  overflow: hidden;
}

.hero-visual__gradient {
  position: absolute;

  inset: 0;

  background: linear-gradient(150deg, var(--primary), var(--sage-deep));
}

.hero-visual__img {
  position: absolute;

  inset: 0;

  height: 100%;
}

.hero-float-card {
  position: absolute;

  padding: 16px;

  border-radius: 16px;

  box-shadow: var(--sh-lg);
}

.hero-float-card--reading {
  left: -8px;
  top: 52px;
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 210px;
}

.hero-float-card--reading strong,
.hero-float-card--subscription strong {
  display: block;
  color: var(--ink);
  font-size: 14px;
}

.hero-float-card--reading p,
.hero-float-card--subscription small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}

.hero-float-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 11px;
  background: var(--clay-tint);
  color: var(--clay-deep);
}

.hero-float-card__icon--blue {
  background: var(--primary-tint);
  color: var(--primary-deep);
}

.hero-float-card--subscription {
  right: -10px;
  bottom: 38px;
  display: flex;
  align-items: center;
  gap: 11px;
  width: 260px;
  border: 1px solid var(--line);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.hero-float-card--subscription:hover {
  transform: translateY(-2px);
  box-shadow: 0 26px 64px rgba(22, 49, 63, 0.18);
}

.hero-float-card--subscription > span:nth-child(2) {
  flex: 1;
}

.hero-float-card--session {
  left: -8px;

  top: 54px;

  width: 244px;
}

.hero-float-card__head {
  margin-bottom: 10px;
}

.hero-booking-open {
  margin-top: 10px;
}

.hero-picker-scrim {
  position: fixed;

  inset: 0;

  z-index: 80;

  display: flex;

  align-items: center;

  justify-content: center;

  padding: 20px;

  background: rgba(11, 24, 30, 0.5);

  backdrop-filter: blur(4px);
}

.hero-picker {
  width: min(420px, 94vw);

  padding: 22px;

  border-radius: 20px;

  box-shadow: var(--sh-lg);
}

.hero-picker__head {
  margin-bottom: 18px;
}

.hero-picker__title {
  margin: 0;

  font-size: 20px;

  font-weight: 600;
}

.hero-picker__actions {
  display: flex;

  justify-content: flex-end;

  gap: 10px;

  margin-top: 22px;
}

.hero-booking-days {
  display: grid;

  grid-template-columns: repeat(5, 1fr);

  gap: 6px;

  margin-bottom: 10px;
}

.hero-booking-day {
  display: flex;

  flex-direction: column;

  align-items: center;

  gap: 2px;

  padding: 6px 0;

  border: 1.5px solid var(--line);

  border-radius: 10px;

  background: var(--card);

  cursor: pointer;

  transition:
    border-color 0.15s,
    background 0.15s;
}

.hero-booking-day:disabled {
  opacity: 0.45;

  cursor: not-allowed;
}

.hero-booking-day.is-selected {
  border-color: var(--primary);

  background: var(--primary-tint);

  color: var(--primary-deep);
}

.hero-booking-day__abbr {
  font-size: 10px;

  font-weight: 600;

  opacity: 0.75;
}

.hero-booking-day__num {
  font-size: 15px;

  font-family: var(--serif);

  font-weight: 600;

  line-height: 1;
}

.hero-booking-slots {
  display: grid;

  grid-template-columns: repeat(3, 1fr);

  gap: 6px;
}

.hero-booking-slot {
  padding: 7px 0;

  border: 1.5px solid var(--line);

  border-radius: 8px;

  background: var(--card);

  font-size: 12px;

  font-weight: 600;

  cursor: pointer;

  transition:
    border-color 0.15s,
    background 0.15s,
    color 0.15s;
}

.hero-booking-slot.is-selected {
  border-color: var(--clay);

  background: var(--clay);

  color: #fff;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.hero-booking-summary {
  margin: 0;

  font-size: 12.5px;

  line-height: 1.4;
}

.hero-float-card--progress {
  right: -10px;

  bottom: 40px;

  width: 220px;
}

.hero-float-card__head {
  margin-bottom: 12px;
}

@media (max-width: 767px) {
  .hero-grid {
    padding-inline: 16px;
  }

  .hero-copy {
    display: flex;

    flex-direction: column;
  }

  .hero-title {
    font-size: clamp(30px, 8.2vw, 40px);

    line-height: 1.1;

    letter-spacing: -0.02em;
  }

  .hero-lead {
    margin-top: 14px;

    font-size: 16px;

    line-height: 1.55;

    max-width: none;
  }

  .hero-actions {
    margin-top: 22px;

    gap: 10px;
  }

  .hero-actions :deep(.btn-lg) {
    padding-top: 15px;

    padding-bottom: 15px;
  }

  .hero-facts {
    margin-top: 20px;
    gap: 8px;
  }

  .hero-facts span,
  .hero-facts strong {
    font-size: 12.5px;
  }

  .hero-note {
    margin-top: 16px;
    font-size: 13px;
  }

  .hero-metrics {
    display: grid;

    grid-template-columns: repeat(3, minmax(0, 1fr));

    gap: 14px 10px;

    margin-top: 26px;

    padding-top: 22px;

    border-top: 1px solid var(--line-soft);

    width: 100%;
  }

  .hero-metric {
    min-width: 0;

    text-align: center;
  }

  .hero-metric__value {
    font-size: clamp(20px, 5.5vw, 24px);
  }

  .hero-metric__label {
    margin-top: 6px;

    font-size: 11.5px;

    line-height: 1.3;

    word-break: break-word;

    hyphens: auto;
  }

  .hero-visual {
    min-height: 0;

    margin-top: 8px;
  }

  .hero-visual__frame {
    position: relative;

    inset: auto;

    width: 100%;

    aspect-ratio: 4 / 5;

    max-height: 380px;

    margin: 0 auto;
  }

  .hero-float-card {
    position: relative;
    inset: auto;
    z-index: 2;
  }

  .hero-float-card--reading {
    width: calc(100% - 24px);
    margin: -28px 12px 0;
  }

  .hero-float-card--subscription {
    width: calc(100% - 24px);
    margin: 10px 12px 0;
  }
}

@media (max-width: 380px) {
  .hero-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    gap: 18px 12px;

    padding-top: 20px;

    margin-top: 24px;
  }

  .hero-metric:last-child {
    grid-column: 1 / -1;

    max-width: 168px;

    justify-self: center;
  }

  .hero-actions {
    margin-top: 20px;
  }

  .hero-lead {
    margin-top: 12px;
  }
}
</style>
