<script setup lang="ts">
import { computed, ref } from 'vue'
import { store } from '../store'
import { round } from '../lib/calculations'
import { buildBrewSheet } from '../lib/sheet'
import type { Recipe } from '../lib/types'
import GravityCheck from './GravityCheck.vue'
import UnitToggle, { type Unit } from './UnitToggle.vue'

const emit = defineEmits<{ editEquipment: [] }>()

const recipe = computed(() => store.recipe as Recipe)
const sheet = computed(() => buildBrewSheet(recipe.value, store.equipment))
const plan = computed(() => sheet.value.plan)

const hasDiameter = computed(() => store.equipment.kettleDiameterCm > 0)
const volumeUnit = ref<Unit>(hasDiameter.value ? 'cm' : 'L')
// Rows without a ruler depth (sparge water, fermenter) aren't kettle levels, so they stay in litres.
const volumeValue = (r: { value: string; sub?: string }) =>
  volumeUnit.value === 'cm' && hasDiameter.value && r.sub ? r.sub : r.value

const L = (n: number) => `${round(n, 1).toFixed(1)}`
</script>

<template>
  <section class="sheet">
    <header class="title">
      <h2>{{ recipe.name || 'Your brew' }}</h2>
      <p class="muted">
        {{ recipe.fermentables.map((f) => `${f.amountKg} kg ${f.name}`).join(' · ') }}
        <template v-if="recipe.yeast.name"> · {{ recipe.yeast.name }}</template>
      </p>
    </header>

    <p v-if="plan.mashTooThick" class="notice danger">⚠️ Thick mash ({{ round(plan.liquorToGristLPerKg, 1) }} L/kg). Stir well.</p>
    <p v-if="!plan.preBoilFits" class="notice danger">⚠️ Pre-boil volume is over your max capacity. Watch for boil-overs.</p>

    <div class="grid">
      <article class="card">
        <div class="card-head">
          <h3>Volumes</h3>
          <UnitToggle v-model="volumeUnit" :cm-available="hasDiameter" />
        </div>
        <dl>
          <div v-for="r in sheet.volumes" :key="r.label" class="row">
            <dt>{{ r.label }}</dt>
            <dd class="mono">{{ volumeValue(r) }}</dd>
          </div>
        </dl>
        <details class="breakdown">
          <summary>Calculation</summary>
          <table>
            <tbody>
              <tr><td>{{ plan.needsSparge ? 'Mash water' : 'Total water' }}</td><td class="mono">{{ L(plan.mashWaterL) }} L</td></tr>
              <tr><td>− Grain absorption ({{ store.equipment.grainAbsorptionLPerKg }} L/kg)</td><td class="mono">{{ L(plan.absorptionL) }} L</td></tr>
              <!-- Sparge runs through grain that has already absorbed its share, so it all reaches the kettle -->
              <tr v-if="plan.needsSparge"><td>+ Sparge water</td><td class="mono">{{ L(plan.spargeWaterL) }} L</td></tr>
              <tr class="total"><td>= Pre-boil</td><td class="mono">{{ L(plan.preBoilL) }} L</td></tr>
              <tr><td>− Boil-off ({{ store.equipment.boilOffLPerHr }} L/hr)</td><td class="mono">{{ L(plan.boilOffL) }} L</td></tr>
              <tr class="total"><td>= End of boil</td><td class="mono">{{ L(plan.postBoilL) }} L</td></tr>
              <tr><td>− Cooling shrinkage ({{ store.equipment.coolingShrinkagePct }}%)</td><td class="mono">{{ L(plan.postBoilL - plan.postBoilColdL) }} L</td></tr>
              <tr><td>− Trub</td><td class="mono">{{ L(store.equipment.kettleLossL) }} L</td></tr>
              <tr class="total"><td>= Into fermenter</td><td class="mono">{{ L(recipe.batchSizeL) }} L</td></tr>
            </tbody>
          </table>
          <button class="btn small" @click="emit('editEquipment')">Adjust equipment</button>
        </details>
      </article>

      <article class="card">
        <h3>Temps &amp; times</h3>
        <dl>
          <div v-for="r in sheet.temps" :key="r.label" class="row">
            <dt>{{ r.label }}</dt>
            <dd class="mono">{{ r.value }}</dd>
          </div>
        </dl>
      </article>

      <article class="card">
        <h3>Gravity</h3>
        <dl>
          <div v-for="r in sheet.gravity" :key="r.label" class="row">
            <dt>{{ r.label }}</dt>
            <dd class="mono">{{ r.value }}</dd>
          </div>
        </dl>
        <GravityCheck />
      </article>

      <article class="card">
        <h3>Additions</h3>
        <dl v-if="sheet.additions.length">
          <div v-for="(a, i) in sheet.additions" :key="i" class="row addition">
            <dt class="mono">{{ a.when }}</dt>
            <dd>{{ a.what }}</dd>
          </div>
        </dl>
        <p v-else class="muted">None</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.sheet {
  display: grid;
  gap: 1rem;
}

.title h2 {
  font-size: 2rem;
  margin: 0;
}

.title p {
  margin: 0.25rem 0 0;
}

.notice {
  margin: 0;
}

/* 2×2 on wider screens, with every card matching the tallest one */
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 1fr;
  gap: 1rem;
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
}

h3 {
  font-family: var(--sans);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 0 0 1rem;
}

dl {
  margin: 0;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0.45rem 0;
  border-top: 1px solid var(--line);
}

.row:first-child {
  border-top: none;
}

dt {
  color: var(--muted);
}

dd {
  margin: 0;
  font-size: 1.2rem;
  text-align: right;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.card-head h3 {
  margin: 0;
}

/* Let the toggle overhang so the first row lines up with the other cards' */
.card-head :deep(.units) {
  margin-block: -0.45rem;
}

.addition {
  justify-content: flex-start;
}

.addition dt {
  flex: none;
  width: 7.5rem;
  font-size: 0.9rem;
}

.addition dd {
  font-size: 1rem;
  text-align: left;
}


.breakdown {
  margin-top: 0.75rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--line);
  font-size: 0.9rem;
}

.breakdown summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--muted);
}

.breakdown table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
}

.breakdown td {
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--line);
}

.breakdown td:last-child {
  text-align: right;
  white-space: nowrap;
  padding-left: 1rem;
}

tr.total td {
  font-weight: 700;
}
</style>
