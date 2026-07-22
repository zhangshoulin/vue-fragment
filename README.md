# @shoulinzhang/vue-fragment

为 Vue 2.6 及更高版本提供无包裹元素的 `Fragment` 组件，作用与 Vue 3 的 Fragment 或 React Fragment 类似。

## 特性

- 不生成额外的 DOM 包裹元素
- 支持多个同级子节点和嵌套 Fragment
- 使用 TypeScript 编写并提供类型声明
- 同时提供 ESM 和 CommonJS 产物
- 支持 Vue 2.6.x 和 Vue 2.7.x

## 安装

```bash
npm install @shoulinzhang/vue-fragment
```

项目需要自行安装 Vue 2：

```bash
npm install vue@^2.6.0
```

## 使用

局部注册：

```vue
<template>
  <main>
    <Fragment>
      <h1>Title</h1>
      <p>Content</p>
    </Fragment>
  </main>
</template>

<script>
import Fragment from '@shoulinzhang/vue-fragment'

export default {
  components: { Fragment },
}
</script>
```

通过 `Vue.use` 全局安装：

```ts
import Vue from 'vue'
import Fragment from '@shoulinzhang/vue-fragment'

Vue.use(Fragment)
```

安装后可以在任意组件模板中直接使用 `<Fragment>`。也可以继续使用
`Vue.component('Fragment', Fragment)` 手动注册。

使用 render 函数：

```ts
import Vue from 'vue'
import Fragment from '@shoulinzhang/vue-fragment'

export default Vue.extend({
  render(h) {
    return h('main', [h(Fragment, [h('h1', 'Title'), h('p', 'Content')])])
  },
})
```

## 注意事项

`Fragment` 不会渲染根 DOM 元素，因此传给它的 `class`、`style`、原生事件或普通 HTML attribute 没有可附着的目标。请把这些内容直接设置在 Fragment 的子节点上。

Vue 2 的页面或组件模板本身仍然必须只有一个根节点。`Fragment` 用于已存在的父元素内部，无法取消 Vue 2 模板最外层的单根限制。

## 开发

```bash
npm install
npm test
npm run typecheck
npm run build
```

运行全部发布前检查：

```bash
npm run check
```

## 浏览器支持

构建目标为 ES2015。如果项目需要支持更旧的浏览器，请由最终应用的构建工具对依赖进行转译。

## License

[MIT](./LICENSE)
