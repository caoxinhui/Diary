### Diff遍历算法
#### 广度优先算法
```js
function wideTraversal(vnode) {
    if (!vnode) {
        throw new Error('Empty Tree')
    }
    const nodeList = []
    const queue = []
    queue.push(vnode)
    while (queue.length !== 0) {
        const node = queue.shift()
        nodeList.push(node)
        if (node.children) {
            const children = node.children
            for (let i = 0; i < children.length; i++) {
                queue.push(children[i])
            }
        }
    }
    return nodeList
}
```
#### 深度优先算法
```js
function wideTraversal(vnode) {
    if (!vnode) {
        throw new Error('Empty Tree')
    }
    const nodeList = []
    const stack = []
    stack.push(vnode)
    while (stack.length !== 0) {
        const node = queue.pop()
        nodeList.push(node)
        if (node.children) {
            const children = node.children
            for (let i = children.length - 1; i >= 0; i--) {
                stack.push(children[i])
            }
        }
    }
    return nodeList
}
```

#### diff策略
1. Web UI 中 DOM 节点跨层级的移动操作特别少，可以忽略不计。
2. 拥有相同类的两个组件将会生成相似的树形结构，拥有不同类的两个组件将会生成不同的树形结构。
3. 对于同一层级的一组子节点，它们可以通过唯一 id 进行区分（节点移动会导致 diff 开销较大，通过 key 进行优化）。

基于以上三个前提策略，React 分别对 tree diff、component diff 以及 element diff 进行算法优化，事实也证明这三个前提策略是合理且准确的，它保证了整体界面构建的性能。

1. tree diff
>React 通过 updateDepth 对 Virtual DOM 树进行层级控制，只会对相同颜色方框内的 DOM 节点进行比较，即同一个父节点下的所有子节点。当发现节点已经不存在，则该节点及其子节点会被完全删除掉，不会用于进一步的比较。这样只需要对树进行一次遍历，便能完成整个 DOM 树的比较。
2. component diff
>如果是同一类型的组件，按照原策略继续比较 virtual DOM tree。
 如果不是，则将该组件判断为 dirty component，从而替换整个组件下的所有子节点。
 对于同一类型的组件，有可能其 Virtual DOM 没有任何变化，如果能够确切的知道这点那可以节省大量的 diff 运算时间，因此 React 允许用户通过 shouldComponentUpdate() 来判断该组件是否需要进行 diff。
3. element diff


### diff
#### 对于单个节点，进入 reconcileSingleElement 
React通过先判断key是否相同，如果key相同则判断type是否相同，只有都相同时一个DOM节点才能复用

#### JSX对象的children属性不是单一节点，而是包含四个对象的数组

判断当前节点的更新属于哪种情况
1. 如果是新增，执行新增逻辑
2. 如果是删除，执行删除逻辑
3. 如果是更新，执行更新逻辑


虽然本次更新的JSX对象 newChildren为数组形式，但是和newChildren中每个组件进行比较的是current fiber，同级的Fiber节点是由sibling指针链接形成的单链表，即不支持双指针遍历。

即 newChildren[0]与fiber比较，newChildren[1]与fiber.sibling比较。

所以无法使用双指针优化。

基于以上原因，Diff算法的整体逻辑会经历两轮遍历：

第一轮遍历：处理更新的节点。

第二轮遍历：处理剩下的不属于更新的节点。


### diff
一个DOM节点在某一时刻最多会有4个节点和他相关。
1. current Fiber。如果该DOM节点已在页面中，current Fiber代表该DOM节点对应的Fiber节点。
2. workInProgress Fiber。如果该DOM节点将在本次更新中渲染到页面中，workInProgress Fiber代表该DOM节点对应的Fiber节点。
3. DOM节点本身。
4. JSX对象。即ClassComponent的render方法的返回结果，或FunctionComponent的调用结果。JSX对象中包含描述DOM节点的信息。


为了降低算法复杂度，React的diff会预设三个限制：
1. 只对同级元素进行Diff。如果一个DOM节点在前后两次更新中跨越了层级，那么React不会尝试复用他。
2. 两个不同类型的元素会产生出不同的树。如果元素由div变为p，React会销毁div及其子孙节点，并新建p及其子孙节点。
3. 开发者可以通过 key prop来暗示哪些子元素在不同的渲染下能保持稳定。


#### diff实现
我们从Diff的入口函数reconcileChildFibers出发，该函数会根据newChild（即JSX对象）类型调用不同的处理函数。

我们可以从同级的节点数量将Diff分为两类：
- 当newChild类型为object、number、string，代表同级只有一个节点
- 当newChild类型为Array，同级有多个节点

##### 单个节点
对于单个节点，我们以类型object为例，会进入reconcileSingleElement
React通过先判断key是否相同，如果key相同则判断type是否相同，只有都相同时一个DOM节点才能复用。

##### FunctionComponent
```jsx harmony
function List () {
  return (
    <ul>
      <li key="0">0</li>
      <li key="1">1</li>
      <li key="2">2</li>
      <li key="3">3</li>
    </ul>
  )
}
```
他的返回值JSX对象的children属性不是单一节点，而是包含四个对象的数组

首先归纳下我们需要处理的情况:
1. 节点更新
2. 节点新增或者减少
3. 节点位置发生变化

在日常开发中，相较于新增和删除，更新组件发生的频率更高。所以Diff会优先判断当前节点是否属于更新。

Diff算法的整体逻辑会经历两轮遍历：

第一轮遍历：处理更新的节点。

第二轮遍历：处理剩下的不属于更新的节点。
