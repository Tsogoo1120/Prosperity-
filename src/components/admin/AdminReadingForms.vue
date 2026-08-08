<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import UiAvatar from '@/components/common/UiAvatar.vue'
import UiIcon from '@/components/common/UiIcon.vue'

const forms = ref([])
const loading = ref(true)
const errorMessage = ref('')
const search = ref('')
const status = ref('all')

const statusOptions = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['booked', 'Confirmed'],
  ['cancelled', 'Declined'],
]

const statusMeta = {
  pending: { label: 'Pending', className: 'warn' },
  booked: { label: 'Confirmed', className: 'good' },
  cancelled: { label: 'Declined', className: 'bad' },
}

function profileFor(form) {
  return Array.isArray(form.profiles) ? form.profiles[0] : form.profiles
}

const counts = computed(() => ({
  all: forms.value.length,
  pending: forms.value.filter((form) => form.status === 'pending').length,
  booked: forms.value.filter((form) => form.status === 'booked').length,
  cancelled: forms.value.filter((form) => form.status === 'cancelled').length,
}))

const filteredForms = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return forms.value.filter((form) => {
    if (status.value !== 'all' && form.status !== status.value) return false
    if (!term) return true
    const profile = profileFor(form)
    return [profile?.full_name, profile?.email, profile?.phone, form.description]
      .some((value) => String(value ?? '').toLocaleLowerCase().includes(term))
  })
})

async function loadForms() {
  loading.value = true
  errorMessage.value = ''
  const { data, error } = await supabase
    .from('coaching_slots')
    .select('id, start_at, end_at, status, service_type, description, created_at, profiles(full_name, email, phone, avatar_url)')
    .eq('service_type', 'tarot')
    .not('user_id', 'is', null)
    .order('start_at', { ascending: false })

  if (error) {
    errorMessage.value = error.message
    forms.value = []
  } else {
    forms.value = data ?? []
  }
  loading.value = false
}

function formatAppointment(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function phoneHref(phone) {
  return `tel:${String(phone ?? '').replace(/[^+\d]/g, '')}`
}

let realtimeChannel = null

onMounted(() => {
  loadForms()
  realtimeChannel = supabase
    .channel('admin-reading-forms')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_slots' }, loadForms)
    .subscribe()
})

onUnmounted(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<template>
  <div class="reading-forms scroll-y">
    <div class="page-inset reading-forms__inner">
      <div class="reading-forms__summary">
        <div class="card reading-forms__summary-card">
          <span>All forms</span>
          <strong>{{ counts.all }}</strong>
        </div>
        <div class="card reading-forms__summary-card reading-forms__summary-card--pending">
          <span>Needs review</span>
          <strong>{{ counts.pending }}</strong>
        </div>
        <div class="card reading-forms__summary-card reading-forms__summary-card--confirmed">
          <span>Confirmed</span>
          <strong>{{ counts.booked }}</strong>
        </div>
      </div>

      <div class="reading-forms__toolbar">
        <label class="reading-forms__search">
          <UiIcon name="search" :size="17" />
          <input v-model="search" type="search" placeholder="Search name, phone, email, or reading type" />
        </label>
        <button type="button" class="btn btn-ghost btn-sm" :disabled="loading" @click="loadForms">
          <UiIcon name="clock" :size="16" />
          Refresh
        </button>
      </div>

      <div class="reading-forms__filters" aria-label="Filter reading forms by status">
        <button
          v-for="[value, label] in statusOptions"
          :key="value"
          type="button"
          :class="{ 'is-active': status === value }"
          @click="status = value"
        >
          {{ label }} <span>{{ counts[value] }}</span>
        </button>
      </div>

      <div v-if="errorMessage" class="reading-forms__error">
        <UiIcon name="x" :size="18" />
        <span>{{ errorMessage }}</span>
        <button type="button" @click="loadForms">Try again</button>
      </div>

      <div v-else-if="loading" class="card reading-forms__state">
        <UiIcon name="clock" :size="24" />
        Loading reading forms…
      </div>

      <div v-else-if="!filteredForms.length" class="card reading-forms__state">
        <UiIcon name="note" :size="30" />
        <strong>No reading forms found</strong>
        <span>New personal-reading submissions will appear here.</span>
      </div>

      <div v-else class="card reading-forms__table-wrap">
        <table class="reading-forms__table">
          <thead>
            <tr>
              <th>User</th>
              <th>Phone number</th>
              <th>Email</th>
              <th>Reading type</th>
              <th>Appointment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="form in filteredForms" :key="form.id">
              <td data-label="User">
                <div class="reading-forms__user">
                  <UiAvatar :name="profileFor(form)?.full_name || profileFor(form)?.email || '?'" :size="38" />
                  <strong>{{ profileFor(form)?.full_name || 'No name' }}</strong>
                </div>
              </td>
              <td data-label="Phone number">
                <a v-if="profileFor(form)?.phone" :href="phoneHref(profileFor(form).phone)">
                  {{ profileFor(form).phone }}
                </a>
                <span v-else class="muted">—</span>
              </td>
              <td data-label="Email">
                <a v-if="profileFor(form)?.email" :href="`mailto:${profileFor(form).email}`">
                  {{ profileFor(form).email }}
                </a>
                <span v-else class="muted">—</span>
              </td>
              <td data-label="Reading type">
                <span class="reading-forms__type">{{ form.description || 'Personal reading' }}</span>
              </td>
              <td data-label="Appointment">{{ formatAppointment(form.start_at) }}</td>
              <td data-label="Status">
                <span :class="['chip', statusMeta[form.status]?.className]">
                  {{ statusMeta[form.status]?.label || form.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reading-forms {
  flex: 1;
  height: calc(100vh - 72px);
  overflow-y: auto;
}

.reading-forms__inner {
  max-width: 1180px;
}

.reading-forms__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.reading-forms__summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 19px;
  border-radius: 14px;
}

.reading-forms__summary-card span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

.reading-forms__summary-card strong {
  font-family: var(--serif);
  font-size: 27px;
}

.reading-forms__summary-card--pending strong { color: var(--warn); }
.reading-forms__summary-card--confirmed strong { color: var(--good); }

.reading-forms__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.reading-forms__search {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  color: var(--muted);
}

.reading-forms__search:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-tint);
}

.reading-forms__search input {
  width: 100%;
  padding: 11px 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 13.5px;
}

.reading-forms__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 16px;
}

.reading-forms__filters button {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 11px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
}

.reading-forms__filters button:hover,
.reading-forms__filters button.is-active {
  border-color: var(--line);
  background: var(--card);
  color: var(--ink);
}

.reading-forms__filters button span {
  min-width: 21px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface-2);
  text-align: center;
  font-size: 11px;
}

.reading-forms__error,
.reading-forms__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 170px;
  padding: 30px;
  border-radius: 14px;
  color: var(--muted);
  text-align: center;
}

.reading-forms__error {
  min-height: auto;
  justify-content: flex-start;
  margin-bottom: 16px;
  border-radius: 10px;
  background: var(--bad-tint);
  color: var(--bad);
  font-size: 13px;
}

.reading-forms__error button {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.reading-forms__state {
  flex-direction: column;
}

.reading-forms__state strong { color: var(--ink); }
.reading-forms__state span { font-size: 13px; }

.reading-forms__table-wrap {
  overflow-x: auto;
  border-radius: 14px;
}

.reading-forms__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.reading-forms__table th,
.reading-forms__table td {
  padding: 14px 15px;
  border-bottom: 1px solid var(--line-soft);
  text-align: left;
  vertical-align: middle;
}

.reading-forms__table th {
  background: var(--surface-2);
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.reading-forms__table tbody tr:last-child td { border-bottom: 0; }
.reading-forms__table tbody tr:hover { background: var(--surface-2); }

.reading-forms__table a {
  color: var(--primary-deep);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.reading-forms__table a:hover { text-decoration: underline; }

.reading-forms__user {
  min-width: 150px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.reading-forms__type {
  display: inline-block;
  max-width: 240px;
  font-weight: 600;
  line-height: 1.4;
}

@media (max-width: 760px) {
  .reading-forms__summary { grid-template-columns: 1fr; }
  .reading-forms__toolbar { align-items: stretch; }
  .reading-forms__search { min-width: 0; }

  .reading-forms__table-wrap {
    overflow: visible;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .reading-forms__table,
  .reading-forms__table tbody,
  .reading-forms__table tr,
  .reading-forms__table td { display: block; }

  .reading-forms__table thead { display: none; }

  .reading-forms__table tbody {
    display: grid;
    gap: 10px;
  }

  .reading-forms__table tr {
    padding: 12px 15px;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: var(--card);
  }

  .reading-forms__table td {
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 7px 0;
    border-bottom: 1px solid var(--line-soft);
    text-align: right;
  }

  .reading-forms__table td::before {
    content: attr(data-label);
    flex: none;
    color: var(--muted);
    font-size: 11.5px;
    font-weight: 700;
  }

  .reading-forms__table td:first-child {
    justify-content: flex-start;
    padding-bottom: 12px;
  }

  .reading-forms__table td:first-child::before { display: none; }
  .reading-forms__table td:last-child { border-bottom: 0; }
  .reading-forms__type { max-width: 62%; }
}

@media (max-width: 480px) {
  .reading-forms__toolbar { flex-direction: column; }
}
</style>
