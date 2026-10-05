<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
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

// On narrow screens the tabs collapse into a burger dropdown.
const menuOpen = ref(false)
const header = ref<HTMLElement>()

function go(id: Tab) {
  tab.value = id
  menuOpen.value = false
}

function closeOnOutsideClick(e: MouseEvent) {
  if (menuOpen.value && !header.value?.contains(e.target as Node)) menuOpen.value = false
}

function closeOnEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
})
onUnmounted(() => {
  document.removeEventListener('click', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <header ref="header" class="top">
    <div class="wrap">
      <div class="brand">
        <span class="mark" aria-hidden="true">◐</span>
        <h1>Brew Day</h1>
      </div>
      <button
        class="burger"
        type="button"
        aria-label="Menu"
        aria-controls="sections"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        <span class="bars" aria-hidden="true"></span>
      </button>
      <nav id="sections" aria-label="Sections" :class="{ open: menuOpen }">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab"
          :class="{ active: tab === t.id }"
          :disabled="t.needsRecipe && !store.recipe"
          @click="go(t.id)"
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

/* Hidden on wider screens, where the tabs fit in a row */
.burger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}

.bars,
.bars::before,
.bars::after {
  display: block;
  width: 20px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transition:
    transform 0.2s ease,
    background 0.2s ease;
}

.bars {
  position: relative;
}

.bars::before,
.bars::after {
  content: '';
  position: absolute;
  left: 0;
}

.bars::before {
  top: -6px;
}

.bars::after {
  top: 6px;
}

/* Bars fold into a cross while the menu is open */
.burger[aria-expanded='true'] .bars {
  background: transparent;
}

.burger[aria-expanded='true'] .bars::before {
  transform: translateY(6px) rotate(45deg);
}

.burger[aria-expanded='true'] .bars::after {
  transform: translateY(-6px) rotate(-45deg);
}

@media (max-width: 640px) {
  .top .wrap {
    position: relative;
    flex-wrap: nowrap;
    padding-top: 1rem;
    padding-bottom: 1rem;
  }

  .burger {
    display: inline-flex;
  }

  nav {
    display: none;
    position: absolute;
    top: calc(100% + 1px);
    left: 0;
    right: 0;
    flex-direction: column;
    flex-wrap: nowrap;
    padding: 0.5rem 16px 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    box-shadow: var(--shadow);
  }

  nav.open {
    display: flex;
  }

  .tab {
    text-align: left;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    font-size: 1rem;
  }
}

/* Needs .wrap in the selector to beat .wrap's padding shorthand */
main.wrap {
  padding-top: 2.5rem;
  padding-bottom: 4rem;
}
</style>
