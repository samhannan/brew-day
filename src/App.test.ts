import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { store } from './store'

describe('App', () => {
  it('opens the burger menu and closes it when a section is picked', async () => {
    store.recipe = null
    const wrapper = mount(App, { attachTo: document.body })
    const burger = wrapper.find('.burger')
    expect(burger.attributes('aria-expanded')).toBe('false')

    await burger.trigger('click')
    expect(burger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('nav').classes()).toContain('open')

    await wrapper.findAll('.tab').find((t) => t.text() === 'Equipment')!.trigger('click')
    expect(wrapper.find('nav').classes()).not.toContain('open')
    expect(wrapper.find('.tab.active').text()).toBe('Equipment')
    wrapper.unmount()
  })

  it('closes the burger menu on Escape or a click outside the header', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const nav = () => wrapper.find('nav')

    await wrapper.find('.burger').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(nav().classes()).not.toContain('open')

    await wrapper.find('.burger').trigger('click')
    document.body.click()
    await wrapper.vm.$nextTick()
    expect(nav().classes()).not.toContain('open')
    wrapper.unmount()
  })
})
