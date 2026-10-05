export interface Fermentable {
  name: string
  amountKg: number
}

export type HopUse = 'first-wort' | 'boil' | 'whirlpool' | 'dry-hop'

export interface HopAddition {
  name: string
  grams: number
  use: HopUse
  /** boil/first-wort: minutes remaining in the boil; whirlpool: steep minutes; dry-hop: fermentation day */
  time: number
  /** Kit pack label, e.g. "Pack B" */
  pack?: string
}

export interface MashStep {
  name: string
  tempC: number
  timeMin: number
}

export type ExtraStage = 'water' | 'mash' | 'boil' | 'flameout' | 'fermenter' | 'packaging' | 'other'

export interface Extra {
  name: string
  stage: ExtraStage
  /** For boil extras: minutes remaining in the boil */
  timeMin?: number
  note?: string
}

export interface Recipe {
  name: string
  batchSizeL: number
  og: number
  fg: number
  boilTimeMin: number
  abv?: number
  ibu?: number
  colourEbc?: number
  fermentables: Fermentable[]
  hops: HopAddition[]
  mashSteps: MashStep[]
  yeast: { name: string; tempC?: number }
  extras: Extra[]
  /** Volumes from the original (Grainfather-style) sheet, shown for reference only */
  sheetMashWaterL?: number
  sheetSpargeWaterL?: number
  sheetSpargeTempC?: string
}

export interface Equipment {
  kettleVolumeL: number
  /** Most water + grain you can safely mash in the kettle; beyond this the plan switches to a sparge */
  maxCapacityL: number
  /** Inside diameter; 0 when unknown. Enables ruler-depth readings and a boil-off estimate. */
  kettleDiameterCm: number
  boilOffLPerHr: number
  grainAbsorptionLPerKg: number
  /** Trub, hop debris and wort left in the kettle that never reaches the fermenter */
  kettleLossL: number
  /** Wort volume lost as it cools from boiling to pitching temperature */
  coolingShrinkagePct: number
  grainDisplacementLPerKg: number
  grainTempC: number
  /** Extra degrees added to the calculated strike temp to cover kettle/bag heat loss */
  strikeAllowanceC: number
}

export const DEFAULT_EQUIPMENT: Equipment = {
  kettleVolumeL: 35,
  // Leaves a few litres of headroom for stirring and lifting the bag.
  maxCapacityL: 32,
  kettleDiameterCm: 0,
  // Malt Miller BIAB rules of thumb
  boilOffLPerHr: 3,
  grainAbsorptionLPerKg: 1,
  // Batch size means clean beer into the fermenter, so trub left behind is extra wort to make.
  kettleLossL: 2,
  coolingShrinkagePct: 4,
  grainDisplacementLPerKg: 0.67,
  grainTempC: 18,
  // Calibrated from real brews: 69°C strike settles at 66°C for a typical 23 L full-volume mash.
  strikeAllowanceC: 0.5,
}

export function emptyRecipe(): Recipe {
  return {
    name: '',
    batchSizeL: 23,
    og: 1.05,
    fg: 1.01,
    boilTimeMin: 60,
    fermentables: [],
    hops: [],
    mashSteps: [{ name: 'Mash', tempC: 66, timeMin: 60 }],
    yeast: { name: '' },
    extras: [],
  }
}
