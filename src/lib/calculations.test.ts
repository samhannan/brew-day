import { describe, expect, it } from 'vitest'
import { depthCm, gravityCorrection, strikeTemp, suggestedBoilOffLPerHr, volumeFromDepthL, waterPlan } from './calculations'
import { DEFAULT_EQUIPMENT, emptyRecipe, type Recipe } from './types'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return { ...emptyRecipe(), ...overrides }
}

describe('waterPlan', () => {
  const maltMiller = { ...DEFAULT_EQUIPMENT, kettleLossL: 0, coolingShrinkagePct: 0 }

  it("matches the Malt Miller worked example: 20 L, 5 kg, 1 hr boil → 28 L", () => {
    const plan = waterPlan(
      recipe({ batchSizeL: 20, boilTimeMin: 60, fermentables: [{ name: 'Pale', amountKg: 5 }] }),
      maltMiller,
    )
    expect(plan.boilOffL).toBe(3)
    expect(plan.absorptionL).toBe(5)
    expect(plan.preBoilL).toBe(23)
    expect(plan.totalWaterL).toBe(28)
  })

  it('scales boil-off with boil length and includes kettle losses', () => {
    const plan = waterPlan(
      recipe({ batchSizeL: 23, boilTimeMin: 90, fermentables: [{ name: 'Pale', amountKg: 4 }] }),
      { ...maltMiller, kettleLossL: 1.5 },
    )
    expect(plan.boilOffL).toBe(4.5)
    expect(plan.preBoilL).toBe(29)
    expect(plan.totalWaterL).toBe(33)
  })

  it('makes enough wort for 23 L of clean beer after trub and cooling shrinkage', () => {
    const plan = waterPlan(
      recipe({ batchSizeL: 23, boilTimeMin: 60, fermentables: [{ name: 'Best Ale', amountKg: 4.15 }] }),
      DEFAULT_EQUIPMENT, // 2 L trub, 4% shrinkage
    )
    expect(plan.postBoilColdL).toBe(25)
    expect(plan.postBoilL).toBeCloseTo(25 / 0.96)
    expect(plan.preBoilL).toBeCloseTo(25 / 0.96 + 3)
    expect(plan.totalWaterL).toBeCloseTo(25 / 0.96 + 3 + 4.15)
  })

  it('predicts pre-boil gravity by conserving sugar', () => {
    const plan = waterPlan(
      recipe({ batchSizeL: 23, og: 1.043, fermentables: [{ name: 'Best Ale', amountKg: 4.15 }] }),
      maltMiller,
    )
    expect(plan.preBoilL).toBe(26)
    expect(plan.preBoilGravity).toBeCloseTo(1 + (43 * 23) / 26 / 1000, 5)
  })

  it('keeps full-volume BIAB when water plus grain fits the max safe capacity', () => {
    const plan = waterPlan(
      recipe({ batchSizeL: 20, fermentables: [{ name: 'Pale', amountKg: 4 }] }),
      { ...DEFAULT_EQUIPMENT, maxCapacityL: 40, kettleVolumeL: 50 },
    )
    expect(plan.needsSparge).toBe(false)
    expect(plan.mashWaterL).toBe(plan.totalWaterL)
    expect(plan.spargeWaterL).toBe(0)
  })

  it('switches to a sparge when water plus grain exceeds the max safe capacity', () => {
    const eq = { ...DEFAULT_EQUIPMENT, maxCapacityL: 32 }
    const plan = waterPlan(recipe({ batchSizeL: 23, fermentables: [{ name: 'Best Ale', amountKg: 4.15 }] }), eq)
    const displacement = 4.15 * eq.grainDisplacementLPerKg
    expect(plan.needsSparge).toBe(true)
    expect(plan.mashVolumeL).toBeCloseTo(32)
    expect(plan.mashWaterL).toBeCloseTo(32 - displacement)
    expect(plan.mashWaterL + plan.spargeWaterL).toBeCloseTo(plan.totalWaterL)
    // Thicker mash needs hotter strike water than the full-volume plan.
    expect(plan.strikeTempC).toBeGreaterThan(waterPlan(recipe({ batchSizeL: 23, fermentables: [{ name: 'Best Ale', amountKg: 4.15 }] }), { ...eq, maxCapacityL: 50, kettleVolumeL: 50 }).strikeTempC)
  })

  it('never uses more than the kettle size, even if max capacity is set higher', () => {
    const plan = waterPlan(recipe({ fermentables: [{ name: 'Pale', amountKg: 5 }] }), {
      ...DEFAULT_EQUIPMENT,
      kettleVolumeL: 30,
      maxCapacityL: 40,
    })
    expect(plan.capacityL).toBe(30)
    expect(plan.needsSparge).toBe(true)
  })

  it('warns about a too-thick mash and a pre-boil volume that will not fit', () => {
    const plan = waterPlan(recipe({ batchSizeL: 23, fermentables: [{ name: 'Pale', amountKg: 9 }] }), {
      ...DEFAULT_EQUIPMENT,
      maxCapacityL: 25,
    })
    expect(plan.mashTooThick).toBe(true)
    expect(plan.preBoilFits).toBe(false)
  })

  it('flags a mash that will not fit when the grain alone is over capacity', () => {
    const grain = { fermentables: [{ name: 'Pale', amountKg: 5 }] }
    expect(waterPlan(recipe(grain), { ...DEFAULT_EQUIPMENT, maxCapacityL: 32 }).mashFits).toBe(true)
    // A blank capacity input reaches the plan as 0.
    expect(waterPlan(recipe(grain), { ...DEFAULT_EQUIPMENT, maxCapacityL: 0 }).mashFits).toBe(false)
  })

  it('gives a 69°C strike for a 66°C mash on a typical 23 L full-volume brew', () => {
    const plan = waterPlan(
      recipe({ batchSizeL: 23, fermentables: [{ name: 'Best Ale', amountKg: 4.15 }] }),
      { ...DEFAULT_EQUIPMENT, maxCapacityL: 50, kettleVolumeL: 50 },
    )
    expect(Math.round(plan.strikeTempC)).toBe(69)
  })
})

describe('strikeTemp', () => {
  it('uses the infusion equation', () => {
    expect(strikeTemp(66, 18, 3)).toBeCloseTo(66 + (0.41 / 3) * 48)
  })
})

describe('gravityCorrection', () => {
  const r = recipe({ batchSizeL: 23, og: 1.043, fermentables: [{ name: 'Best Ale', amountKg: 4.15 }] })

  it('is a no-op when on target', () => {
    const plan = waterPlan(r, DEFAULT_EQUIPMENT)
    const c = gravityCorrection(r, DEFAULT_EQUIPMENT, plan.preBoilL, plan.preBoilGravity)
    expect(c.predictedOg).toBeCloseTo(1.043, 4)
    expect(c.dmeKg).toBeCloseTo(0, 4)
    expect(c.dilutionWaterL).toBeCloseTo(0, 4)
    expect(c.extendedBoilBatchL).toBeCloseTo(23, 4)
  })

  it('suggests dilution when the gravity is high', () => {
    const c = gravityCorrection(r, DEFAULT_EQUIPMENT, 29, 1.042)
    expect(c.predictedOg).toBeGreaterThan(1.043)
    expect(c.dilutionWaterL).toBeGreaterThan(0)
  })

  it('suggests DME or a longer boil when the gravity is low', () => {
    const c = gravityCorrection(r, DEFAULT_EQUIPMENT, 29, 1.034)
    expect(c.predictedOg).toBeLessThan(1.043)
    expect(c.dmeKg).toBeGreaterThan(0)
    expect(c.extraBoilMin).toBeGreaterThan(0)
    expect(c.extendedBoilBatchL).toBeLessThan(23)
  })
})

describe('kettle diameter', () => {
  const withDiameter = (d: number) => ({ ...DEFAULT_EQUIPMENT, kettleDiameterCm: d })

  it('is optional: no depths or suggestion without a diameter', () => {
    expect(depthCm(30, DEFAULT_EQUIPMENT)).toBeUndefined()
    expect(volumeFromDepthL(30, DEFAULT_EQUIPMENT)).toBeUndefined()
    expect(suggestedBoilOffLPerHr(DEFAULT_EQUIPMENT)).toBeUndefined()
  })

  it('converts between volume and ruler depth', () => {
    const eq = withDiameter(32)
    const area = Math.PI * 16 ** 2
    expect(depthCm(33.2, eq)).toBeCloseTo((33.2 * 1000) / area)
    expect(volumeFromDepthL(depthCm(29, eq)!, eq)).toBeCloseTo(29)
  })

  it("suggests about the Malt Miller's 3 L/hr for a typical 35 cm kettle", () => {
    expect(suggestedBoilOffLPerHr(withDiameter(35))).toBeCloseTo(3, 1)
  })

  it('suggests more boil-off for a wider kettle', () => {
    expect(suggestedBoilOffLPerHr(withDiameter(45))!).toBeGreaterThan(suggestedBoilOffLPerHr(withDiameter(35))!)
  })
})
