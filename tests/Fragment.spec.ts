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

  it('updates mixed text and element children', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ label: 'before', visible: true }),
        render(createElement) {
          return createElement('main', [
            createElement(Fragment, [
              this.label,
              this.visible ? createElement('span', 'middle') : null,
              'tail',
            ]),
          ])
        },
      }),
    )

    expect(vm.$el.innerHTML).toBe('before<span>middle</span>tail')
    vm.label = 'after'
    vm.visible = false
    await update(vm)
    expect(vm.$el.innerHTML).toBe('aftertail')
    vm.$destroy()
  })

  it('updates multiple sibling Fragments independently', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ left: [1], right: ['a', 'b'] }),
        render(createElement) {
          return createElement('main', [
            createElement(
              Fragment,
              this.left.map((item) =>
                createElement('i', { key: item }, String(item)),
              ),
            ),
            createElement('hr'),
            createElement(
              Fragment,
              this.right.map((item) => createElement('b', { key: item }, item)),
            ),
          ])
        },
      }),
    )

    vm.left = [2, 1]
    vm.right = []
    await update(vm)
    expect(vm.$el.innerHTML).toBe('<i>2</i><i>1</i><hr><!---->')
    vm.$destroy()
  })

  it('inserts a keyed sibling before a Fragment', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ prefixed: false }),
        render(createElement) {
          return createElement('main', [
            ...(this.prefixed
              ? [createElement('strong', { key: 'prefix' }, 'prefix')]
              : []),
            createElement(Fragment, { key: 'fragment' }, [
              createElement('i', 'one'),
              createElement('i', 'two'),
            ]),
          ])
        },
      }),
    )

    vm.prefixed = true
    await update(vm)
    expect(vm.$el.innerHTML).toBe('<strong>prefix</strong><i>one</i><i>two</i>')
    vm.$destroy()
  })

  it('moves a keyed Fragment as a single group', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ flipped: false }),
        render(createElement) {
          const group = createElement(Fragment, { key: 'group' }, [
            createElement('i', 'one'),
            createElement('i', 'two'),
          ])
          const single = createElement('strong', { key: 'single' }, 'single')
          return createElement(
            'main',
            this.flipped ? [single, group] : [group, single],
          )
        },
      }),
    )

    vm.flipped = true
    await update(vm)
    expect(vm.$el.innerHTML).toBe('<strong>single</strong><i>one</i><i>two</i>')

    vm.flipped = false
    await update(vm)
    expect(vm.$el.innerHTML).toBe('<i>one</i><i>two</i><strong>single</strong>')
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

  it('moves a nested keyed Fragment inside another Fragment', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ flipped: false }),
        render(createElement) {
          const group = createElement(Fragment, { key: 'group' }, [
            createElement('i', 'one'),
            createElement('i', 'two'),
          ])
          const single = createElement('strong', { key: 'single' }, 'single')
          return createElement('main', [
            createElement(
              Fragment,
              this.flipped ? [single, group] : [group, single],
            ),
          ])
        },
      }),
    )

    vm.flipped = true
    await update(vm)
    expect(vm.$el.innerHTML).toBe('<strong>single</strong><i>one</i><i>two</i>')
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

  it('destroys child components when a Fragment is unmounted', async () => {
    const destroyed = vi.fn()
    const Child = Vue.extend({
      destroyed,
      render(createElement) {
        return createElement('span', 'child')
      },
    })
    const vm = mount(
      Vue.extend({
        data: () => ({ visible: true }),
        render(createElement) {
          return createElement('main', [
            this.visible
              ? createElement(Fragment, { key: 'fragment' }, [
                  createElement(Child),
                ])
              : null,
          ])
        },
      }),
    )

    vm.visible = false
    await update(vm)
    expect(destroyed).toHaveBeenCalledTimes(1)
    expect(vm.$el.querySelector('span')).toBeNull()
    vm.$destroy()
  })

  it('supports a Fragment as the rendered root', async () => {
    const container = document.createElement('div')
    const host = document.createElement('div')
    container.appendChild(host)
    document.body.appendChild(container)
    const vm = new Vue({
      data: () => ({ items: [1, 2] }),
      render(createElement) {
        return createElement(
          Fragment,
          this.items.map((item) =>
            createElement('span', { key: item }, String(item)),
          ),
        )
      },
    }).$mount(host)

    expect(container.innerHTML).toBe('<span>1</span><span>2</span>')
    vm.items = [2, 3]
    await update(vm)
    expect(container.innerHTML).toBe('<span>2</span><span>3</span>')

    vm.$destroy()
    container.remove()
  })

  it('survives repeated empty and non-empty transitions', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ items: [] as number[] }),
        render(createElement) {
          return createElement('main', [
            createElement('header', 'head'),
            createElement(
              Fragment,
              this.items.map((item) =>
                createElement('i', { key: item }, String(item)),
              ),
            ),
            createElement('footer', 'tail'),
          ])
        },
      }),
    )

    for (const items of [[1], [], [2, 3], [], [4]]) {
      vm.items = items
      await update(vm)
      expect(
        Array.from(vm.$el.children).map((node) => node.textContent),
      ).toEqual(['head', ...items.map(String), 'tail'])
    }
    vm.$destroy()
  })

  it('reorders multiple keyed Fragment groups', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ groups: ['a', 'b', 'c'] }),
        render(createElement) {
          return createElement(
            'main',
            this.groups.map((group) =>
              createElement(Fragment, { key: group }, [
                createElement('i', `${group}1`),
                createElement('i', `${group}2`),
              ]),
            ),
          )
        },
      }),
    )

    vm.groups = ['c', 'a', 'b']
    await update(vm)
    expect(Array.from(vm.$el.children).map((node) => node.textContent)).toEqual(
      ['c1', 'c2', 'a1', 'a2', 'b1', 'b2'],
    )
    vm.$destroy()
  })

  it('moves an empty keyed Fragment before populating it', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ flipped: false, populated: false }),
        render(createElement) {
          const group = createElement(
            Fragment,
            { key: 'group' },
            this.populated ? [createElement('i', 'group')] : [],
          )
          const single = createElement('strong', { key: 'single' }, 'single')
          return createElement(
            'main',
            this.flipped ? [single, group] : [group, single],
          )
        },
      }),
    )

    vm.flipped = true
    await update(vm)
    vm.populated = true
    await update(vm)
    expect(Array.from(vm.$el.children).map((node) => node.textContent)).toEqual(
      ['single', 'group'],
    )
    vm.$destroy()
  })

  it('preserves child component identity when its Fragment moves', async () => {
    const created = vi.fn()
    const destroyed = vi.fn()
    const Child = Vue.extend({
      created,
      destroyed,
      render(createElement) {
        return createElement('span', 'child')
      },
    })
    const vm = mount(
      Vue.extend({
        data: () => ({ flipped: false }),
        render(createElement) {
          const group = createElement(Fragment, { key: 'group' }, [
            createElement(Child, { key: 'child' }),
          ])
          const single = createElement('strong', { key: 'single' }, 'single')
          return createElement(
            'main',
            this.flipped ? [single, group] : [group, single],
          )
        },
      }),
    )

    const childElement = vm.$el.querySelector('span')
    vm.flipped = true
    await update(vm)
    expect(vm.$el.querySelector('span')).toBe(childElement)
    expect(created).toHaveBeenCalledTimes(1)
    expect(destroyed).not.toHaveBeenCalled()
    vm.$destroy()
  })

  it('preserves live DOM state and events when a Fragment moves', async () => {
    const clicked = vi.fn()
    const vm = mount(
      Vue.extend({
        data: () => ({ flipped: false }),
        render(createElement) {
          const group = createElement(Fragment, { key: 'group' }, [
            createElement('input', {
              key: 'input',
              attrs: { value: 'initial' },
              on: { click: clicked },
            }),
          ])
          const single = createElement('span', { key: 'single' }, 'single')
          return createElement(
            'main',
            this.flipped ? [single, group] : [group, single],
          )
        },
      }),
    )

    const input = vm.$el.querySelector('input') as HTMLInputElement
    input.value = 'typed'
    vm.flipped = true
    await update(vm)
    const movedInput = vm.$el.querySelector('input') as HTMLInputElement
    movedInput.click()
    expect(movedInput).toBe(input)
    expect(movedInput.value).toBe('typed')
    expect(clicked).toHaveBeenCalledTimes(1)
    vm.$destroy()
  })

  it('replaces one keyed Fragment with another', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ version: 'old' }),
        render(createElement) {
          return createElement('main', [
            createElement(Fragment, { key: this.version }, [
              createElement('i', this.version),
              createElement('b', this.version),
            ]),
            createElement('footer', 'tail'),
          ])
        },
      }),
    )

    vm.version = 'new'
    await update(vm)
    expect(vm.$el.innerHTML).toBe('<i>new</i><b>new</b><footer>tail</footer>')
    vm.$destroy()
  })

  it('keeps element refs inside a Fragment in sync', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ visible: true }),
        render(createElement) {
          return createElement('main', [
            createElement(
              Fragment,
              this.visible
                ? [createElement('span', { ref: 'target' }, 'target')]
                : [],
            ),
          ])
        },
      }),
    )

    expect((vm.$refs.target as Element).textContent).toBe('target')
    vm.visible = false
    await update(vm)
    expect(vm.$refs.target).toBeUndefined()
    vm.visible = true
    await update(vm)
    expect((vm.$refs.target as Element).textContent).toBe('target')
    vm.$destroy()
  })

  it('preserves SVG namespaces without a wrapper element', () => {
    const vm = mount(
      Vue.extend({
        render(createElement) {
          return createElement('svg', [
            createElement(Fragment, [
              createElement('circle', { attrs: { id: 'dot' } }),
              createElement('text', 'label'),
            ]),
          ])
        },
      }),
    )

    const svg = vm.$el as SVGElement
    expect(Array.from(svg.children).map((node) => node.tagName)).toEqual([
      'circle',
      'text',
    ])
    expect(svg.querySelector('#dot')?.namespaceURI).toBe(
      'http://www.w3.org/2000/svg',
    )
    vm.$destroy()
  })

  it('renders and reorders table rows without an invalid wrapper', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ rows: [1, 2] }),
        render(createElement) {
          return createElement('table', [
            createElement('tbody', [
              createElement(
                Fragment,
                this.rows.map((row) =>
                  createElement('tr', { key: row }, [
                    createElement('td', String(row)),
                  ]),
                ),
              ),
            ]),
          ])
        },
      }),
    )

    vm.rows = [2, 3, 1]
    await update(vm)
    expect(
      Array.from(vm.$el.querySelectorAll('td')).map((node) => node.textContent),
    ).toEqual(['2', '3', '1'])
    expect(vm.$el.querySelector('tbody')?.children).toHaveLength(3)
    vm.$destroy()
  })

  it('updates an empty Fragment rendered as the root', async () => {
    const container = document.createElement('div')
    const host = document.createElement('div')
    container.appendChild(host)
    document.body.appendChild(container)
    const vm = new Vue({
      data: () => ({ visible: false }),
      render(createElement) {
        return createElement(
          Fragment,
          this.visible ? [createElement('span', 'visible')] : [],
        )
      },
    }).$mount(host)

    expect(container.querySelector('span')).toBeNull()
    vm.visible = true
    await update(vm)
    expect(container.querySelector('span')?.textContent).toBe('visible')
    vm.visible = false
    await update(vm)
    expect(container.querySelector('span')).toBeNull()

    vm.$destroy()
    container.remove()
  })

  it('handles a sequence of Fragment group additions, removals, and moves', async () => {
    interface Group {
      id: string
      items: number[]
    }

    const vm = mount(
      Vue.extend({
        data: () => ({ groups: [] as Group[] }),
        render(createElement) {
          return createElement(
            'main',
            this.groups.map((group) =>
              createElement(
                Fragment,
                { key: group.id },
                group.items.map((item) =>
                  createElement(
                    'i',
                    { key: `${group.id}-${item}` },
                    `${group.id}${item}`,
                  ),
                ),
              ),
            ),
          )
        },
      }),
    )
    const states: Group[][] = [
      [
        { id: 'a', items: [1, 2] },
        { id: 'b', items: [] },
      ],
      [
        { id: 'b', items: [3] },
        { id: 'a', items: [2, 4, 1] },
        { id: 'c', items: [5] },
      ],
      [
        { id: 'c', items: [] },
        { id: 'b', items: [6, 3] },
      ],
      [],
      [
        { id: 'a', items: [7] },
        { id: 'c', items: [8, 9] },
      ],
    ]

    for (const groups of states) {
      vm.groups = groups
      await update(vm)
      expect(
        Array.from(vm.$el.children).map((node) => node.textContent),
      ).toEqual(
        groups.reduce<string[]>((items, group) => {
          items.push(...group.items.map((item) => `${group.id}${item}`))
          return items
        }, []),
      )
    }
    vm.$destroy()
  })

  it('restores content through three levels of nested Fragments', async () => {
    const vm = mount(
      Vue.extend({
        data: () => ({ visible: true, label: 'deep' }),
        render(createElement) {
          return createElement('main', [
            createElement(Fragment, [
              createElement('span', 'before'),
              createElement(Fragment, [
                createElement(
                  Fragment,
                  this.visible ? [createElement('i', this.label)] : [],
                ),
              ]),
              createElement('span', 'after'),
            ]),
          ])
        },
      }),
    )

    vm.visible = false
    await update(vm)
    expect(vm.$el.textContent).toBe('beforeafter')
    vm.label = 'restored'
    vm.visible = true
    await update(vm)
    expect(vm.$el.textContent).toBe('beforerestoredafter')
    vm.$destroy()
  })

  it('preserves child directive insertion and cleanup hooks', async () => {
    const inserted = vi.fn()
    const unbind = vi.fn()
    const vm = mount(
      Vue.extend({
        directives: {
          probe: { inserted, unbind },
        },
        data: () => ({ visible: true }),
        render(createElement) {
          return createElement('main', [
            createElement(
              Fragment,
              this.visible
                ? [
                    createElement('span', {
                      directives: [{ name: 'probe' }],
                    }),
                  ]
                : [],
            ),
          ])
        },
      }),
    )

    expect(inserted).toHaveBeenCalledTimes(1)
    vm.visible = false
    await update(vm)
    expect(unbind).toHaveBeenCalledTimes(1)
    vm.$destroy()
  })
})
