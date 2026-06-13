<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { formatBookingSummary } from "@/data/booking-calendar.js";
import { supabase } from "@/lib/supabase.js";

import UiIcon from "@/components/common/UiIcon.vue";

import UiRing from "@/components/common/UiRing.vue";

import CalmField from "@/components/common/CalmField.vue";

import ImageSlot from "@/components/common/ImageSlot.vue";

import profileImg from "../../../imgs.video/profile.jpg";

const emit = defineEmits(["nav"]);

const bookDate = ref(null);
const bookSlot = ref(null);
const pickerOpen = ref(false);

const rawSlots = ref([]);

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayMap = computed(() => {
  const map = {};
  for (const s of rawSlots.value) {
    // Hero section booking is for "Хувийн уншлага" (Tarot)
    if (s.service_type !== 'tarot_reading') continue;

    const iso = s.start_at.slice(0, 10);
    if (!map[iso]) {
      const d = new Date(s.start_at);
      map[iso] = { iso, d: DAY_NAMES[d.getDay()], n: d.getDate(), items: [] };
    }
    const d = new Date(s.start_at);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    map[iso].items.push({ id: s.id, time: `${hh}:${mm}` });
  }
  return map;
});

const availDays = computed(() => Object.values(dayMap.value));

const currentSlotTimes = computed(() => {
  if (!bookDate.value?.iso) return [];
  return dayMap.value[bookDate.value.iso]?.items.map((i) => i.time) ?? [];
});

async function loadAvailableSlots() {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, service_type')
    .eq('status', 'available')
    .is('user_id', null)
    .gte('start_at', now)
    .order('start_at', { ascending: true });
  rawSlots.value = data ?? [];
}

watch(availDays, (days) => {
  if (days.length && !bookDate.value) bookDate.value = days[0];
});

let realtimeChannel = null;

onMounted(() => {
  loadAvailableSlots();
  realtimeChannel = supabase
    .channel('hero-available-slots')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_slots' }, loadAvailableSlots)
    .subscribe();
});

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
});

const bookingSummary = computed(() =>
  formatBookingSummary(bookDate.value, bookSlot.value),
);

const hasBooking = computed(
  () => Boolean(bookDate.value && bookSlot.value),
);

function openPicker() {
  pickerOpen.value = true;
}

function closePicker() {
  pickerOpen.value = false;
}

function confirmPicker() {
  if (!hasBooking.value) return;
  closePicker();
}

function goEnrollPayment() {
  const intent = { serviceId: "tarot" };
  if (bookDate.value && bookSlot.value) {
    intent.bookDate = { d: bookDate.value.d, n: bookDate.value.n };
    intent.bookSlot = bookSlot.value;
  }
  sessionStorage.setItem("union-enroll-intent", JSON.stringify(intent));
  emit("nav", "enroll");
}

function onPrimaryClick() {
  if (!hasBooking.value) {
    openPicker();
    return;
  }
  goEnrollPayment();
}
</script>

<template>
  <section id="hero" class="grain landing-hero">
    <CalmField intense />

    <div class="mx-auto max-w-wrap grid-hero-landing hero-grid">
      <div class="hero-copy">
        <h1 class="hero-title rise d1">
          Existence precedes<br />

          <em>essence</em>
        </h1>

        <p class="hero-lead rise d2">
          Энэ нь чи хэн байх нь чухал биш харин цаашид өөрийн сонголтоор хэн
          болох нь чухал гэсэн санааг илэрхийлдэг.
        </p>

        <div class="hero-actions rise d3 btn-row btn-row--stack-mobile">
          <button class="btn btn-primary btn-lg" @click="onPrimaryClick">
            <UiIcon name="calendar" :size="19" /> Хувийн уншлага цаг захиалах
          </button>

          <button class="btn btn-ghost btn-lg" @click="emit('nav', 'enroll')">
            Subscription авах <UiIcon name="arrowRight" :size="18" />
          </button>
        </div>

        <div class="hero-metrics rise d4" role="list">
          <div
            v-for="[n, l] in metrics"
            :key="l"
            class="hero-metric"
            role="listitem"
          >
            <div class="hero-metric__value">{{ n }}</div>

            <div class="hero-metric__label muted">{{ l }}</div>
          </div>
        </div>
      </div>

      <div class="pop d2 hero-visual">
        <div class="hero-visual__frame">
          <div class="hero-visual__gradient" />

          <ImageSlot
            id="union-hero"
            :src="profileImg"
            :radius="20"
            placeholder="Drop a calm portrait / nature image"
            class="hero-visual__img"
          />
        </div>



        <div class="card rise d7 hero-float-card hero-float-card--progress">
          <div class="flex items-center" style="gap: 13px">
            <UiRing :value="0.42" :size="50" :stroke="5" />

            <div>
              <div style="font-weight: 600; font-size: 14px">
                Онлайн хичээлүүд
              </div>

              <div class="muted" style="font-size: 12.5px">6 of 14 lessons</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="pickerOpen"
        class="hero-picker-scrim"
        @click="closePicker"
      >
        <div class="card pop hero-picker" @click.stop>
          <div class="flex items-center justify-between hero-picker__head">
            <h3 class="hero-picker__title">Цаг захиалах</h3>
            <button
              type="button"
              class="btn btn-quiet"
              style="padding: 8px"
              aria-label="Хаах"
              @click="closePicker"
            >
              <UiIcon name="x" :size="18" />
            </button>
          </div>

          <p class="kicker cool" style="margin-bottom: 12px">Өдөр сонгох</p>
          <div v-if="availDays.length" class="hero-booking-days">
            <button
              v-for="day in availDays"
              :key="day.iso"
              type="button"
              class="hero-booking-day"
              :class="{ 'is-selected': bookDate?.iso === day.iso }"
              @click="bookDate = day; bookSlot = null"
            >
              <span class="hero-booking-day__abbr">{{ day.d }}</span>
              <span class="hero-booking-day__num">{{ day.n }}</span>
            </button>
          </div>
          <p v-else class="muted" style="font-size: 13px; margin-bottom: 18px">Одоогоор боломжит цаг байхгүй байна.</p>

          <p class="kicker cool" style="margin: 18px 0 12px">Боломжит цаг</p>
          <div v-if="currentSlotTimes.length" class="hero-booking-slots">
            <button
              v-for="slot in currentSlotTimes"
              :key="slot"
              type="button"
              class="hero-booking-slot"
              :class="{ 'is-selected': bookSlot === slot }"
              @click="bookSlot = slot"
            >
              {{ slot }}
            </button>
          </div>
          <p v-else-if="bookDate" class="muted" style="font-size: 13px">Энэ өдөрт боломжит цаг байхгүй.</p>

          <div class="hero-picker__actions">
            <button
              type="button"
              class="btn btn-ghost"
              @click="closePicker"
            >
              Цуцлах
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!hasBooking"
              @click="confirmPicker"
            >
              Болсон
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
