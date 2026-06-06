<script setup>
import { ref, computed } from 'vue'
import UiIcon from './UiIcon.vue'

/*
 * ImageSlot — a user-fillable image placeholder.
 *
 * Drag an image file onto it (or click to browse) and it previews via an object
 * URL. This is the standalone equivalent of the original <image-slot> web
 * component; the design-tool sidecar persistence is intentionally dropped since
 * it only worked inside that host runtime.
 */
const props = defineProps({
  shape: { type: String, default: 'rounded' }, // rounded | circle | pill | rect
  radius: { type: Number, default: 12 },
  fit: { type: String, default: 'cover' }, // cover | contain | fill
  placeholder: { type: String, default: 'Drop an image' },
  src: { type: String, default: '' },
})

const emit = defineEmits(['change'])

const url = ref(props.src || '')
const over = ref(false)
const error = ref('')
const input = ref(null)

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/avif']

const borderRadius = computed(() => {
  if (props.shape === 'circle') return '50%'
  if (props.shape === 'pill') return '9999px'
  if (props.shape === 'rounded') return props.radius + 'px'
  return '0'
})

function ingest(file) {
  error.value = ''
  if (!file || ACCEPT.indexOf(file.type) < 0) {
    error.value = 'Drop a PNG, JPEG, WebP, or AVIF image.'
    return
  }
  if (url.value && url.value.startsWith('blob:')) URL.revokeObjectURL(url.value)
  url.value = URL.createObjectURL(file)
  emit('change', file)
}

function onDrop(e) {
  over.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) ingest(f)
}

function onPick(e) {
  const f = e.target.files?.[0]
  if (f) ingest(f)
  e.target.value = ''
}

function clear() {
  if (url.value && url.value.startsWith('blob:')) URL.revokeObjectURL(url.value)
  url.value = ''
  emit('change', null)
}
</script>

<template>
  <div
    class="relative group"
    :style="{ borderRadius }"
    style="display: block"
    @dragenter.prevent.stop="over = true"
    @dragover.prevent.stop="over = true"
    @dragleave.prevent.stop="over = false"
    @drop.prevent.stop="onDrop"
  >
    <input ref="input" type="file" :accept="ACCEPT.join(',')" hidden @change="onPick" />

    <!-- Filled state -->
    <template v-if="url">
      <img
        :src="url"
        alt=""
        :style="{
          width: '100%',
          height: '100%',
          objectFit: fit,
          borderRadius,
          display: 'block',
        }"
      />
    </template>

    <!-- Empty state -->
    <button
      v-else
      type="button"
      class="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5 p-3 text-center"
      :style="{
        borderRadius,
        background: over ? 'rgba(189,100,66,.10)' : 'rgba(0,0,0,.04)',
        border: over ? '2px solid var(--clay)' : '1.5px dashed rgba(0,0,0,.22)',
        color: 'rgba(0,0,0,.5)',
        boxSizing: 'border-box',
      }"
      @click="input?.click()"
    >
      <UiIcon name="eye" :size="26" :style="{ opacity: 0.45 }" />
      <span class="max-w-[90%] text-[13px] font-medium leading-snug">{{ placeholder }}</span>
      <span class="text-[11px]">or <u>browse files</u></span>
    </button>

    <div
      v-if="error"
      class="absolute bottom-2 left-2 right-2 rounded px-1.5 py-1 text-[11px]"
      style="background: rgba(255, 255, 255, 0.85); color: #b3261e"
    >
      {{ error }}
    </div>
  </div>
</template>
