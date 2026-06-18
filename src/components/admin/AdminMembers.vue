<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase.js'
import UiIcon from '@/components/common/UiIcon.vue'
import UiAvatar from '@/components/common/UiAvatar.vue'

const members = ref([])
const loading = ref(true)
const filter = ref('active')
const extendingId = ref(null)
const bulkExtending = ref(false)
const err = ref('')

const STATUS = {
  active:  { c: 'good', t: 'Идэвхтэй' },
  pending: { c: 'warn', t: 'Хүлээгдэж байна' },
  denied:  { c: 'bad',  t: 'Татгалзсан' },
}

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, subscription_status, subscription_expires_at')
    .not('subscription_status', 'is', null)
    .order('subscription_expires_at', { ascending: false })
  members.value = data ?? []
  loading.value = false
}

onMounted(load)

const filtered = computed(() => {
  if (filter.value === 'all') return members.value
  if (filter.value === 'expired') {
    const now = new Date()
    return members.value.filter(m =>
      m.subscription_status === 'active' && m.subscription_expires_at && new Date(m.subscription_expires_at) <= now
    )
  }
  return members.value.filter(m => m.subscription_status === filter.value)
})

const activeCount = computed(() => members.value.filter(m => {
  if (m.subscription_status !== 'active') return false
  if (!m.subscription_expires_at) return true
  return new Date(m.subscription_expires_at) > new Date()
}).length)

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function isExpired(member) {
  if (!member.subscription_expires_at) return false
  return new Date(member.subscription_expires_at) <= new Date()
}

function newExpiry(member) {
  const now = new Date()
  const existing = member.subscription_expires_at ? new Date(member.subscription_expires_at) : null
  const base = existing && existing > now ? existing : now
  return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)
}

async function extendOne(member) {
  extendingId.value = member.id
  err.value = ''
  const expiry = newExpiry(member)
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: 'active', subscription_expires_at: expiry.toISOString(), expiry_reminder_stage: 0 })
    .eq('id', member.id)
  if (error) err.value = error.message
  extendingId.value = null
  await load()
}

async function extendAllActive() {
  bulkExtending.value = true
  err.value = ''
  const actives = members.value.filter(m => m.subscription_status === 'active')
  const results = await Promise.all(actives.map(m => {
    const expiry = newExpiry(m)
    return supabase
      .from('profiles')
      .update({ subscription_status: 'active', subscription_expires_at: expiry.toISOString(), expiry_reminder_stage: 0 })
      .eq('id', m.id)
  }))
  const failed = results.filter(r => r.error)
  if (failed.length) err.value = `${failed.length} хэрэглэгчид алдаа гарлаа`
  bulkExtending.value = false
  await load()
}
</script>

<template>
  <div class="scroll-y" style="flex: 1; overflow-y: auto">
    <div class="page-inset" style="max-width: 860px">

      <!-- Topbar -->
      <div class="flex flex-wrap items-center justify-between" style="margin-bottom: 22px; gap: 12px">
        <!-- Filter tabs -->
        <div class="flex items-center" style="gap: 4px; background: var(--surface-2); border-radius: 10px; padding: 4px">
          <button
            v-for="[id, lbl] in [['active', 'Идэвхтэй'], ['pending', 'Хүлээгдэж байна'], ['expired', 'Дууссан'], ['all', 'Бүгд']]"
            :key="id"
            class="flex items-center"
            :style="{
              gap: '6px', padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background: filter === id ? 'var(--card)' : 'transparent',
              color: filter === id ? 'var(--ink)' : 'var(--muted)',
              fontWeight: 600, fontSize: '13px',
              boxShadow: filter === id ? 'var(--sh-sm)' : 'none',
            }"
            @click="filter = id"
          >{{ lbl }}</button>
        </div>

        <!-- Bulk extend -->
        <button
          class="btn btn-primary btn-sm"
          :disabled="bulkExtending || activeCount === 0"
          @click="extendAllActive"
        >
          <UiIcon name="star" :size="15" />
          {{ bulkExtending ? 'Уншиж байна…' : `Бүгдийг +1 сар сунгах (${activeCount})` }}
        </button>
      </div>

      <!-- Error -->
      <div
        v-if="err"
        style="margin-bottom: 14px; padding: 12px 16px; background: var(--bad-tint); border-radius: 10px; font-size: 13.5px; color: var(--bad)"
      >{{ err }}</div>

      <!-- Loading -->
      <div v-if="loading" style="padding: 48px; text-align: center; color: var(--muted)">
        <UiIcon name="clock" :size="22" style="display: block; margin: 0 auto 8px; opacity: 0.35" />
        Уншиж байна…
      </div>

      <!-- Empty -->
      <div
        v-else-if="!filtered.length"
        class="card card-pad"
        style="border-radius: 16px; text-align: center; padding: 56px; color: var(--muted)"
      >
        <UiIcon name="users" :size="36" style="display: block; margin: 0 auto 14px; opacity: 0.25" />
        <p style="font-size: 15px">Гишүүн байхгүй байна.</p>
      </div>

      <!-- Member rows -->
      <div v-else class="flex flex-col" style="gap: 8px">
        <div
          v-for="m in filtered"
          :key="m.id"
          class="card flex flex-wrap items-center"
          style="border-radius: 14px; padding: 14px 20px; gap: 14px"
        >
          <!-- Avatar + name -->
          <div class="flex items-center" style="gap: 12px; flex: 1; min-width: 200px">
            <UiAvatar :name="m.full_name || m.email || '?'" :size="42" />
            <div>
              <div style="font-weight: 600; font-size: 14.5px">{{ m.full_name || '—' }}</div>
              <div class="muted" style="font-size: 12.5px">{{ m.email }}</div>
            </div>
          </div>

          <!-- Status -->
          <div style="min-width: 110px">
            <span
              :class="'chip ' + (isExpired(m) ? 'bad' : (STATUS[m.subscription_status]?.c || 'warn'))"
              style="font-size: 12px"
            >
              {{ isExpired(m) ? 'Дууссан' : (STATUS[m.subscription_status]?.t || m.subscription_status) }}
            </span>
          </div>

          <!-- Expiry -->
          <div style="min-width: 140px">
            <div class="muted" style="font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px">Дуусах огноо</div>
            <div style="font-size: 13.5px; font-weight: 600">{{ fmtDate(m.subscription_expires_at) }}</div>
          </div>

          <!-- Extend button -->
          <button
            class="btn btn-ghost btn-sm"
            :disabled="extendingId === m.id"
            @click="extendOne(m)"
          >
            <UiIcon name="plus" :size="15" />
            {{ extendingId === m.id ? '…' : '+1 сар' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
