import { describe, expect, it } from 'vitest'
import { parseRecipeText } from './parser'
import { buildBrewSheet } from './sheet'
import { DARK_ROCK_SAMPLE } from './sample'
import { DEFAULT_EQUIPMENT } from './types'

describe('buildBrewSheet — Dark Rock kit converted to BIAB', () => {
  const { recipe } = parseRecipeText(DARK_ROCK_SAMPLE)
  // A kettle the full Dark Rock volume fits in, so these tests cover plain full-volume BIAB.
  const fullVolume = { ...DEFAULT_EQUIPMENT, kettleVolumeL: 40, maxCapacityL: 40 }
  const sheet = buildBrewSheet(recipe, fullVolume)

  it('lists the key volumes', () => {
    expect(sheet.volumes).toEqual([
      { label: 'Total water', value: '33.2 L', sub: undefined },
      { label: 'Pre-boil', value: '29.0 L', sub: undefined },
      { label: 'End of boil', value: '26.0 L', sub: undefined },
      { label: 'Into fermenter', value: '23.0 L' },
    ])
  })

  it('lists temperatures and times', () => {
    expect(sheet.temps).toEqual([
      { label: 'Strike', value: '69°C' },
      { label: 'Mash', value: '66°C · 60 min' },
      { label: 'Boil', value: '60 min' },
      { label: 'Flameout steep', value: '15 min' },
      { label: 'Ferment', value: '19°C' },
    ])
  })

  it('lists gravities', () => {
    expect(sheet.gravity.map((r) => [r.label, r.value])).toEqual([
      ['Pre-boil', '1.039'],
      ['OG', '1.043'],
      ['FG', '1.011'],
      ['ABV', '4.2%'],
    ])
  })

  it('puts every addition in one timeline', () => {
    expect(sheet.additions).toEqual([
      { when: 'Water', what: 'Pure Brew' },
      { when: '60 min', what: 'Pack A · 15g Challenger' },
      { when: '15 min', what: 'Pack B · 30g Citra' },
      { when: '15 min', what: 'Brite Wort' },
      { when: 'Flameout', what: 'Pack C · 30g Nelson Sauvin' },
      { when: 'End of ferment', what: 'Starbrite Beer Finings' },
    ])
  })


  it('shows ruler depths when the kettle diameter is known', () => {
    const withDiameter = buildBrewSheet(recipe, { ...fullVolume, kettleDiameterCm: 32 })
    expect(withDiameter.volumes[0]).toEqual({ label: 'Total water', value: '33.2 L', sub: '41.3 cm' })
  })

  it('splits mash and sparge water when the full volume will not fit', () => {
    const sparged = buildBrewSheet(recipe, { ...DEFAULT_EQUIPMENT, maxCapacityL: 32 })
    expect(sparged.volumes.map((r) => r.label)).toEqual(['Mash water', 'Sparge water', 'Pre-boil', 'End of boil', 'Into fermenter'])
    expect(sparged.volumes[1].value).toBe('4.0 L')
    expect(sparged.temps).toContainEqual({ label: 'Sparge', value: '76-77°C' })
  })
})
