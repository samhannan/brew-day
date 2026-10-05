import { abv, depthCm, round, waterPlan, type WaterPlan } from './calculations'
import type { Equipment, Extra, HopAddition, Recipe } from './types'

export interface Row {
  label: string
  value: string
  /** Secondary detail, e.g. ruler depth */
  sub?: string
}

export interface Addition {
  when: string
  what: string
}

export interface BrewSheet {
  plan: WaterPlan
  volumes: Row[]
  temps: Row[]
  gravity: Row[]
  additions: Addition[]
}

const L = (n: number) => `${round(n, 1).toFixed(1)} L`
const C = (n: number) => `${round(n, 0)}°C`
const SG = (n: number) => n.toFixed(3)

export function hopLabel(h: HopAddition) {
  return `${h.pack ? `${h.pack} · ` : ''}${h.grams}g ${h.name}`
}

/** Everything needed on brew day, grouped for reference rather than as a sequence of steps. */
export function buildBrewSheet(recipe: Recipe, eq: Equipment): BrewSheet {
  const plan = waterPlan(recipe, eq)
  const depth = (n: number) => {
    const d = depthCm(n, eq)
    return d === undefined ? undefined : `${round(d, 1).toFixed(1)} cm`
  }
  const vol = (label: string, n: number): Row => ({ label, value: L(n), sub: depth(n) })
  const extras = (stage: Extra['stage']) => recipe.extras.filter((e) => e.stage === stage)
  const hops = (use: HopAddition['use']) => recipe.hops.filter((h) => h.use === use)
  const spargeTemp = `${recipe.sheetSpargeTempC ?? '76–77'}°C`
  const fermentTemp = recipe.yeast.tempC ?? 19
  const steepMin = Math.max(0, ...hops('whirlpool').map((h) => h.time))

  const volumes: Row[] = plan.needsSparge
    ? [vol('Mash water', plan.mashWaterL), { label: 'Sparge water', value: L(plan.spargeWaterL) }]
    : [vol('Total water', plan.totalWaterL)]
  volumes.push(vol('Pre-boil', plan.preBoilL), vol('End of boil', plan.postBoilL), {
    label: 'Into fermenter',
    value: L(recipe.batchSizeL),
  })

  const temps: Row[] = [
    { label: 'Strike', value: C(plan.strikeTempC) },
    ...recipe.mashSteps.map((s) => ({ label: s.name, value: `${C(s.tempC)} · ${s.timeMin} min` })),
    ...(plan.needsSparge ? [{ label: 'Sparge', value: spargeTemp }] : []),
    { label: 'Boil', value: `${recipe.boilTimeMin} min` },
    ...(steepMin ? [{ label: 'Flameout steep', value: `${steepMin} min` }] : []),
    { label: 'Ferment', value: C(fermentTemp) },
  ]

  const gravity: Row[] = [
    { label: 'Pre-boil', value: SG(plan.preBoilGravity) },
    { label: 'OG', value: SG(recipe.og) },
    { label: 'FG', value: SG(recipe.fg) },
    { label: 'ABV', value: `${round(recipe.abv ?? abv(recipe.og, recipe.fg), 1)}%` },
  ]

  const boilAdditions = [
    ...hops('first-wort').map((h) => ({ at: recipe.boilTimeMin, what: `${hopLabel(h)} (first wort)` })),
    ...hops('boil').map((h) => ({ at: h.time, what: hopLabel(h) })),
    ...extras('boil').map((e) => ({ at: e.timeMin ?? 15, what: e.name })),
  ].sort((a, b) => b.at - a.at)

  const additions: Addition[] = [
    ...extras('water').map((e) => ({ when: 'Water', what: e.name })),
    ...extras('mash').map((e) => ({ when: 'Mash', what: e.name })),
    ...boilAdditions.map((a) => ({ when: `${a.at} min`, what: a.what })),
    ...[...hops('whirlpool').map(hopLabel), ...extras('flameout').map((e) => e.name)].map((what) => ({
      when: 'Flameout',
      what,
    })),
    ...hops('dry-hop')
      .sort((a, b) => a.time - b.time)
      .map((h) => ({ when: `Day ${h.time}`, what: hopLabel(h) })),
    ...extras('fermenter').map((e) => ({ when: 'End of ferment', what: e.name })),
    ...[...extras('packaging'), ...extras('other')].map((e) => ({ when: '—', what: e.name })),
  ]


  return { plan, volumes, temps, gravity, additions }
}
