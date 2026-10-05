<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import { abv, round, totalGrainKg } from '../lib/calculations'
import type { ExtraStage, HopUse, Recipe } from '../lib/types'

const emit = defineEmits<{ done: [] }>()
const r = computed(() => store.recipe as Recipe)

const hopUses: { value: HopUse; label: string; timeLabel: string }[] = [
  { value: 'first-wort', label: 'First wort', timeLabel: '—' },
  { value: 'boil', label: 'Boil', timeLabel: 'min left' },
  { value: 'whirlpool', label: 'Flameout / steep', timeLabel: 'steep min' },
  { value: 'dry-hop', label: 'Dry hop', timeLabel: 'day' },
]
const stages: ExtraStage[] = ['water', 'mash', 'boil', 'flameout', 'fermenter', 'packaging', 'other']

const hopTimeLabel = (use: HopUse) => hopUses.find((u) => u.value === use)?.timeLabel ?? ''
</script>

<template>
  <section class="editor">
    <div class="head">
      <div>
        <h2>Check the recipe</h2>
        <p class="muted">Fix anything that was misread. The brew sheet updates as you edit.</p>
      </div>
      <button class="btn primary" @click="emit('done')">Brew sheet →</button>
    </div>

    <div v-if="store.warnings.length" class="notice">
      <strong>Please double-check:</strong>
      <ul>
        <li v-for="w in store.warnings" :key="w">{{ w }}</li>
      </ul>
    </div>

    <div class="card grid">
      <label class="span-2">Beer name <input v-model="r.name" /></label>
      <label>Batch size (L, clean beer into fermenter) <input v-model.number="r.batchSizeL" type="number" step="0.5" /></label>
      <label>Boil time (min) <input v-model.number="r.boilTimeMin" type="number" step="5" /></label>
      <label>Original gravity <input v-model.number="r.og" type="number" step="0.001" /></label>
      <label>Final gravity <input v-model.number="r.fg" type="number" step="0.001" /></label>
      <p class="muted span-2 small">
        Estimated ABV {{ round(abv(r.og, r.fg), 1) }}%<template v-if="r.ibu"> · {{ r.ibu }} IBU</template
        ><template v-if="r.colourEbc"> · {{ r.colourEbc }} EBC</template>
      </p>
    </div>

    <div class="card">
      <div class="section-head">
        <h3>Malts <span class="muted small">{{ round(totalGrainKg(r), 2) }} kg total</span></h3>
        <button class="btn small" @click="r.fermentables.push({ name: '', amountKg: 0 })">+ Malt</button>
      </div>
      <div v-for="(f, i) in r.fermentables" :key="i" class="item cols-malt">
        <label>Name <input v-model="f.name" /></label>
        <label>kg <input v-model.number="f.amountKg" type="number" step="0.05" /></label>
        <button class="btn ghost small" aria-label="Remove malt" @click="r.fermentables.splice(i, 1)">✕</button>
      </div>
    </div>

    <div class="card">
      <div class="section-head">
        <h3>Hops</h3>
        <button class="btn small" @click="r.hops.push({ name: '', grams: 0, use: 'boil', time: r.boilTimeMin })">+ Hop</button>
      </div>
      <div v-for="(h, i) in r.hops" :key="i" class="item cols-hop">
        <label>Pack <input v-model="h.pack" placeholder="—" /></label>
        <label>Name <input v-model="h.name" /></label>
        <label>g <input v-model.number="h.grams" type="number" /></label>
        <label
          >When
          <select v-model="h.use">
            <option v-for="u in hopUses" :key="u.value" :value="u.value">{{ u.label }}</option>
          </select>
        </label>
        <label>{{ hopTimeLabel(h.use) }} <input v-model.number="h.time" type="number" :disabled="h.use === 'first-wort'" /></label>
        <button class="btn ghost small" aria-label="Remove hop" @click="r.hops.splice(i, 1)">✕</button>
      </div>
    </div>

    <div class="card">
      <div class="section-head">
        <h3>Mash</h3>
        <button class="btn small" @click="r.mashSteps.push({ name: 'Mash out', tempC: 75, timeMin: 10 })">+ Step</button>
      </div>
      <div v-for="(s, i) in r.mashSteps" :key="i" class="item cols-mash">
        <label>Step <input v-model="s.name" /></label>
        <label>°C <input v-model.number="s.tempC" type="number" step="0.5" /></label>
        <label>min <input v-model.number="s.timeMin" type="number" step="5" /></label>
        <button class="btn ghost small" aria-label="Remove step" @click="r.mashSteps.splice(i, 1)">✕</button>
      </div>
      <p v-if="r.sheetMashWaterL || r.sheetSpargeWaterL" class="muted small">
        Sheet's Grainfather volumes: {{ r.sheetMashWaterL ?? '?' }} L mash + {{ r.sheetSpargeWaterL ?? '?' }} L sparge<template
          v-if="r.sheetSpargeTempC"
        >
          at {{ r.sheetSpargeTempC }}°C</template
        >. These are replaced by the BIAB full-volume figure.
      </p>
    </div>

    <div class="card grid">
      <h3 class="span-2">Yeast</h3>
      <label>Yeast <input v-model="r.yeast.name" /></label>
      <label>Ferment temp (°C) <input v-model.number="r.yeast.tempC" type="number" step="0.5" placeholder="19" /></label>
    </div>

    <div class="card">
      <div class="section-head">
        <h3>Extras</h3>
        <button class="btn small" @click="r.extras.push({ name: '', stage: 'other' })">+ Extra</button>
      </div>
      <div v-for="(e, i) in r.extras" :key="i" class="item cols-extra">
        <label>Name <input v-model="e.name" /></label>
        <label
          >When
          <select v-model="e.stage">
            <option v-for="s in stages" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <label>min left <input v-model.number="e.timeMin" type="number" :disabled="e.stage !== 'boil'" /></label>
        <button class="btn ghost small" aria-label="Remove extra" @click="r.extras.splice(i, 1)">✕</button>
      </div>
    </div>

    <details v-if="store.sourceText" class="card">
      <summary>Text read from your sheet</summary>
      <pre>{{ store.sourceText }}</pre>
    </details>

    <button class="btn primary end" @click="emit('done')">Brew sheet →</button>
  </section>
</template>

<style scoped>
.editor {
  display: grid;
  gap: 1rem;
}

.head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
}

.head p {
  margin: 0;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.span-2 {
  grid-column: 1 / -1;
  margin: 0;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.item {
  display: grid;
  gap: 0.5rem;
  align-items: end;
  padding: 0.5rem 0;
  border-top: 1px solid var(--line);
}

.cols-malt {
  grid-template-columns: 1fr 6rem auto;
}

.cols-hop {
  grid-template-columns: 5rem 1fr 4.5rem 9rem 5.5rem auto;
}

.cols-mash {
  grid-template-columns: 1fr 5rem 5rem auto;
}

.cols-extra {
  grid-template-columns: 1fr 8rem 5.5rem auto;
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .cols-hop,
  .cols-extra {
    grid-template-columns: 1fr 1fr;
  }

  .cols-hop > button,
  .cols-extra > button {
    justify-self: start;
  }
}

.small {
  font-size: 0.85rem;
  font-weight: 400;
}

pre {
  white-space: pre-wrap;
  font-family: var(--mono);
  font-size: 0.8rem;
  margin: 0.75rem 0 0;
}

summary {
  cursor: pointer;
  font-weight: 600;
}

.end {
  justify-self: end;
}
</style>
