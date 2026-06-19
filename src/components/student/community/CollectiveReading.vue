<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuth } from '@/composables/useAuth.js'
import { getPublicImageUrl } from '@/lib/videoUpload.js'
import UiIcon from '@/components/common/UiIcon.vue'

const { session } = useAuth()

const loading = ref(true)
const reading = ref(null)
const piles = ref([])
const pick = ref(null)
const revealing = ref(false)
const saving = ref(false)

async function load() {
  loading.value = true
  // Latest published reading
  const { data: r } = await supabase
    .from('collective_readings')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  reading.value = r ?? null
  piles.value = []
  pick.value = null

  if (r) {
    const { data: p } = await supabase
      .from('reading_piles')
      .select('*')
      .eq('reading_id', r.id)
      .order('position', { ascending: true })
    piles.value = p ?? []

    if (session.value) {
      const { data: existing } = await supabase
        .from('reading_picks')
        .select('*')
        .eq('reading_id', r.id)
        .eq('user_id', session.value.user.id)
        .maybeSingle()
      pick.value = existing ?? null
    }
  }
  loading.value = false
}

onMounted(load)

const pickedPile = computed(() =>
  pick.value ? piles.value.find((p) => p.id === pick.value.pile_id) ?? null : null,
)

async function choose(pile) {
  if (!session.value || saving.value) return
  saving.value = true
  revealing.value = true
  const row = {
    reading_id: reading.value.id,
    pile_id: pile.id,
    user_id: session.value.user.id,
  }
  const { data, error } = await supabase
    .from('reading_picks')
    .upsert(row, { onConflict: 'reading_id,user_id' })
    .select()
    .maybeSingle()
  if (!error) pick.value = data ?? row
  // brief flip animation window
  setTimeout(() => { revealing.value = false }, 450)
  saving.value = false
}

function reset() {
  // let user pick a different pile (overwrites their previous pick)
  pick.value = null
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="muted" style="text-align: center; padding: 48px 24px; font-size: 14px">
      Loading reading…
    </div>

    <!-- No active reading -->
    <div
      v-else-if="!reading"
      class="card card-pad rise"
      style="border-radius: 16px; text-align: center; padding: 48px 24px"
    >
      <UiIcon name="moon" :size="40" style="color: var(--faint); margin-bottom: 12px" />
      <h3 style="font-size: 17px; margin-bottom: 6px">No reading yet</h3>
      <p class="muted" style="font-size: 14px">A new collective reading will appear here soon.</p>
    </div>

    <template v-else>
      <!-- Intro -->
      <div
        class="card rise"
        style="border-radius: 18px; padding: 26px 28px; margin-bottom: 22px; background: linear-gradient(135deg, var(--primary-tint), var(--card)); position: relative; overflow: hidden"
      >
        <div class="flex items-center" style="gap: 12px; margin-bottom: 10px">
          <div style="width: 46px; height: 46px; border-radius: 12px; background: var(--primary-tint); color: var(--primary-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0">
            <UiIcon name="spark" :size="24" />
          </div>
          <h3 style="font-size: 21px; font-family: var(--serif)">{{ reading.title }}</h3>
        </div>
        <p v-if="reading.intro" class="muted" style="font-size: 15px; line-height: 1.6">
          {{ reading.intro }}
        </p>
        <p v-if="!pickedPile" style="font-size: 14px; color: var(--primary-deep); margin-top: 14px; font-weight: 600">
          Breathe, set an intention, then choose the pile you're drawn to.
        </p>
      </div>

      <!-- Pick state: 3 face-down piles -->
      <div
        v-if="!pickedPile"
        class="reading-grid"
      >
        <button
          v-for="(pile, i) in piles"
          :key="pile.id"
          class="pile-card rise"
          :style="{ animationDelay: i * 0.07 + 's', cursor: saving ? 'wait' : 'pointer' }"
          :disabled="saving"
          @click="choose(pile)"
        >
          <div class="pile-face">
            <img
              v-if="pile.image_path"
              :src="getPublicImageUrl(pile.image_path)"
              alt=""
              class="pile-img"
            />
            <div v-else class="pile-placeholder">
              <UiIcon name="layers" :size="34" />
            </div>
            <div class="pile-veil">
              <UiIcon name="moon" :size="26" />
              <span class="pile-num">Pile {{ pile.position }}</span>
            </div>
          </div>
          <div class="pile-label">{{ pile.label || `Pile ${pile.position}` }}</div>
        </button>
      </div>

      <!-- Revealed state -->
      <div v-else class="card rise" :class="{ 'flip-in': revealing }" style="border-radius: 18px; overflow: hidden">
        <div
          v-if="pickedPile.image_path"
          style="aspect-ratio: 21/9; overflow: hidden; background: var(--surface-2)"
        >
          <img
            :src="getPublicImageUrl(pickedPile.image_path)"
            alt=""
            style="width: 100%; height: 100%; object-fit: cover; display: block"
          />
        </div>
        <div style="padding: 24px 26px 26px">
          <div class="flex items-center" style="gap: 8px; margin-bottom: 12px">
            <span class="chip clay" style="font-size: 12px">Your pile</span>
            <h3 style="font-size: 20px; font-family: var(--serif)">
              {{ pickedPile.label || `Pile ${pickedPile.position}` }}
            </h3>
          </div>
          <p style="font-size: 15.5px; color: var(--ink-soft); line-height: 1.7; white-space: pre-wrap">{{ pickedPile.article }}</p>

          <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line)">
            <button class="btn btn-ghost btn-sm" @click="reset">
              <UiIcon name="layers" :size="15" /> Choose a different pile
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.reading-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 560px) {
  .reading-grid { grid-template-columns: 1fr; max-width: 240px; margin-inline: auto; }
}
.pile-card {
  border: none;
  background: transparent;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: center;
}
.pile-face {
  position: relative;
  aspect-ratio: 2/3;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(160deg, var(--primary-deep, #3a3a55), #1a1a2e);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}
.pile-card:hover:not(:disabled) .pile-face {
  transform: translateY(-6px) rotate(-1deg);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.26);
}
.pile-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.55;
}
.pile-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.4);
}
.pile-veil {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.92);
  background: radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.32));
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 16px;
}
.pile-num {
  font-size: 13px;
  letter-spacing: 0.04em;
  font-weight: 600;
}
.pile-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}
.flip-in {
  animation: flipIn 0.45s ease;
}
@keyframes flipIn {
  from { opacity: 0; transform: rotateY(12deg) scale(0.98); }
  to { opacity: 1; transform: none; }
}
</style>
