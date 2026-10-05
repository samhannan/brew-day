<script setup lang="ts">
import { ref } from 'vue'
import { store } from './store'
import ImportPanel from './components/ImportPanel.vue'
import RecipeEditor from './components/RecipeEditor.vue'
import EquipmentPanel from './components/EquipmentPanel.vue'
import BrewSheet from './components/BrewSheet.vue'

type Tab = 'import' | 'recipe' | 'brew' | 'equipment'
const tab = ref<Tab>(store.recipe ? 'brew' : 'import')

const tabs: { id: Tab; label: string; needsRecipe?: boolean }[] = [
  { id: 'import', label: '1. Upload' },
  { id: 'recipe', label: '2. Check recipe', needsRecipe: true },
  { id: 'brew', label: '3. Brew sheet', needsRecipe: true },
  { id: 'equipment', label: 'Equipment' },
]
</script>

<template>
  <header class="top">
    <div class="wrap">
      <div class="brand">
        <span class="mark" aria-hidden="true">◐</span>
        <h1>Brew Day</h1>
      </div>
      <nav aria-label="Sections">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab"
          :class="{ active: tab === t.id }"
          :disabled="t.needsRecipe && !store.recipe"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </nav>
    </div>
  </header>

  <main class="wrap">
    <ImportPanel v-if="tab === 'import'" @parsed="tab = 'recipe'" />
    <RecipeEditor v-else-if="tab === 'recipe' && store.recipe" @done="tab = 'brew'" />
    <BrewSheet v-else-if="tab === 'brew' && store.recipe" @edit-equipment="tab = 'equipment'" />
    <EquipmentPanel v-else-if="tab === 'equipment'" />
  </main>
</template>

<style scoped>
.wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 16px;
}

.top {
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 5;
}

.top .wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 1.5rem;
  padding-bottom: 1rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand h1 {
  font-size: 1.6rem;
  margin: 0;
  font-weight: 800;
}

.mark {
  font-size: 2rem;
  color: var(--amber);
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.tab {
  border: none;
  background: transparent;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  color: var(--muted);
}

.tab.active {
  background: var(--ink);
  color: var(--bg);
}

.tab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Needs .wrap in the selector to beat .wrap's padding shorthand */
main.wrap {
  padding-top: 2.5rem;
  padding-bottom: 4rem;
}
</style>
