1. 调和阶段，DOM的diff算法
2. 提交阶段，diff的内容体现在DOM上

整个更新过程（不包括渲染）就是在反复寻找工作单元并运行它们。
```js
while (nextUnitOfWork !== null && !shouldYield()) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
}
```

我们可以把每个 fiber 认为是一个工作单元，执行更新任务的整个流程（不包括渲染）就是在反复寻找工作单元并运行它们，这样的方式就实现了拆分任务的功能。

拆分成工作单元的目的就是为了让我们能控制 stack frame（调用栈中的内容），可以随时随地去执行它们。由此使得我们在每运行一个工作单元后都可以按情况继续执行或者中断工作（中断的决定权在于调度算法）。



### 调度器
每次有新任务发生的时候，调度器都会给任务分配一个优先级，比如说动画的优先级会高一点，离屏元素的更新优先级会低点。
通过这个优先级我们可以获取一个该更新任务必须执行的截止时间。然后调度器通过requestIdleCallback函数来做在浏览器空闲的时候去执行这些更新任务。


### React如何实现调度
1. 计算任务的`expirationTime`
2. 实现 `requestIdleCallback`

当前时间 `performance.now()`

React优先级
```js
var ImmediatePriority = 1;
var UserBlockingPriority = 2;
var NormalPriority = 3;
var LowPriority = 4;
var IdlePriority = 5;

var maxSigned31BitInt = 1073741823;
// Times out immediately
var IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out
var USER_BLOCKING_PRIORITY = 250;
var NORMAL_PRIORITY_TIMEOUT = 5000;
var LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
var IDLE_PRIORITY = maxSigned31BitInt;
```


### requestIdleCallback
该函数的回调方法会在浏览器的空闲时期依次调用， 可以让我们在事件循环中执行一些任务，并且不会对像动画和用户交互这样延迟敏感的事件产生影响。该回调方法是在渲染以后才执行的。
requestAnimationFrame 的回调方法会在每次重绘前执行
用requestAnimationFrame实现requestIdleCallback。
```js
rAFID = requestAnimationFrame(function(timestamp) {
	// cancel the setTimeout
	localClearTimeout(rAFTimeoutID);
	callback(timestamp);
});
rAFTimeoutID = setTimeout(function() {
	// 定时 100 毫秒是算是一个最佳实践
	localCancelAnimationFrame(rAFID);
	callback(getCurrentTime());
}, 100);
```


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

[diff](https://react.iamkasong.com/img/diff.png)


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
