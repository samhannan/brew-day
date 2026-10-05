import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BrewSheet from './BrewSheet.vue'
import { store } from '../store'
import { parseRecipeText } from '../lib/parser'
import { DARK_ROCK_SAMPLE } from '../lib/sample'
import { DEFAULT_EQUIPMENT } from '../lib/types'

describe('BrewSheet', () => {
  it('renders the BIAB plan for a parsed kit sheet', async () => {
    store.recipe = parseRecipeText(DARK_ROCK_SAMPLE).recipe
    const wrapper = mount(BrewSheet)
    expect(wrapper.text()).toContain('Tribute to Hobgoblin Gold')
    expect(wrapper.text()).toContain('29.2 L')
    expect(wrapper.text()).not.toContain('timer')
    expect(wrapper.find('button.check').exists()).toBe(false)
  })

  it('breaks the water down from the mash through to the fermenter', () => {
    store.recipe = parseRecipeText(DARK_ROCK_SAMPLE).recipe
    Object.assign(store.equipment, DEFAULT_EQUIPMENT, { maxCapacityL: 32 })
    const rows = mount(BrewSheet)
      .findAll('.breakdown tr')
      .map((tr) => tr.findAll('td').map((td) => td.text()))
    expect(rows.slice(0, 9)).toEqual([
      ['Mash water', '29.2 L'],
      ['− Grain absorption (1 L/kg)', '4.2 L'],
      ['+ Sparge water', '4.0 L'],
      ['= Pre-boil', '29.0 L'],
      ['− Boil-off (3 L/hr)', '3.0 L'],
      ['= End of boil', '26.0 L'],
      ['− Cooling shrinkage (4%)', '1.0 L'],
      ['− Trub', '2.0 L'],
      ['= Into fermenter', '23.0 L'],
    ])
  })

  it('assumes the planned pre-boil volume when only the SG is entered', async () => {
    store.recipe = parseRecipeText(DARK_ROCK_SAMPLE).recipe
    Object.assign(store.equipment, DEFAULT_EQUIPMENT)
    const wrapper = mount(BrewSheet)
    const [, sg] = wrapper.findAll('.gravity input')
    await sg.setValue(1.039)
    expect(wrapper.find('.gravity').text()).toContain('On target')
  })

  it('predicts OG from a measured pre-boil reading', async () => {
    store.recipe = parseRecipeText(DARK_ROCK_SAMPLE).recipe
    const wrapper = mount(BrewSheet)
    const [vol, sg] = wrapper.findAll('.gravity input')
    await vol.setValue(29)
    await sg.setValue(1.034)
    expect(wrapper.find('.gravity').text()).toContain('Low: add')
  })

  it('accepts a ruler depth in the gravity check when the diameter is set', async () => {
    store.recipe = parseRecipeText(DARK_ROCK_SAMPLE).recipe
    store.equipment.kettleDiameterCm = 32
    store.equipment.maxCapacityL = 40
    store.equipment.kettleVolumeL = 40
    const wrapper = mount(BrewSheet)
    expect(wrapper.text()).toContain('41.3 cm')
    const [depth, sg] = wrapper.findAll('.gravity input')
    await depth.setValue(36.1) // ≈ 29.0 L pre-boil in a 32 cm pot
    await sg.setValue(1.039)
    expect(wrapper.find('.gravity').text()).toContain('On target')
    Object.assign(store.equipment, DEFAULT_EQUIPMENT)
  })

  it('toggles every gravity check value between litres and cm', async () => {
    store.recipe = parseRecipeText(DARK_ROCK_SAMPLE).recipe
    Object.assign(store.equipment, DEFAULT_EQUIPMENT, { kettleDiameterCm: 32 })
    const wrapper = mount(BrewSheet)
    const gravity = () => wrapper.find('.gravity')
    await gravity().findAll('input')[1].setValue(1.045)
    expect(gravity().text()).toContain('Depth (cm)')
    expect(gravity().text()).toMatch(/add water to [\d.]+ cm/)

    await gravity().find('.units button:first-child').trigger('click')
    expect(gravity().text()).toContain('Volume (L)')
    expect(gravity().text()).toMatch(/add [\d.]+ L water/)
    expect(gravity().find('.out').text()).not.toContain('cm')
    Object.assign(store.equipment, DEFAULT_EQUIPMENT)
  })

  it('toggles the volumes card between litres and ruler depths', async () => {
    store.recipe = parseRecipeText(DARK_ROCK_SAMPLE).recipe
    Object.assign(store.equipment, DEFAULT_EQUIPMENT, { kettleDiameterCm: 32 })
    const wrapper = mount(BrewSheet)
    const values = () => wrapper.findAll('.card:first-child .row dd').map((dd) => dd.text())
    // Sparge water and fermenter aren't kettle levels, so they stay in litres.
    expect(values()).toEqual(['36.3 cm', '4.0 L', '36.1 cm', '32.4 cm', '23.0 L'])

    await wrapper.find('.card:first-child .units button:first-child').trigger('click')
    expect(values()).toEqual(['29.2 L', '4.0 L', '29.0 L', '26.0 L', '23.0 L'])
    Object.assign(store.equipment, DEFAULT_EQUIPMENT)
  })

  it('disables cm until the kettle diameter is set', () => {
    store.recipe = parseRecipeText(DARK_ROCK_SAMPLE).recipe
    Object.assign(store.equipment, DEFAULT_EQUIPMENT)
    const cm = mount(BrewSheet).find('.gravity .units button:last-child')
    expect(cm.attributes('disabled')).toBeDefined()
  })
})
