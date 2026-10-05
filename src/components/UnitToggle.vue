<script setup lang="ts">
export type Unit = 'L' | 'cm'

defineProps<{ cmAvailable: boolean }>()
const unit = defineModel<Unit>({ required: true })
</script>

<template>
  <div class="units" role="group" aria-label="Units">
    <button :class="{ on: unit === 'L' }" :aria-pressed="unit === 'L'" @click="unit = 'L'">L</button>
    <button
      :class="{ on: unit === 'cm' }"
      :aria-pressed="unit === 'cm'"
      :disabled="!cmAvailable"
      :title="cmAvailable ? undefined : 'Set the kettle diameter on the Equipment tab'"
      @click="unit = 'cm'"
    >
      cm
    </button>
  </div>
</template>

<style scoped>
.units {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  padding: 2px;
}

button {
  border: 0;
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  padding: 0.1rem 0.6rem;
  font: 600 0.8rem var(--mono);
  cursor: pointer;
}

button.on {
  background: var(--amber);
  color: var(--surface);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
