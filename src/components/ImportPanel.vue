<script setup lang="ts">
import { ref } from 'vue'
import { store } from '../store'
import { extractText } from '../lib/extract'
import { parseRecipeText } from '../lib/parser'
import { DARK_ROCK_SAMPLE } from '../lib/sample'
import { emptyRecipe } from '../lib/types'

const emit = defineEmits<{ parsed: [] }>()

const pasted = ref('')
const busy = ref('')
const error = ref('')
const dragging = ref(false)

function useText(text: string) {
  const { recipe, warnings } = parseRecipeText(text)
  store.recipe = recipe
  store.warnings = warnings
  store.sourceText = text
  emit('parsed')
}

async function handleFile(file: File | undefined) {
  if (!file) return
  error.value = ''
  try {
    const text = await extractText(file, (msg) => (busy.value = msg))
    if (!text.trim()) throw new Error('No text could be read from that file.')
    useText(text)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = ''
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  handleFile(e.dataTransfer?.files[0])
}

function startBlank() {
  store.recipe = emptyRecipe()
  store.warnings = []
  store.sourceText = ''
  emit('parsed')
}
</script>

<template>
  <section class="import">
    <div>
      <h2>Upload your kit instructions</h2>
      <p class="muted">
        Add a PDF, a photo of the paper sheet, or a text file. I'll pull out the malts, hops, volumes and gravities, then convert
        the Grainfather-style instructions to a full-volume brew-in-a-bag plan.
      </p>
    </div>

    <label
      class="drop card"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input
        type="file"
        accept="application/pdf,image/*,.txt,text/plain"
        class="sr-only"
        :disabled="!!busy"
        @change="handleFile(($event.target as HTMLInputElement).files?.[0])"
      />
      <span class="drop-icon" aria-hidden="true">⇪</span>
      <strong>{{ busy || 'Choose a file or drop it here' }}</strong>
      <span class="muted">PDF, JPG/PNG/HEIC photo, or .txt</span>
    </label>

    <p v-if="error" class="notice danger" role="alert">{{ error }}</p>

    <div class="card">
      <label for="paste">Or paste the instructions as text</label>
      <textarea id="paste" v-model="pasted" rows="7" placeholder="Original Gravity: 1043&#10;MAKES 23 Litres&#10;MALT 3.9kg Best Ale, 250g Torrefied Wheat&#10;…" />
      <div class="row">
        <button class="btn primary" :disabled="!pasted.trim()" @click="useText(pasted)">Read pasted text</button>
        <button class="btn" @click="useText(DARK_ROCK_SAMPLE)">Try the Dark Rock example</button>
        <button class="btn ghost" @click="startBlank">Enter a recipe by hand</button>
      </div>
    </div>

    <p class="muted small">
      Photos are read on your device with OCR (the language model downloads the first time you use it). Always check the next
      screen: photos of crumpled paper won't be read perfectly.
    </p>
  </section>
</template>

<style scoped>
.import {
  display: grid;
  gap: 1.25rem;
}

.drop {
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  padding: 2.5rem 1rem;
  border: 2px dashed var(--line);
  cursor: pointer;
  text-align: center;
  color: var(--ink);
  font-size: 1rem;
}

.drop.dragging,
.drop:hover {
  border-color: var(--amber);
  background: var(--amber-soft);
}

.drop-icon {
  font-size: 2rem;
  color: var(--amber);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

textarea {
  margin-top: 0.4rem;
  font-family: var(--mono);
  font-size: 0.85rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.small {
  font-size: 0.85rem;
}
</style>
