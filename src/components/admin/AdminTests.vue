<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase.js'
import UiIcon from '@/components/common/UiIcon.vue'

const list = ref([])
const loading = ref(true)
const mode = ref('list')        // 'list' | 'form' | 'questions'
const editId = ref(null)
const saving = ref(false)
const formError = ref('')
const confirmDel = ref(null)
const activeTest = ref(null)    // for question editor

const blank = () => ({ title: '', slug: '', description: '', is_published: false })
const form = ref(blank())

// Raw JSON editors
const questionsJson = ref('[]')
const scoringJson = ref('{"ranges":[]}')
const jsonError = ref('')

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('psychology_tests')
    .select('id, slug, title, description, is_published, published_at, questions, scoring_rules, created_at')
    .order('created_at', { ascending: false })
  list.value = data ?? []
  loading.value = false
}

function startAdd() {
  form.value = blank()
  editId.value = null
  mode.value = 'form'
  formError.value = ''
}

function startEdit(t) {
  form.value = { title: t.title, slug: t.slug, description: t.description ?? '', is_published: t.is_published }
  editId.value = t.id
  mode.value = 'form'
  formError.value = ''
}

function openQuestions(t) {
  activeTest.value = t
  questionsJson.value = JSON.stringify(t.questions ?? [], null, 2)
  scoringJson.value = JSON.stringify(t.scoring_rules ?? { ranges: [] }, null, 2)
  jsonError.value = ''
  mode.value = 'questions'
}

watch(() => form.value.title, (t) => {
  if (!editId.value) {
    form.value.slug = t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60)
  }
})

async function saveInfo() {
  if (!form.value.title.trim() || !form.value.slug.trim()) {
    formError.value = 'Гарчиг болон slug шаардлагатай'
    return
  }
  saving.value = true
  formError.value = ''

  const payload = {
    title: form.value.title.trim(),
    slug: form.value.slug.trim(),
    description: form.value.description.trim() || null,
    is_published: form.value.is_published,
    published_at: form.value.is_published ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }

  const { error: err } = editId.value
    ? await supabase.from('psychology_tests').update(payload).eq('id', editId.value)
    : await supabase.from('psychology_tests').insert({ ...payload, questions: [], scoring_rules: { ranges: [] } })

  if (err) {
    formError.value = err.message
  } else {
    mode.value = 'list'
    await load()
  }
  saving.value = false
}

async function saveQuestions() {
  jsonError.value = ''
  let parsedQ, parsedS
  try { parsedQ = JSON.parse(questionsJson.value) } catch { jsonError.value = 'Questions JSON алдаатай байна'; return }
  try { parsedS = JSON.parse(scoringJson.value) } catch { jsonError.value = 'Scoring rules JSON алдаатай байна'; return }

  saving.value = true
  const { error: err } = await supabase
    .from('psychology_tests')
    .update({ questions: parsedQ, scoring_rules: parsedS, updated_at: new Date().toISOString() })
    .eq('id', activeTest.value.id)

  if (err) {
    jsonError.value = err.message
  } else {
    mode.value = 'list'
    await load()
  }
  saving.value = false
}

async function togglePublish(t) {
  const now = new Date().toISOString()
  await supabase.from('psychology_tests').update({
    is_published: !t.is_published,
    published_at: !t.is_published ? now : null,
    updated_at: now,
  }).eq('id', t.id)
  await load()
}

async function del(id) {
  await supabase.from('psychology_tests').delete().eq('id', id)
  confirmDel.value = null
  await load()
}

function qCount(t) { return t.questions?.length ?? 0 }

const exampleQuestions = computed(() => JSON.stringify([
  {
    id: 'q1',
    text: 'Асуулт текст энд',
    options: [
      { id: 'q1_a', text: 'Хариулт A', value: 1 },
      { id: 'q1_b', text: 'Хариулт B', value: 2 },
      { id: 'q1_c', text: 'Хариулт C', value: 3 },
    ],
  },
], null, 2))

const exampleScoring = computed(() => JSON.stringify({
  ranges: [
    { min: 0, max: 10, result: 'Бага оноо — тайлбар' },
    { min: 11, max: 20, result: 'Дунд оноо — тайлбар' },
    { min: 21, max: 30, result: 'Өндөр оноо — тайлбар' },
  ],
}, null, 2))

onMounted(load)
</script>

<template>
  <!-- ───── LIST ───── -->
  <div v-if="mode === 'list'" class="scroll-y" style="flex: 1; height: calc(100vh - 72px); overflow-y: auto">
    <div class="page-inset">
      <div class="flex items-center justify-between" style="margin-bottom: 24px">
        <div>
          <h2 style="font-size: 22px">Сэтгэл зүйн тестүүд</h2>
          <p class="muted" style="font-size: 14px; margin-top: 4px">{{ list.length }} тест нийт</p>
        </div>
        <button class="btn btn-primary btn-sm" @click="startAdd">
          <UiIcon name="plus" :size="16" /> Тест нэмэх
        </button>
      </div>

      <div v-if="loading" style="padding: 48px; text-align: center; color: var(--muted)">
        <UiIcon name="clock" :size="22" style="display: block; margin: 0 auto 8px; opacity: 0.35" />
        Уншиж байна…
      </div>

      <div v-else-if="!list.length" class="card card-pad" style="border-radius: 16px; text-align: center; padding: 56px; color: var(--muted)">
        <UiIcon name="compass" :size="36" style="display: block; margin: 0 auto 14px; opacity: 0.25" />
        <p style="margin-bottom: 18px; font-size: 15px">Тест байхгүй байна.</p>
        <button class="btn btn-primary btn-sm" style="margin: 0 auto" @click="startAdd">
          <UiIcon name="plus" :size="16" /> Тест нэмэх
        </button>
      </div>

      <div v-else class="flex flex-col" style="gap: 14px">
        <div
          v-for="t in list"
          :key="t.id"
          class="card"
          style="border-radius: 14px; padding: 18px 22px; display: flex; align-items: center; gap: 16px"
        >
          <div
            :style="{
              width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
              background: t.is_published ? 'var(--primary-tint)' : 'var(--surface-2)',
              color: t.is_published ? 'var(--primary)' : 'var(--faint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }"
          >
            <UiIcon name="compass" :size="24" />
          </div>
          <div style="flex: 1; min-width: 0">
            <div style="font-weight: 600; font-size: 15.5px; margin-bottom: 3px">{{ t.title }}</div>
            <div class="muted" style="font-size: 13px">{{ qCount(t) }} асуулт · {{ t.slug }}</div>
          </div>
          <button
            :class="t.is_published ? 'chip good' : 'chip'"
            style="cursor: pointer; border: none; font-size: 12px; flex-shrink: 0"
            @click="togglePublish(t)"
          >
            {{ t.is_published ? 'Нийтэлсэн' : 'Хаалттай' }}
          </button>
          <div class="flex items-center" style="gap: 6px; flex-shrink: 0">
            <button class="btn btn-soft btn-sm" style="padding: 8px 12px; font-size: 12.5px" @click="openQuestions(t)">
              <UiIcon name="layers" :size="14" /> Асуултууд
            </button>
            <button class="btn btn-ghost btn-sm" style="padding: 8px" title="Засварлах" @click="startEdit(t)">
              <UiIcon name="pen" :size="15" />
            </button>
            <button
              class="btn btn-ghost btn-sm"
              style="padding: 8px; color: var(--bad); border-color: var(--bad-tint)"
              title="Устгах"
              @click="confirmDel = t.id"
            >
              <UiIcon name="x" :size="15" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- confirm delete -->
    <div
      v-if="confirmDel"
      style="position: fixed; inset: 0; background: rgba(22,49,63,0.45); display: flex; align-items: center; justify-content: center; z-index: 200"
      @click.self="confirmDel = null"
    >
      <div class="card card-pad" style="border-radius: 18px; max-width: 380px; width: 90%">
        <h3 style="font-size: 18px; margin-bottom: 10px">Устгах уу?</h3>
        <p class="muted" style="font-size: 14px; margin-bottom: 22px; line-height: 1.5">
          Тест болон бүх хариултуудыг устгана. Буцааж сэргээх боломжгүй.
        </p>
        <div class="flex items-center" style="gap: 10px">
          <button class="btn btn-sm" style="background: var(--bad); color: #fff" @click="del(confirmDel)">
            <UiIcon name="x" :size="15" /> Устгах
          </button>
          <button class="btn btn-ghost btn-sm" @click="confirmDel = null">Болих</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ───── ADD / EDIT FORM ───── -->
  <div v-else-if="mode === 'form'" class="scroll-y" style="flex: 1; height: calc(100vh - 72px); overflow-y: auto">
    <div class="page-inset" style="max-width: 640px">
      <button class="btn btn-ghost btn-sm" style="margin-bottom: 20px" @click="mode = 'list'">
        <UiIcon name="arrowLeft" :size="16" /> Буцах
      </button>
      <h2 style="font-size: 22px; margin-bottom: 22px">{{ editId ? 'Тест засварлах' : 'Шинэ тест' }}</h2>

      <div class="card card-pad" style="border-radius: 16px">
        <div style="display: grid; gap: 16px">
          <div class="field">
            <label>Гарчиг *</label>
            <input v-model="form.title" class="input" placeholder="Тестийн нэр" />
          </div>
          <div class="field">
            <label>Slug *</label>
            <input v-model="form.slug" class="input" placeholder="testiin-slug" />
          </div>
          <div class="field">
            <label>Тайлбар</label>
            <textarea v-model="form.description" class="input textarea" rows="4" placeholder="Тестийн зорилго, товч тайлбар…" style="resize: vertical" />
          </div>
          <label class="flex items-center" style="gap: 10px; cursor: pointer; font-size: 14px">
            <input type="checkbox" v-model="form.is_published" style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--sage-deep)" />
            Нийтлэх — идэвхтэй гишүүдэд харагдана
          </label>
        </div>
        <div v-if="formError" style="color: var(--bad); font-size: 13.5px; margin-top: 14px">{{ formError }}</div>
        <div class="flex items-center" style="gap: 10px; margin-top: 20px">
          <button class="btn btn-primary btn-sm" :disabled="saving" @click="saveInfo">
            {{ saving ? 'Хадгалж байна…' : 'Хадгалах' }}
          </button>
          <button class="btn btn-ghost btn-sm" @click="mode = 'list'">Болих</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ───── QUESTION EDITOR ───── -->
  <div v-else-if="mode === 'questions'" class="scroll-y" style="flex: 1; height: calc(100vh - 72px); overflow-y: auto">
    <div class="page-inset">
      <button class="btn btn-ghost btn-sm" style="margin-bottom: 20px" @click="mode = 'list'">
        <UiIcon name="arrowLeft" :size="16" /> Буцах
      </button>
      <h2 style="font-size: 22px; margin-bottom: 6px">{{ activeTest?.title }}</h2>
      <p class="muted" style="font-size: 14px; margin-bottom: 24px">Асуулт болон оноолтын тохиргоо</p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start">
        <!-- questions JSON -->
        <div class="card card-pad" style="border-radius: 16px">
          <div class="flex items-center justify-between" style="margin-bottom: 14px">
            <h3 style="font-size: 16px">Асуултууд (JSON)</h3>
            <button
              class="btn btn-ghost btn-sm"
              style="font-size: 12px"
              @click="questionsJson = exampleQuestions"
            >
              <UiIcon name="doc" :size="14" /> Жишээ
            </button>
          </div>
          <p class="muted" style="font-size: 12.5px; margin-bottom: 10px; line-height: 1.5">
            Формат: <code>[{"id":"q1","text":"...","options":[{"id":"q1_a","text":"...","value":1}]}]</code>
          </p>
          <textarea
            v-model="questionsJson"
            class="input textarea"
            rows="22"
            style="font-family: monospace; font-size: 12px; resize: vertical; line-height: 1.4"
            placeholder="JSON асуултуудыг энд оруулна уу"
          />
        </div>

        <!-- scoring JSON -->
        <div class="card card-pad" style="border-radius: 16px">
          <div class="flex items-center justify-between" style="margin-bottom: 14px">
            <h3 style="font-size: 16px">Оноолтын дүрэм (JSON)</h3>
            <button
              class="btn btn-ghost btn-sm"
              style="font-size: 12px"
              @click="scoringJson = exampleScoring"
            >
              <UiIcon name="doc" :size="14" /> Жишээ
            </button>
          </div>
          <p class="muted" style="font-size: 12.5px; margin-bottom: 10px; line-height: 1.5">
            Хэд хэдэн хэв маяг дэмжигддэг: <code>ranges</code>, <code>category_count</code> болон бусад.
          </p>
          <textarea
            v-model="scoringJson"
            class="input textarea"
            rows="22"
            style="font-family: monospace; font-size: 12px; resize: vertical; line-height: 1.4"
            placeholder="Scoring rules JSON"
          />
          <!-- current questions count info -->
          <div style="margin-top: 14px; padding: 12px; background: var(--primary-soft); border-radius: 10px; font-size: 13px; color: var(--primary-deep)">
            <strong>Одоогийн байдал:</strong> {{ qCount(activeTest) }} асуулт хадгалагдсан байна.
            Хадгалсны дараа оюутны тест дараалал шинэчлэгдэнэ.
          </div>
        </div>
      </div>

      <div v-if="jsonError" style="margin-top: 14px; color: var(--bad); font-size: 14px">
        <UiIcon name="x" :size="15" style="vertical-align: middle; margin-right: 6px" />{{ jsonError }}
      </div>

      <div class="flex items-center" style="gap: 10px; margin-top: 20px">
        <button class="btn btn-primary btn-sm" :disabled="saving" @click="saveQuestions">
          {{ saving ? 'Хадгалж байна…' : 'Хадгалах' }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="mode = 'list'">Болих</button>
      </div>
    </div>
  </div>
</template>
