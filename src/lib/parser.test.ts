import { describe, expect, it } from 'vitest'
import { parseRecipeText, parseTiming } from './parser'
import { DARK_ROCK_SAMPLE } from './sample'

describe('parseRecipeText — Dark Rock kit sheet', () => {
  const { recipe, warnings } = parseRecipeText(DARK_ROCK_SAMPLE)

  it('reads the headline figures', () => {
    expect(recipe.name).toBe('Tribute to Hobgoblin Gold')
    expect(recipe.og).toBeCloseTo(1.043)
    expect(recipe.fg).toBeCloseTo(1.011)
    expect(recipe.batchSizeL).toBe(23)
    expect(recipe.abv).toBe(4.2)
    expect(recipe.ibu).toBe(45)
    expect(recipe.boilTimeMin).toBe(60)
  })

  it('reads comma-separated malts with mixed units', () => {
    expect(recipe.fermentables).toEqual([
      { name: 'Best Ale', amountKg: 3.9 },
      { name: 'Torrefied Wheat', amountKg: 0.25 },
    ])
  })

  it('maps hop packs onto hops and their timings', () => {
    expect(recipe.hops).toEqual([
      { name: 'Challenger', grams: 15, use: 'boil', time: 60, pack: 'Pack A' },
      { name: 'Citra', grams: 30, use: 'boil', time: 15, pack: 'Pack B' },
      { name: 'Nelson Sauvin', grams: 30, use: 'whirlpool', time: 15, pack: 'Pack C' },
    ])
    expect(warnings.some((w) => w.includes('B & C'))).toBe(true)
  })

  it('reads the mash and the Grainfather water volumes', () => {
    expect(recipe.mashSteps).toEqual([{ name: 'Mash', tempC: 66, timeMin: 60 }])
    expect(recipe.sheetMashWaterL).toBe(14.5)
    expect(recipe.sheetSpargeWaterL).toBe(16.5)
    expect(recipe.sheetSpargeTempC).toBe('76-77')
  })

  it('classifies yeast and extras', () => {
    expect(recipe.yeast.name).toBe('Choice of Premium Beer Yeast')
    const byName = Object.fromEntries(recipe.extras.map((e) => [e.name, e]))
    expect(byName['Brite Wort']).toMatchObject({ stage: 'boil', timeMin: 15 })
    expect(byName['Starbrite Beer Finings'].stage).toBe('fermenter')
    expect(byName['Pure Brew'].stage).toBe('water')
  })
})

describe('parseRecipeText — one-ingredient-per-line recipe', () => {
  const { recipe } = parseRecipeText(`Simple Pale
Batch size: 20 L
OG: 1.050
FG: 1.012
Boil time: 75 minutes
Fermentables:
Maris Otter - 4.5 kg
Crystal 60 - 300 g
Hops:
Cascade 20g @ 60 min
Cascade 30g @ 10 min
Citra 50g dry hop day 4
Yeast:
Safale US-05
Mash 67°C for 60 min
Mash out 75°C 10 min`)

  it('parses sections, timings and multiple mash steps', () => {
    expect(recipe.batchSizeL).toBe(20)
    expect(recipe.og).toBeCloseTo(1.05)
    expect(recipe.boilTimeMin).toBe(75)
    expect(recipe.fermentables).toEqual([
      { name: 'Maris Otter', amountKg: 4.5 },
      { name: 'Crystal 60', amountKg: 0.3 },
    ])
    expect(recipe.hops.map((h) => [h.name, h.use, h.time])).toEqual([
      ['Cascade', 'boil', 60],
      ['Cascade', 'boil', 10],
      ['Citra dry hop day 4', 'dry-hop', 4],
    ])
    expect(recipe.yeast.name).toBe('Safale US-05')
    expect(recipe.mashSteps.map((s) => [s.name, s.tempC, s.timeMin])).toEqual([
      ['Mash', 67, 60],
      ['Mash out', 75, 10],
    ])
  })
})

describe('parseTiming', () => {
  it.each([
    ['Add at the start of the boil', { use: 'boil', time: 60 }],
    ['Add after 45 minutes of the boil', { use: 'boil', time: 15 }],
    ['Add at the end of the boil (Flameout) and leave for 15 minutes', { use: 'whirlpool', time: 15 }],
    ['10 minutes before the end', { use: 'boil', time: 10 }],
    ['@ 30', { use: 'boil', time: 30 }],
    ['Dry hop on day 3', { use: 'dry-hop', time: 3 }],
    ['First wort hop', { use: 'first-wort', time: 60 }],
  ])('%s', (text, expected) => {
    expect(parseTiming(text, 60)).toEqual(expected)
  })
})
