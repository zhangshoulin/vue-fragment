import type {
  FunctionalComponentOptions,
  RenderContext,
  VNode,
  VNodeData,
  VueConstructor,
} from 'vue'

const CHANGE_TYPE = {
  EMPTY_TO_EMPTY: 0,
  EMPTY_TO_LIST: 1,
  LIST_TO_EMPTY: 2,
  LIST_TO_LIST: 3,
} as const

type ChangeType = (typeof CHANGE_TYPE)[keyof typeof CHANGE_TYPE]

interface FragmentState {
  anchor: Comment
  children: Node[]
  changeType: ChangeType
}

interface FragmentNode extends DocumentFragment {
  fragmentState: FragmentState
  _parentNode: Node | null
}

interface FragmentVNode extends VNode {
  children: VNode[]
  elm: FragmentNode
  fragment?: FragmentNode
}

interface FragmentAwareNode extends Node {
  fragmentNode?: FragmentNode
}

export type FragmentProps = Record<string, never>

export interface FragmentComponent
  extends FunctionalComponentOptions<FragmentProps> {
  install(Vue: VueConstructor): void
}

function isValidContainer(node: Node | null): node is Node {
  return Boolean(
    node &&
      (node.nodeType === Node.ELEMENT_NODE ||
        node.nodeType === Node.DOCUMENT_NODE ||
        node.nodeType === Node.DOCUMENT_FRAGMENT_NODE),
  )
}

function isFragmentNode(node: Node): node is FragmentNode {
  return (
    node.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
    Boolean((node as FragmentNode).fragmentState)
  )
}

function getFragmentState(node: Node): FragmentState | null {
  const fragmentNode = (node as FragmentAwareNode).fragmentNode
  if (fragmentNode) {
    return fragmentNode.fragmentState
  }
  return isFragmentNode(node) ? node.fragmentState : null
}

const insertBeforePatched = Symbol('fragmentInsertBeforePatched')

type FragmentBoundary = 'first' | 'last'

function getFragmentBoundaryNode(node: Node, boundary: FragmentBoundary): Node {
  const fragmentState = getFragmentState(node)
  if (!fragmentState) {
    return node
  }

  const { anchor, children } = fragmentState
  if (!children.length) {
    return anchor
  }

  const boundaryNode =
    boundary === 'first' ? children[0] : children[children.length - 1]
  return getFragmentBoundaryNode(boundaryNode, boundary)
}

function getFragmentNodeFirstChild(node: Node): Node {
  return getFragmentBoundaryNode(node, 'first')
}

function getFragmentNodeLastChild(node: Node): Node {
  return getFragmentBoundaryNode(node, 'last')
}

function removeNode(node: Node): void {
  const fragmentState = getFragmentState(node)
  if (fragmentState) {
    fragmentState.children.forEach(removeNode)
    fragmentState.anchor.parentNode?.removeChild(fragmentState.anchor)
    return
  }
  node.parentNode?.removeChild(node)
}

function getFragmentLeafNodes(node: Node): Node[] {
  const fragmentState = getFragmentState(node)
  if (!fragmentState) {
    return [node]
  }

  const children = fragmentState.children.length
    ? fragmentState.children
    : [fragmentState.anchor]
  const leafNodes: Node[] = []
  children.forEach((child) => {
    leafNodes.push(...getFragmentLeafNodes(child))
  })
  return leafNodes
}

function patchContainer(container: Node): void {
  const patchedContainer = container as Node & {
    [insertBeforePatched]?: boolean
  }
  if (isFragmentNode(container) || patchedContainer[insertBeforePatched]) {
    return
  }

  patchedContainer[insertBeforePatched] = true
  const originalInsertBefore = container.insertBefore
  container.insertBefore = function <T extends Node>(
    newChild: T,
    referenceChild: Node | null,
  ): T {
    const reference =
      referenceChild && getFragmentState(referenceChild)
        ? getFragmentNodeFirstChild(referenceChild)
        : referenceChild
    const fragmentState = getFragmentState(newChild)
    if (fragmentState) {
      const leafNodes = getFragmentLeafNodes(newChild)
      if (reference && leafNodes.indexOf(reference) !== -1) {
        return newChild
      }
      leafNodes.forEach((child) => {
        originalInsertBefore.call(this, child, reference)
      })
      return newChild
    }
    return originalInsertBefore.call(this, newChild, reference) as T
  }

  const originalRemoveChild = container.removeChild
  container.removeChild = function <T extends Node>(child: T): T {
    if (isFragmentNode(child)) {
      removeNode(child)
      return child
    }
    return originalRemoveChild.call(this, child) as T
  }
}

const Fragment: FragmentComponent = {
  name: 'Fragment',
  functional: true,
  install(Vue) {
    const register = Vue.component as unknown as (
      name: string,
      component: FunctionalComponentOptions<FragmentProps>,
    ) => void
    register.call(Vue, 'Fragment', Fragment)
  },
  render(createElement, context: RenderContext<FragmentProps>): VNode {
    const vnode = createElement(
      'div',
      { key: context.data.key },
      context.children,
    )
    vnode.isComment = true
    vnode.data = {
      hook: {
        create(_oldVNode: VNode, currentVNode: VNode) {
          const fragment = document.createDocumentFragment() as FragmentNode
          const element = currentVNode.elm as Element
          const children = Array.from(element.childNodes)
          const fragmentState: FragmentState = {
            anchor: document.createComment(''),
            children,
            changeType: CHANGE_TYPE.EMPTY_TO_EMPTY,
          }

          children.forEach((child) => fragment.appendChild(child))
          fragment.fragmentState = fragmentState
          fragment._parentNode = null
          Object.defineProperty(fragment, 'parentNode', {
            get(this: FragmentNode) {
              return this._parentNode && isFragmentNode(this._parentNode)
                ? this._parentNode.parentNode
                : this._parentNode
            },
            configurable: true,
          })
          ;(currentVNode as FragmentVNode).fragment = fragment
        },

        insert(currentVNode: VNode) {
          const fragmentVNode = currentVNode as FragmentVNode
          const fragment = fragmentVNode.fragment as FragmentNode
          const fragmentState = fragment.fragmentState
          if (!fragmentState.children.length) {
            fragment.appendChild(fragmentState.anchor)
          }

          const element = currentVNode.elm as FragmentAwareNode
          const parentNode = element.parentNode
          if (!isValidContainer(parentNode)) {
            throw new Error(
              'Fragment needs to be mounted onto a valid DOM element',
            )
          }

          element.fragmentNode = fragment
          patchContainer(parentNode)
          fragment._parentNode = parentNode
          parentNode.replaceChild(fragment, element)

          fragment.insertBefore = function <T extends Node>(
            newChild: T,
            referenceChild: Node | null,
          ): T {
            if (referenceChild?.parentNode) {
              return referenceChild.parentNode.insertBefore(
                newChild,
                referenceChild,
              ) as T
            }
            if (getFragmentState(newChild) && this.parentNode) {
              return this.parentNode.insertBefore(
                newChild,
                this.nextSibling,
              ) as T
            }
            return Node.prototype.insertBefore.call(
              this,
              newChild,
              referenceChild,
            ) as T
          }
          Object.defineProperty(fragment, 'nextSibling', {
            get(this: FragmentNode) {
              return getFragmentNodeLastChild(this).nextSibling
            },
            configurable: true,
          })
          fragmentVNode.elm = fragment
        },

        prepatch(_oldVNode: VNode, currentVNode: VNode) {
          const fragmentVNode = currentVNode as FragmentVNode
          const newChildren = fragmentVNode.children || []
          const fragmentState = fragmentVNode.elm.fragmentState
          const { anchor } = fragmentState
          const parentNode = fragmentVNode.elm.parentNode
          if (!parentNode) {
            return
          }

          if (fragmentState.children.length && newChildren.length === 0) {
            fragmentState.changeType = CHANGE_TYPE.LIST_TO_EMPTY
            parentNode.insertBefore(
              anchor,
              getFragmentNodeFirstChild(fragmentVNode.elm),
            )
          } else if (!fragmentState.children.length && newChildren.length) {
            fragmentState.changeType = CHANGE_TYPE.EMPTY_TO_LIST
          } else if (!fragmentState.children.length) {
            fragmentState.changeType = CHANGE_TYPE.EMPTY_TO_EMPTY
          } else {
            fragmentState.changeType = CHANGE_TYPE.LIST_TO_LIST
            const nextSibling = fragmentVNode.elm.nextSibling
            if (nextSibling) {
              parentNode.insertBefore(anchor, nextSibling)
            } else {
              parentNode.appendChild(anchor)
            }
          }
        },

        postpatch(_oldVNode: VNode, currentVNode: VNode) {
          const fragmentVNode = currentVNode as FragmentVNode
          const newChildren = fragmentVNode.children || []
          const fragmentState = fragmentVNode.elm.fragmentState
          const { anchor } = fragmentState
          const parentNode = fragmentVNode.elm.parentNode
          if (!parentNode) {
            return
          }

          let dirty = false
          switch (fragmentState.changeType) {
            case CHANGE_TYPE.LIST_TO_EMPTY:
            case CHANGE_TYPE.EMPTY_TO_LIST:
              dirty = true
              break
            case CHANGE_TYPE.LIST_TO_LIST:
              if (newChildren.length !== fragmentState.children.length) {
                dirty = true
              } else {
                for (let index = 0; index < newChildren.length; index += 1) {
                  const oldElement =
                    (fragmentState.children[index] as FragmentAwareNode)
                      .fragmentNode || fragmentState.children[index]
                  if (newChildren[index].elm !== oldElement) {
                    dirty = true
                    break
                  }
                }
              }
              break
          }

          if (dirty) {
            const children: Node[] = []
            let referenceElement: Node = anchor
            for (let index = newChildren.length - 1; index >= 0; index -= 1) {
              const childElement = newChildren[index].elm as Node
              children.unshift(childElement)
              if (
                !isFragmentNode(childElement) &&
                !parentNode.contains(childElement)
              ) {
                parentNode.insertBefore(childElement, referenceElement)
              }
              referenceElement = childElement
            }
            fragmentState.children = children
          }

          switch (fragmentState.changeType) {
            case CHANGE_TYPE.LIST_TO_EMPTY:
              fragmentState.children = []
              break
            case CHANGE_TYPE.EMPTY_TO_LIST:
            case CHANGE_TYPE.LIST_TO_LIST:
              anchor.parentNode?.removeChild(anchor)
              break
          }
          fragmentVNode.elm.fragmentState = fragmentState
        },
      },
    } as VNodeData
    return vnode
  },
}

export default Fragment
