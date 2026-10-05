import type { Equipment, Recipe } from './types'

/** Gravity points per kg of dry malt extract dissolved to make 1 L (44 ppg in metric). */
export const DME_POINTS_PER_KG_PER_L = 367

export interface WaterPlan {
  grainKg: number
  boilOffL: number
  absorptionL: number
  /** Cooled wort before leaving the trub behind: batch size + kettle loss */
  postBoilColdL: number
  /** Hot volume in the kettle at the end of the boil (before cooling shrinkage) */
  postBoilL: number
  preBoilL: number
  totalWaterL: number
  /** Water the grain is mashed in; equals totalWaterL unless the kettle forces a sparge */
  mashWaterL: number
  /** Water poured over the lifted bag; 0 for a full-volume BIAB */
  spargeWaterL: number
  needsSparge: boolean
  /** Usable kettle capacity: max safe capacity, capped at the kettle size */
  capacityL: number
  /** Water + grain in the kettle while mashing */
  mashVolumeL: number
  /** Full-volume water + grain, before any sparge split */
  fullVolumeMashL: number
  /** Mash thicker than ~2.5 L/kg is hard to stir and converts poorly */
  mashTooThick: boolean
  /** False when even the grain alone overflows the capacity, so no sparge split can help */
  mashFits: boolean
  preBoilFits: boolean
  liquorToGristLPerKg: number
  mashTempC: number
  strikeTempC: number
  preBoilGravity: number
}

export const points = (sg: number) => (sg - 1) * 1000
export const fromPoints = (pts: number) => 1 + pts / 1000

export function round(n: number, dp = 1) {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export function totalGrainKg(recipe: Recipe) {
  return recipe.fermentables.reduce((sum, f) => sum + (f.amountKg || 0), 0)
}

/**
 * Full-volume BIAB water plan, following the Malt Miller method:
 * total water = batch size + boil-off + grain absorption, plus trub/kettle loss and
 * cooling shrinkage so that the batch size is clean beer into the fermenter.
 * Kettle volumes (pre-/post-boil) are hot; batch size and OG are cold.
 */
export function waterPlan(recipe: Recipe, eq: Equipment): WaterPlan {
  const grainKg = totalGrainKg(recipe)
  const boilOffL = eq.boilOffLPerHr * (recipe.boilTimeMin / 60)
  const absorptionL = grainKg * eq.grainAbsorptionLPerKg
  const postBoilColdL = recipe.batchSizeL + eq.kettleLossL
  const postBoilL = postBoilColdL / shrinkFactor(eq)
  const preBoilL = postBoilL + boilOffL
  const totalWaterL = preBoilL + absorptionL
  const grainDisplacementL = grainKg * eq.grainDisplacementLPerKg
  const fullVolumeMashL = totalWaterL + grainDisplacementL

  // When water + grain won't fit, mash with what does and sparge the rest over the lifted bag.
  const capacityL = Math.min(eq.maxCapacityL, eq.kettleVolumeL)
  const needsSparge = fullVolumeMashL > capacityL
  const mashWaterL = needsSparge ? Math.max(capacityL - grainDisplacementL, 0) : totalWaterL
  const spargeWaterL = totalWaterL - mashWaterL
  const liquorToGristLPerKg = grainKg > 0 ? mashWaterL / grainKg : 0
  const mashTempC = recipe.mashSteps[0]?.tempC ?? 66

  return {
    grainKg,
    boilOffL,
    absorptionL,
    postBoilColdL,
    postBoilL,
    preBoilL,
    totalWaterL,
    mashWaterL,
    spargeWaterL,
    needsSparge,
    capacityL,
    mashVolumeL: mashWaterL + grainDisplacementL,
    fullVolumeMashL,
    mashTooThick: grainKg > 0 && liquorToGristLPerKg < MIN_MASH_RATIO_L_PER_KG,
    mashFits: mashWaterL + grainDisplacementL <= capacityL,
    preBoilFits: preBoilL <= capacityL,
    liquorToGristLPerKg,
    mashTempC,
    strikeTempC: strikeTemp(mashTempC, eq.grainTempC, liquorToGristLPerKg) + eq.strikeAllowanceC,
    // Sugar is conserved through the boil, so gravity points scale inversely with volume.
    preBoilGravity: preBoilL > 0 ? fromPoints((points(recipe.og) * postBoilL) / preBoilL) : recipe.og,
  }
}

/** Thinnest-to-thickest sensible mash; below this, stirring and conversion suffer. */
export const MIN_MASH_RATIO_L_PER_KG = 2.5

/**
 * Evaporation per square metre of wort surface during a rolling boil. Calibrated so a typical
 * 35 cm-wide kettle gives The Malt Miller's 3 L/hr (about 3.1 cm of depth per hour).
 * Heat source power matters too, so a measured rate always beats this estimate.
 */
export const BOIL_OFF_L_PER_HR_PER_M2 = 31

export function kettleAreaCm2(eq: Equipment) {
  return eq.kettleDiameterCm > 0 ? Math.PI * (eq.kettleDiameterCm / 2) ** 2 : 0
}

/** Liquid depth in a straight-sided, flat-bottomed kettle; undefined when the diameter is unknown. */
export function depthCm(volumeL: number, eq: Equipment): number | undefined {
  const area = kettleAreaCm2(eq)
  return area ? (volumeL * 1000) / area : undefined
}

export function volumeFromDepthL(depth: number, eq: Equipment): number | undefined {
  const area = kettleAreaCm2(eq)
  return area ? (depth * area) / 1000 : undefined
}

export function suggestedBoilOffLPerHr(eq: Equipment): number | undefined {
  const area = kettleAreaCm2(eq)
  return area ? (area / 10_000) * BOIL_OFF_L_PER_HR_PER_M2 : undefined
}

/** Cold volume = hot volume × shrinkFactor */
export function shrinkFactor(eq: Equipment) {
  return 1 - eq.coolingShrinkagePct / 100
}

/** Palmer's infusion equation (metric): Tw = (0.41 / r)(T2 - T1) + T2, r in L/kg. */
export function strikeTemp(mashTempC: number, grainTempC: number, ratioLPerKg: number) {
  if (ratioLPerKg <= 0) return mashTempC
  return (0.41 / ratioLPerKg) * (mashTempC - grainTempC) + mashTempC
}

export interface GravityCorrection {
  predictedOg: number
  /** Positive: OG will be high, add this much water. */
  dilutionWaterL: number
  /** Positive: OG will be low, add this much DME at the end of the boil to hit target. */
  dmeKg: number
  /** Alternative to DME: boil this many extra minutes (yields a smaller batch). */
  extraBoilMin: number
  /** Clean beer into the fermenter if you keep the planned boil (or boil longer when low). */
  extendedBoilBatchL: number
}

/**
 * Given a measured pre-boil volume and gravity, predict OG and suggest fixes.
 */
export function gravityCorrection(
  recipe: Recipe,
  eq: Equipment,
  measuredPreBoilL: number,
  measuredPreBoilSg: number,
): GravityCorrection {
  const plan = waterPlan(recipe, eq)
  const shrink = shrinkFactor(eq)
  // Work in cold-equivalent volumes, since gravity is read from a cooled sample.
  const totalPts = points(measuredPreBoilSg) * measuredPreBoilL * shrink
  const actualPostBoilColdL = Math.max(measuredPreBoilL - plan.boilOffL, 0.1) * shrink
  const predictedPts = totalPts / actualPostBoilColdL
  const targetPts = points(recipe.og)

  let dilutionWaterL = 0
  let dmeKg = 0
  let extraBoilMin = 0
  let extendedBoilBatchL = actualPostBoilColdL - eq.kettleLossL

  if (predictedPts > targetPts) {
    dilutionWaterL = totalPts / targetPts - actualPostBoilColdL
  } else if (predictedPts < targetPts) {
    dmeKg = ((targetPts - predictedPts) * actualPostBoilColdL) / DME_POINTS_PER_KG_PER_L
    const requiredPostBoilColdL = totalPts / targetPts
    const extraBoilOffL = (actualPostBoilColdL - requiredPostBoilColdL) / shrink
    extraBoilMin = eq.boilOffLPerHr > 0 ? (extraBoilOffL / eq.boilOffLPerHr) * 60 : 0
    extendedBoilBatchL = requiredPostBoilColdL - eq.kettleLossL
  }

  return {
    predictedOg: fromPoints(predictedPts),
    dilutionWaterL,
    dmeKg,
    extraBoilMin,
    extendedBoilBatchL,
  }
}

export function abv(og: number, fg: number) {
  return (og - fg) * 131.25
}
