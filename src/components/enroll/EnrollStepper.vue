<script setup>
import UiIcon from '@/components/common/UiIcon.vue'

defineProps({
  steps: { type: Array, required: true },
  active: { type: Number, required: true },
})
</script>

<template>
  <div class="enroll-stepper">
    <div class="enroll-stepper__track">
      <template v-for="(s, i) in steps" :key="s">
        <div
          class="step-item"
          :class="{
            'is-active': i === active,
            'is-done': i < active,
            'is-upcoming': i > active,
          }"
        >
          <div class="step-circle">
            <UiIcon v-if="i < active" name="check" :size="16" />
            <template v-else>{{ i + 1 }}</template>
          </div>
          <span class="step-label">{{ s }}</span>
        </div>
        <div
          v-if="i < steps.length - 1"
          class="step-connector"
          :class="{ 'is-done': i < active }"
          aria-hidden="true"
        />
      </template>
    </div>
    <p class="step-mobile-label">{{ steps[active] }}</p>
  </div>
</template>

<style scoped>
.enroll-stepper {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.enroll-stepper__track {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  min-width: 0;
}

.step-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13.5px;
  transition: background 0.3s, color 0.3s;
}

.step-item.is-done .step-circle {
  background: var(--sage-deep);
  color: #fff;
}

.step-item.is-active .step-circle {
  background: var(--clay);
  color: #fff;
}

.step-item.is-upcoming .step-circle {
  background: var(--surface-3);
  color: var(--faint);
}

.step-label {
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  transition: color 0.3s;
}

.step-item.is-done .step-label,
.step-item.is-active .step-label {
  color: var(--ink);
}

.step-item.is-upcoming .step-label {
  color: var(--faint);
}

.step-connector {
  flex: 1;
  min-width: 12px;
  height: 2px;
  margin: 0 10px;
  background: var(--line);
  transition: background 0.3s;
}

.step-connector.is-done {
  background: var(--sage-deep);
}

.step-mobile-label {
  display: none;
  margin: 0;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.01em;
}

@media (min-width: 1024px) {
  .step-connector {
    margin: 0 14px;
  }
}

@media (max-width: 1023px) and (min-width: 768px) {
  .step-label {
    font-size: 12.5px;
  }

  .step-connector {
    margin: 0 8px;
    min-width: 8px;
  }
}

@media (max-width: 767px) {
  .enroll-stepper {
    gap: 10px;
  }

  .enroll-stepper__track {
    justify-content: space-between;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding: 2px 0;
  }

  .enroll-stepper__track::-webkit-scrollbar {
    display: none;
  }

  .step-label {
    display: none;
  }

  .step-connector {
    flex: 1;
    min-width: 6px;
    margin: 0 4px;
  }

  .step-item {
    flex: 0 0 auto;
  }

  .step-circle {
    width: 34px;
    height: 34px;
  }

  .step-mobile-label {
    display: block;
  }
}
</style>
