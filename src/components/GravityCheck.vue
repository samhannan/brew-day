<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { store } from '../store'
import { depthCm, gravityCorrection, round, shrinkFactor, volumeFromDepthL, waterPlan } from '../lib/calculations'
import type { Recipe } from '../lib/types'
import UnitToggle, { type Unit } from './UnitToggle.vue'

const recipe = computed(() => store.recipe as Recipe)
const plan = computed(() => waterPlan(recipe.value, store.equipment))

const hasDiameter = computed(() => store.equipment.kettleDiameterCm > 0)
const unit = ref<Unit>('L')
const inCm = computed(() => unit.value === 'cm' && hasDiameter.value)
const reading = ref<number | null>(null)
const sg = ref<number | null>(null)

// A number typed as litres means nothing as cm, and vice versa.
watch(unit, () => (reading.value = null))

/** A kettle volume in the selected unit, e.g. "29.0 L" or "36.1 cm". */
const show = (litres: number) =>
  inCm.value ? `${round(depthCm(litres, store.equipment) ?? 0, 1).toFixed(1)} cm` : `${round(litres, 1).toFixed(1)} L`

const volume = computed(() => {
  // The placeholder shows the planned pre-boil volume, so an empty box means "as planned".
  if (!reading.value) return plan.value.preBoilL
  return inCm.value ? (volumeFromDepthL(reading.value, store.equipment) ?? null) : reading.value
})
const placeholder = computed(() =>
  round(inCm.value ? (depthCm(plan.value.preBoilL, store.equipment) ?? 0) : plan.value.preBoilL, 1).toString(),
)

const result = computed(() => {
  if (!volume.value || !sg.value) return null
  // Accept "1038" as well as "1.038".
  const gravity = sg.value > 2 ? sg.value / 1000 : sg.value
  return gravityCorrection(recipe.value, store.equipment, volume.value, gravity)
})

const offBy = computed(() => (result.value ? Math.round((result.value.predictedOg - recipe.value.og) * 1000) : 0))

// A ruler reads the hot kettle level, so a longer boil is shown as where to stop, not the batch it gives.
const extendedBoilEnd = computed(() =>
  result.value ? (result.value.extendedBoilBatchL + store.equipment.kettleLossL) / shrinkFactor(store.equipment) : 0,
)
</script>

<template>
  <div class="gravity">
    <div class="head">
      <h4>Gravity check</h4>
      <UnitToggle v-model="unit" :cm-available="hasDiameter" />
    </div>
    <div class="inputs">
      <label
        >{{ inCm ? 'Depth (cm)' : 'Volume (L)' }}
        <input v-model.number="reading" type="number" step="0.1" :placeholder="placeholder" />
      </label>
      <label>Pre-boil SG <input v-model.number="sg" type="number" step="0.001" :placeholder="plan.preBoilGravity.toFixed(3)" /></label>
    </div>
    <div v-if="result" class="out">
      <p>
        Predicted OG <strong class="mono">{{ result.predictedOg.toFixed(3) }}</strong>
        <span class="muted">(target {{ recipe.og.toFixed(3) }})</span>
      </p>
      <p v-if="Math.abs(offBy) <= 1">✅ On target</p>
      <p v-else-if="offBy > 0 && inCm">High: add water to <strong>{{ show(volume! + result.dilutionWaterL) }}</strong></p>
      <p v-else-if="offBy > 0">High: add <strong>{{ show(result.dilutionWaterL) }}</strong> water</p>
      <p v-else>
        Low: add <strong>{{ round(result.dmeKg * 1000, -1) }} g</strong> DME at 10 min, or boil
        <strong>{{ Math.ceil(result.extraBoilMin) }} min</strong> longer
        <template v-if="inCm">(to {{ show(extendedBoilEnd) }})</template>
        <template v-else>({{ show(result.extendedBoilBatchL) }})</template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.gravity {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: var(--surface-2);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

h4 {
  margin: 0;
}

.inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 520px) {
  .inputs {
    grid-template-columns: 1fr;
  }
}

.out p {
  margin: 0.6rem 0 0;
}

</style>
