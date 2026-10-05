<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import { round, suggestedBoilOffLPerHr } from '../lib/calculations'
import { DEFAULT_EQUIPMENT, type Equipment } from '../lib/types'

interface Field {
  key: keyof Equipment
  label: string
  unit: string
  step: number
  help: string
}

const groups: { title: string; fields: Field[] }[] = [
  {
    title: 'Kettle',
    fields: [
      { key: 'kettleVolumeL', label: 'Kettle size', unit: 'L', step: 1, help: 'Nominal size of your kettle.' },
      { key: 'maxCapacityL', label: 'Max safe capacity', unit: 'L', step: 0.5, help: 'Most water + grain to mash. Above this, a sparge is added.' },
      { key: 'kettleDiameterCm', label: 'Inside diameter', unit: 'cm', step: 0.5, help: 'Optional. Adds ruler depths. Leave at 0 if unknown.' },
    ],
  },
  {
    title: 'Losses',
    fields: [
      { key: 'boilOffLPerHr', label: 'Boil-off rate', unit: 'L/hr', step: 0.1, help: 'About 3 L/hr is typical. Measure yours.' },
      { key: 'grainAbsorptionLPerKg', label: 'Grain absorption', unit: 'L/kg', step: 0.05, help: 'About 1 L/kg when drained, not squeezed.' },
      { key: 'kettleLossL', label: 'Trub & kettle loss', unit: 'L', step: 0.25, help: 'Left in the kettle, on top of the batch size.' },
      { key: 'coolingShrinkagePct', label: 'Cooling shrinkage', unit: '%', step: 0.5, help: 'Wort shrinks about 4% as it cools.' },
    ],
  },
  {
    title: 'Mash',
    fields: [
      { key: 'grainTempC', label: 'Grain temperature', unit: '°C', step: 1, help: 'Room temperature where the grain is stored.' },
      { key: 'strikeAllowanceC', label: 'Strike allowance', unit: '°C', step: 0.5, help: 'Raise if your mash comes in low, lower if high.' },
      { key: 'grainDisplacementLPerKg', label: 'Grain displacement', unit: 'L/kg', step: 0.01, help: 'Space the grain takes up in the kettle.' },
    ],
  },
]

const suggestedBoilOff = computed(() => {
  const s = suggestedBoilOffLPerHr(store.equipment)
  return s === undefined ? undefined : round(s, 1)
})

function reset() {
  Object.assign(store.equipment, DEFAULT_EQUIPMENT)
}
</script>

<template>
  <section>
    <h2>Your BIAB equipment</h2>
    <p class="muted">These figures drive the water calculations. Defaults follow The Malt Miller's BIAB guide, plus trub and cooling losses.</p>

    <div class="card">
      <div v-for="g in groups" :key="g.title" class="group">
        <h3>{{ g.title }}</h3>
        <div class="fields">
          <div v-for="f in g.fields" :key="f.key" class="field">
            <label :for="f.key">
              {{ f.label }} <span class="unit">({{ f.unit }})</span>
            </label>
            <input :id="f.key" v-model.number="store.equipment[f.key]" type="number" :step="f.step" />
            <small v-if="f.key === 'boilOffLPerHr' && suggestedBoilOff !== undefined" class="suggest">
              Suggested for {{ store.equipment.kettleDiameterCm }} cm: <strong>{{ suggestedBoilOff }}</strong>
              <button
                v-if="suggestedBoilOff !== store.equipment.boilOffLPerHr"
                class="use"
                type="button"
                @click="store.equipment.boilOffLPerHr = suggestedBoilOff"
              >
                Use
              </button>
            </small>
            <small v-else>{{ f.help }}</small>
          </div>
        </div>
      </div>
    </div>

    <button class="btn ghost reset" @click="reset">Reset to defaults</button>
  </section>
</template>

<style scoped>
section {
  display: grid;
  gap: 1rem;
}

section > p,
section > h2 {
  margin: 0;
}

.group + .group {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
}

h3 {
  font-family: var(--sans);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 0 0 0.75rem;
}

/* Four even columns; every field has the same structure so rows line up. */
.fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 760px) {
  .fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.field {
  display: grid;
  grid-template-rows: auto 2.5rem 2.6em;
  gap: 0.3rem;
  align-content: start;
}

label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unit {
  color: var(--muted);
  font-weight: 400;
}

input {
  height: 2.5rem;
}

small {
  font-size: 0.8rem;
  line-height: 1.3;
  color: var(--muted);
  overflow: hidden;
}

.suggest {
  color: var(--hop);
}

.use {
  border: none;
  background: var(--hop);
  color: var(--surface);
  border-radius: 999px;
  padding: 0 0.6rem;
  margin-left: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.reset {
  justify-self: start;
}
</style>
