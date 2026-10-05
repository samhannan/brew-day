import { reactive, watch } from 'vue'
import { DEFAULT_EQUIPMENT, type Equipment, type Recipe } from './lib/types'

interface State {
  recipe: Recipe | null
  warnings: string[]
  sourceText: string
  equipment: Equipment
}

const KEY = 'brew-day:v1'

function load(): Partial<State> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

const saved = load()

export const store = reactive<State>({
  recipe: saved.recipe ?? null,
  warnings: saved.warnings ?? [],
  sourceText: saved.sourceText ?? '',
  equipment: { ...DEFAULT_EQUIPMENT, ...saved.equipment },
})

watch(
  store,
  (s) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      // Storage unavailable (private mode etc.) — the app still works for this session.
    }
  },
  { deep: true },
)
