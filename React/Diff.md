### 为什么需要 VDOM
在 MVVM 开发方式中，页面的变化都是用数据去驱动的，而数据更新后，到底要去改那一块的 DOM 哪？ 虽然可以先删除那个部分再按照当前新的数据去重新生成一个新的页面或生成那一个部分（jQuery 做法），但是这样肯定非常耗费性能的。 而且 JS 操作 DOM 是非常复杂，JS 操作 DOM 越多，控制与页面的耦合度就越高，代码越难以维护。

描述一个 DOM 节点
- tag 标签名
- attrs DOM 属性键值对
- childen DOM 字节点数组 或 文本内容


### diff策略
1. Web UI 中 DOM 节点跨层级的移动操作特别少，可以忽略不计。
2. 拥有相同类的两个组件将会生成相似的树形结构，拥有不同类的两个组件将会生成不同的树形结构。
3. 对于同一层级的一组子节点，它们可以通过唯一 id 进行区分。

#### tree diff (DOM)
```js
updateChildren:function(nextNestedChildrenElements, transaction, context) {
  updateDepth++;
  var errorThrown = true;
  try {
    this._updateChildren(nextNestedChildrenElements, transaction, context);
    errorThrown = false;
  } finally {
    updateDepth--;
    if (!updateDepth) {
      if (errorThrown) {
        clearQueue();
      } else {
        processQueue();
      }
    }
  }
}
```
#### component diff
- 如果是同一类型的组件，按照原策略继续比较 virtual DOM tree。
- 如果不是，则将该组件判断为 dirty component，从而替换整个组件下的所有子节点。
- 对于同一类型的组件，有可能其 Virtual DOM 没有任何变化，如果能够确切的知道这点那可以节省大量的 diff 运算时间，因此 React 允许用户通过 shouldComponentUpdate() 来判断该组件是否需要进行 diff。

#### element diff
- 当节点处于同一层级时，React diff 提供了三种节点操作，分别为：**INSERT_MARKUP**（插入）、**MOVE_EXISTING**（移动）和 **REMOVE_NODE**（删除）。
- **INSERT_MARKUP**，新的 component 类型不在老集合里， 即是全新的节点，需要对新节点执行插入操作。
- **MOVE_EXISTING**，在老集合有新 component 类型，且 element 是可更新的类型，generateComponentChildren 已调用 receiveComponent，这种情况下 prevChild=nextChild，就需要做移动操作，可以复用以前的 DOM 节点。 
- **REMOVE_NODE**，老 component 类型，在新集合里也有，但对应的 element 不同则不能直接复用和更新，需要执行删除操作，或者老 component 不在新集合里的，也需要执行删除操作。
```js
function enqueueInsertMarkup(parentInst, markup, toIndex) {
  updateQueue.push({
    parentInst: parentInst,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.INSERT_MARKUP,
    markupIndex: markupQueue.push(markup) - 1,
    content: null,
    fromIndex: null,
    toIndex: toIndex
  });
}


function enqueueMove(parentInst, fromIndex, toIndex) {
  updateQueue.push({
    parentInst: parentInst,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.MOVE_EXISTING,
    markupIndex: null,
    content: null,
    fromIndex: fromIndex,
    toIndex: toIndex
  });
}

function enqueueRemove(parentInst, fromIndex) {
  updateQueue.push({
    parentInst: parentInst,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.REMOVE_NODE,
    markupIndex: null,
    content: null,
    fromIndex: fromIndex,
    toIndex: null
  });
}
```

```js
_updateChildren:function(nextNestedChildrenElements, transaction, context) {
  var prevChildren = this._renderedChildren;
  var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, transaction, context);
  if (!nextChildren && !prevChildren) return;
  var name;
  var lastIndex = 0;
  var nextIndex = 0;
  for (name in nextChildren) {
    if (!nextChildren.hasOwnProperty(name)) {
      continue;
    }
    var prevChild = prevChildren && prevChildren[name];
    var nextChild = nextChildren[name];
    if (prevChildren === nextChildren) {
      this.moveChild(prevChild, nextIndex, lastIndex);
      lastIndex = Math.max(prevChild._mountIndex, lastIndex);
      prevChild._mountIndex = nextIndex;
    } else {
      if (prevChild) {
        lastIndex = Math.max(prevChild._mountIndex, lastIndex);
        this._unmountChild(prevChild);
      }
      this._mountChildAtIndex(nextChild, nextIndex, transaction, context);
    }
  }
  nextIndex++;
  for (name in prevChildren) {
    if (prevChildren.hasOwnProperty(name) && !(nextChildren && nextChildren.hasOwnProperty(name))) {
      this._unmountChild(prevChildren[name]);
    }
  }
  this._renderedChildren = nextChildren;
}
,
moveChild:function(child, toIndex, lastIndex) {
  if (child._mountIndex < lastIndex) {
    this.prepareToManageChildren();
    enqueueMove(this, child._mountIndex, toIndex);
  }
}
,
createChild:function(child, mountImage) {
  this.prepareToManageChildren();
  enqueueInsertMarkup(this, mountImage, child._mountIndex);
}
,
removeChild:function(child) {
  this.prepareToManageChildren();
  enqueueRemove(this, child._mountIndex);
}
,
_unmountChild:function(child) {
  this.removeChild(child);
  child._mountIndex(null);
}
,
_mountChildAtIndex: function(
  child,
  index,
  transaction,
  context) {
  var mountImage = ReactReconciler.mountComponent(
    child,
    transaction,
    this,
    this._nativeContainerInfo,
    context
  );
  child._mountIndex = index;
  this.createChild(child, mountImage);
},
```
### 总结
- React 通过制定大胆的 diff 策略，将 O(n3) 复杂度的问题转换成 O(n) 复杂度的问题；
- React 通过分层求异的策略，对 tree diff 进行算法优化；
- React 通过相同类生成相似树形结构，不同类生成不同树形结构的策略，对 component diff 进行算法优化；
- React 通过设置唯一 key的策略，对 element diff 进行算法优化；
- 建议，在开发组件时，保持稳定的 DOM 结构会有助于性能的提升；
- 建议，在开发过程中，尽量减少类似将最后一个节点移动到列表首部的操作，当节点数量过大或更新操作过于频繁时，在一定程度上会影响 React 的渲染性能。
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

### DIFF是如何实现的
我们从Diff的入口函数reconcileChildFibers出发，该函数会根据newChild（即JSX对象）类型调用不同的处理函数。
```js
// 根据newChild类型选择不同diff函数处理
function reconcileChildFibers(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChild: any,
): Fiber | null {

  const isObject = typeof newChild === 'object' && newChild !== null;

  if (isObject) {
    // object类型，可能是 REACT_ELEMENT_TYPE 或 REACT_PORTAL_TYPE
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        // 调用 reconcileSingleElement 处理
      // // ...省略其他case
    }
  }

  if (typeof newChild === 'string' || typeof newChild === 'number') {
    // 调用 reconcileSingleTextNode 处理
    // ...省略
  }

  if (isArray(newChild)) {
    // 调用 reconcileChildrenArray 处理
    // ...省略
  }

  // 一些其他情况调用处理函数
  // ...省略

  // 以上都没有命中，删除节点
  return deleteRemainingChildren(returnFiber, currentFirstChild);
}
```

我们可以从同级的节点数量将Diff分为两类：
1. 当newChild类型为object、number、string，代表同级只有一个节点
2. 当newChild类型为Array，同级有多个节点


对于单个节点，我们以类型object为例，会进入reconcileSingleElement
```js
 const isObject = typeof newChild === 'object' && newChild !== null;

  if (isObject) {
    // 对象类型，可能是 REACT_ELEMENT_TYPE 或 REACT_PORTAL_TYPE
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        // 调用 reconcileSingleElement 处理
      // ...其他case
    }
  }
```

![diff](https://react.iamkasong.com/img/diff.png)


**判断DOM节点是否可以复用如何实现**
```js
function reconcileSingleElement(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  element: ReactElement
): Fiber {
  const key = element.key;
  let child = currentFirstChild;
  
  // 首先判断是否存在对应DOM节点
  while (child !== null) {
    // 上一次更新存在DOM节点，接下来判断是否可复用

    // 首先比较key是否相同
    if (child.key === key) {

      // key相同，接下来比较type是否相同

      switch (child.tag) {
        // ...省略case
        
        default: {
          if (child.elementType === element.type) {
            // type相同则表示可以复用
            // 返回复用的fiber
            return existing;
          }
          
          // type不同则跳出循环
          break;
        }
      }
      // 代码执行到这里代表：key相同但是type不同
      // 将该fiber及其兄弟fiber标记为删除
      deleteRemainingChildren(returnFiber, child);
      break;
    } else {
      // key不同，将该fiber标记为删除
      deleteChild(returnFiber, child);
    }
    child = child.sibling;
  }

  // 创建新Fiber，并返回 ...省略
}
```

从代码可以看出，React通过先判断key是否相同，如果key相同则判断type是否相同，只有都相同时一个DOM节点才能复用。
这里有个细节需要关注下：
当child !== null且key相同且type不同时执行deleteRemainingChildren将child及其兄弟fiber都标记删除。
当child !== null且key不同时仅将child标记删除。
在reconcileSingleElement中遍历之前的3个fiber（对应的DOM为3个li），寻找本次更新的p是否可以复用之前的3个fiber中某个的DOM。

当key相同且type不同时，代表我们已经找到本次更新的p对应的上次的fiber，但是p与li type不同，不能复用。既然唯一的可能性已经不能复用，则剩下的fiber都没有机会了，所以都需要标记删除。

当key不同时只代表遍历到的该fiber不能被p复用，后面还有兄弟fiber还没有遍历到。所以仅仅标记该fiber删除。



### Diff算法实现
1. 创建VirtualDOM
```js
// virtual-dom
function createElement(tagName, props = {}, ...children) {
  let vnode = {}
  if(props.hasOwnProperty('key')){
    vnode.key = props.key
    delete props.key
  }
  return Object.assign(vnode, {
    tagName,
    props,
    children,
  })
}
```
2. 渲染VirtualDOM
```js
function render (vNode) {
  const element = document.createElement(vNode.tagName)
  const props = vNode.props

  for (const key in props) {
    const value = props[key]
    node.setAttribute(key, value)
  }

  vNode.children && vNode.children( child => {
    const childElement = typeof child === 'string' ? document.createTextNode(child) : render(child)
    element.appendChild(childElement)
  })

  return element
}

export default render
```
3. DOM diff
- 根据节点变更类型，定义几种变化类型
  - 节点移除
  - 节点替换
  - 文本替换
  - 节点属性变更
  - 插入节点
  - 节点移动
```js
const vpatch = {}
vpatch.REMOVE = 0
vpatch.REPLACE = 1  // node replace
vpatch.TEXT = 2  // text replace
vpatch.PROPS = 3
vpatch.INSERT = 4
vpatch.REORDER = 5

export default vpatch
```

- diff virtual Dom
```js
/**
 * 二叉树 diff
 * @param lastVNode
 * @param newVNode
 */
function diff (lastVNode, newVNode) {
  let index = 0
  const patches = {}
  // patches.old = lastVNode
  dftWalk(lastVNode, newVNode, index, patches)
  return patches
}

/**
 * 深入优先遍历算法 (depth-first traversal，DFT)
 * @param {*} lastVNode
 * @param {*} newVNode
 * @param {*} index
 * @param {*} patches
 */
function dftWalk(lastVNode, newVNode, index, patches) {
  if (lastVNode === newVNode) {
    return
  }

  const currentPatch = []

  // Node is removed
  if (newVNode === null) {
    currentPatch.push({ type: patch.REMOVE })

  // diff text
  } else if (_.isString(lastVNode) && _.isString(newVNode)) {
    if (newVNode !== lastVNode) {
      currentPatch.push({ type: patch.TEXT, text: newVNode })
    }

  // same node  此处会出行，parentNode 先 moves 处理，childnode 再做一次处理（替换或修改属性）
  } else if (
    newVNode.tagName === lastVNode.tagName
    // && newVNode.key === lastVNode.key
  ) {
    // newVNode.key === lastVNode.key 才会执行 diffChildren
    if (newVNode.key === lastVNode.key) {
      const propsPatches = diffProps(lastVNode.props, newVNode.props)
      if (Object.keys(propsPatches).length > 0) {
        currentPatch.push({ type: patch.PROPS, props: propsPatches })
      }

      diffChildren(
        lastVNode.children,
        newVNode.children,
        currentPatch,
        index,
        patches,
      )
    } else {
      currentPatch.push({ type: patch.REPLACE, node: newVNode })
    }

  // Nodes are not the same
  } else {
    currentPatch.push({ type: patch.REPLACE, node: newVNode })
  }

  if (currentPatch.length) {
    patches[index] = currentPatch
  }
}

function diffChildren (lastChildren, newChildren, apply, index, patches) {
  const orderedSet = reorder(lastChildren, newChildren)
  let len = lastChildren.length > newChildren.length ? lastChildren.length : newChildren.length
  for (var i = 0; i < len; i++) {
    if (!lastChildren[i]) {

      // insert node
      if (newChildren[i] && !orderedSet.moves) {
        apply.push({ type: patch.INSERT, node: newChildren[i] })
      }

    } else {
      dftWalk(lastChildren[i], newChildren[i], ++index, patches)
    }
  }
  console.error('orderedSet.moves', orderedSet.moves)
  if (orderedSet.moves) {
    apply.push(orderedSet)
  }
}

/**
 * diff vnode props
 * @param {*} lastProps
 * @param {*} newProps
 */
function diffProps (lastProps, newProps) {
  const propsPatches = {}

  // Find out diff props
  for (const key in lastProps) {
    if (newProps[key] !== lastProps[key]) {
      propsPatches[key] = newProps[key]
    }
  }


  // Find out new props
  for (const key in newProps) {
    if (!lastProps.hasOwnProperty(key)) {
      propsPatches[key] = newProps[key]
    }
  }
  return propsPatches
}

/**
 * List diff, naive left to right reordering
 * @param {*} lastChildren
 * @param {*} newChildren
 *
 * 原理利用中间数组 simulate， remove得到子集、insert 插入操作完成
 * 例 oldList [1,4,6,8,9] newList [0,1,3,5,6]
 * 转换拿到中间数组按老数组索引 [1, null, 6, null, null ]
 * remove null 得到子集 [1, 6]
 * insert 插入完成
 */
function reorder(lastChildren, newChildren) {
  const lastMap = keyIndex(lastChildren)
  const lastKeys = lastMap.keys
  const lastFree = lastMap.free

  if(lastFree.length === lastChildren.length){
    return {
      moves: null
    }
  }


  const newMap = keyIndex(newChildren)
  const newKeys = newMap.keys
  const newFree = newMap.free

  if(newFree.length === newChildren.length){
    return {
      moves: null
    }
  }

  // simulate list to manipulate
  const children = []
  let freeIndex = 0

  for (let i = 0 ; i < lastChildren.length; i++) {
    const item = lastChildren[i]
    if(item.key){
      if(newKeys.hasOwnProperty('key')){
        const itemIndex = newKeys[item.key]
        children.push(newChildren[itemIndex])
      } else {
        children.push(null)
      }
    } else {
      const itemIndex = newFree[freeIndex++]
      children.push(newChildren[itemIndex] || null)
    }
  }

  const simulate = children.slice()
  const removes = []
  const inserts = []

  let j = 0

  // remove  value is null and  no key property
  while (j < simulate.length) {
    if (simulate[j] === null || !simulate[j].hasOwnProperty('key')) {
      const patch = remove(simulate, j)
      removes.push(patch)
    } else {
      j++
    }
  }

  console.error('simulate', simulate)
  for (let i = 0 ; i < newChildren.length; i++) {
    const wantedItem = newChildren[i]
    const simulateItem = simulate[i]

    if(wantedItem.key){
      if(simulateItem && wantedItem.key !== simulateItem.key){
        // key property is not equal, insert, simulateItem add placeholder
        inserts.push({
          type: patch.INSERT,
          index: i,
          node: wantedItem,
        })
        simulateItem.splice(i, 1)
      }
    } else {
      // no key property, insert, simulateItem add placeholder
      inserts.push({
        type: patch.INSERT,
        index: i,
        node: wantedItem,
      })
      simulateItem && simulateItem.splice(i, 1)
    }
  }

  return {
    type: patch.REORDER,
    moves: {
      removes: removes,
      inserts: inserts
    }
  }
}

function remove(arr, index) {
  arr.splice(index, 1)

  return {
    type: patch.REMOVE,
    index,
  }
}


/**
 * Convert list to key-item keyIndex object.
 * @param {*} children
 * convert [{id: "a", key: 'a'}, {id: "b", key: 'b'}, {id: "a"}]
 * result { keys: { a: 0, b: 1}, free: [ 2 ] }
 */
function keyIndex(children) {
  var keys = {}
  var free = []
  var length = children.length

  for (var i = 0; i < length; i++) {
      var child = children[i]

      if (child.key) {
          keys[child.key] = i
      } else {
          free.push(i)
      }
  }

  return {
      keys: keys,     // A hash of key name to index
      free: free      // An array of unkeyed item indices
  }
}

export default diff
```

4. 收集patchs
5. 更新patchs，把差异应用到真正的DOM树上
```js
import patch from './vpatch.js'
import render from './render.js'

/**
 * 真实的 Dom 打补钉
 * @param {*} rootNode 实际的 DOM
 * @param {*} patches
 */
function patch (rootNode, patches) {
  const walker = { index: 0 }
  dftWalk(rootNode, walker, patches)
}

/**
 * 深入优先遍历算法 (depth-first traversal，DFT)
 * @param {*} node
 * @param {*} walker
 * @param {*} patches
 */
function dftWalk (node, walker, patches) {
  const currentPatches = patches[walker.index] || {}
  node.childNodes && node.childNodes.forEach(child => {
    walker.index++
    dftWalk(child, walker, patches)
  })
  if (currentPatches) {
    applyPatches(node, currentPatches)
  }
}


function applyPatches (node, currentPatches) {
  currentPatches.forEach(currentPatch => {
    switch (currentPatch.type) {
      case patch.REMOVE:
        node.parentNode.removeChild(node)
        break
      case patch.REPLACE:
        const newNode = currentPatch.node
        node.parentNode.replaceChild(render(newNode), node)
        break
      case patch.TEXT:
        node.textContent = currentPatch.text
        break
      case patch.PROPS:
        const props = currentPatch.props
        setProps(node, props)
        break
      case patch.INSERT:
        // parentNode.insertBefore(newNode, referenceNode)
        const newNode = currentPatch.node
        node.appendChild(render(newNode))
        break
      case patch.REORDER:
        reorderChildren(node, currentPatch.moves)
        break
    }
  })

}

/**
 * 设置真实 Dom 属性值
 * @param {*} node
 * @param {*} props
 */
function setProps (node, props) {
  for (const key in props) {
    // void 666 is undefined
    if (props[key] === void 666) {
      node.removeAttribute(key)
    } else {
      const value = props[key]
      node.setAttribute(key, value)
    }
  }
}

/**
 * reorderChildren 处理 list diff render
 * @param {*} domNode
 * @param {*} moves
 */
function reorderChildren(domNode, moves) {
  for (const i = 0; i < moves.removes.length; i++) {
    const { index } = moves.removes[i]
    const node = domNode.childNodes[index]
    domNode.removeChild(node)
  }

  for (const j = 0; j < moves.inserts.length; j++) {
    const { index, node } = moves.inserts[j]
    domNode.insertBefore(node, index === domNode.childNodes.length ? null : childNodes[index])
  }
}
```
