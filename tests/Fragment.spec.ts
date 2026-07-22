import Vue from 'vue'
import type { VueConstructor } from 'vue'
import Fragment from '../src/Fragment'

function mount<T extends Vue>(Component: VueConstructor<T>): T {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return new Component().$mount(host)
}

async function update(vm: Vue): Promise<void> {
  await vm.$nextTick()
}

describe('Fragment', () => {
  it('can be installed globally with Vue.use', () => {
    const LocalVue = Vue.extend()
    LocalVue.use(Fragment)
    const App = LocalVue.extend({
      render(createElement) {
        return createElement('main', [
          createElement('Fragment', [createElement('span', 'installed')]),
        ])
      },
    })
    const vm = mount(App)

    expect(vm.$el.outerHTML).toBe('<main><span>installed</span></main>')
    vm.$destroy()
  })

  it('renders multiple children without a wrapper element', () => {
    const vm = mount(
      Vue.extend({
        render(createElement) {
          return createElement('main', [
            createElement(Fragment, [
              createElement('span', { attrs: { id: 'first' } }, 'First'),
              createElement('span', { attrs: { id: 'second' } }, 'Second'),
            ]),
          ])
        },
      }),
    )

    expect(vm.$el.outerHTML).toBe(
      '<main><span id="first">First</span><span id="second">Second</span></main>',
    )
    vm.$destroy()
  })

  it('updates from an empty Fragment to a list and back', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ items: [] as number[] }),
        render(createElement) {
          return createElement('main', [
            createElement(
              Fragment,
              this.items.map((item) =>
                createElement('span', { key: item }, String(item)),
              ),
            ),
            createElement('footer', 'tail'),
          ])
        },
      }),
    )

    expect(vm.$el.querySelectorAll('span')).toHaveLength(0)
    vm.items = [1, 2]
    await update(vm)
    expect(vm.$el.innerHTML).toBe(
      '<span>1</span><span>2</span><footer>tail</footer>',
    )

    vm.items = []
    await update(vm)
    expect(vm.$el.querySelectorAll('span')).toHaveLength(0)
    expect(vm.$el.lastElementChild?.outerHTML).toBe('<footer>tail</footer>')
    vm.$destroy()
  })

  it('adds, removes, and reorders keyed children', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ items: [1, 2, 3] }),
        render(createElement) {
          return createElement('section', [
            createElement(
              Fragment,
              this.items.map((item) =>
                createElement('i', { key: item }, String(item)),
              ),
            ),
          ])
        },
      }),
    )

    vm.items = [3, 4, 1]
    await update(vm)
    expect(vm.$el.textContent).toBe('341')
    expect(Array.from(vm.$el.children).map((node) => node.textContent)).toEqual(
      ['3', '4', '1'],
    )
    vm.$destroy()
  })

  it('supports nested Fragments', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ visible: true }),
        render(createElement) {
          return createElement('section', [
            createElement(Fragment, [
              createElement('i', 'one'),
              createElement(
                Fragment,
                this.visible
                  ? [createElement('i', 'two'), createElement('i', 'three')]
                  : [],
              ),
            ]),
            createElement('footer', 'tail'),
          ])
        },
      }),
    )

    expect(vm.$el.querySelectorAll('i')).toHaveLength(3)
    vm.visible = false
    await update(vm)
    expect(vm.$el.querySelectorAll('i')).toHaveLength(1)
    expect(vm.$el.lastElementChild?.outerHTML).toBe('<footer>tail</footer>')
    vm.$destroy()
  })

  it('removes all Fragment children when the Fragment is unmounted', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ visible: true }),
        render(createElement) {
          return createElement('div', [
            this.visible
              ? createElement(Fragment, { key: 'fragment' }, [
                  createElement('span', 'one'),
                  createElement('span', 'two'),
                ])
              : createElement('strong', { key: 'replacement' }, 'gone'),
            createElement('footer', 'tail'),
          ])
        },
      }),
    )

    vm.visible = false
    await update(vm)
    expect(vm.$el.innerHTML).toBe('<strong>gone</strong><footer>tail</footer>')
    vm.$destroy()
  })
})
