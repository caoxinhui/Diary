### 背景

- react在进行组件渲染时，从setState开始到渲染完成整个过程是同步的（“一气呵成”）。如果需要渲染的组件比较庞大，js执行会占据主线程时间较长，会导致页面响应度变差，使得react在动画、手势等应用中效果比较差。
- 页面卡顿：Stack reconciler的工作流程很像函数的调用过程。父组件里调子组件，可以类比为函数的递归；对于特别庞大的vDOM树来说，reconciliation过程会很长(x00ms)，超过16ms,在这期间，主线程是被js占用的，因此任何交互、布局、渲染都会停止，给用户的感觉就是页面被卡住了。

### 实现原理
>旧版 React 通过递归的方式进行渲染，使用的是 JS 引擎自身的函数调用栈，它会一直执行到栈空为止。而Fiber实现了自己的组件调用栈，它以链表的形式遍历组件树，可以灵活的暂停、继续和丢弃执行的任务。实现方式是使用了浏览器的requestIdleCallback这一 API。
 Fiber 其实指的是一种数据结构，它可以用一个纯 JS 对象来表示

### Scheduler
scheduling(调度)是fiber reconciliation的一个过程，主要决定应该在何时做什么。在stack reconciler中，reconciliation是“一气呵成”，对于函数来说，这没什么问题，因为我们只想要函数的运行结果，但对于UI来说还需要考虑以下问题：
- 并不是所有的state更新都需要立即显示出来，比如屏幕之外的部分的更新
- 并不是所有的更新优先级都是一样的，比如用户输入的响应优先级要比通过请求填充内容的响应优先级更高
- 理想情况下，对于某些高优先级的操作，应该是可以打断低优先级的操作执行的，比如用户输入时，页面的某个评论还在reconciliation，应该优先响应用户输入

所以理想状况下reconciliation的过程应该是像下图所示一样，每次只做一个很小的任务，做完后，回到主线程看下有没有什么更高优先级的任务需要处理，如果有则先处理更高优先级的任务

### 任务拆分 fiber-tree & fiber
先看一下stack-reconciler下的react是怎么工作的。代码中创建（或更新）一些元素，react会根据这些元素创建（或更新）Virtual DOM，然后react根据更新前后virtual DOM的区别，去修改真正的DOM。注意，在stack reconciler下，DOM的更新是同步的，也就是说，在virtual DOM的比对过程中，发现一个instance有更新，会立即执行DOM操作。



```js
const fiber = {
    stateNode,    // 节点实例
    child,        // 子节点
    sibling,      // 兄弟节点
    return,       // 父节点
}
```

- react内部运转分三层：
    - Virtual DOM 层，描述页面长什么样。
    - Reconciler （调和）层，负责调用组件生命周期方法，进行 Diff 运算等。 
    - Renderer 层，根据不同的平台，渲染出相应的页面，比较常见的是 ReactDOM 和 ReactNative。
- 为了实现不卡顿，就需要有一个调度器 (Scheduler) 来进行任务分配。优先级高的任务（如键盘输入）可以打断优先级低的任务（如Diff）的执行，从而更快的生效。任务的优先级有六种：
    - synchronous，与之前的Stack Reconciler操作一样，同步执行
    - task，在next tick之前执行
    - animation，下一帧之前执行
    - high，在不久的将来立即执行
    - low，稍微延迟执行也没关系
    - offscreen，下一次render时或scroll时才执行
- Fiber Reconciler（react ）执行阶段：
    - 阶段一，生成 Fiber 树，得出需要更新的节点信息。这一步是一个渐进的过程，可以被打断。
    - 阶段二，将需要更新的节点一次过批量更新，这个过程不能被打断。
- Fiber树：Fiber Reconciler在阶段一进行Diff计算的时候，会基于Virtual DOM树生成一棵Fiber树，它的本质是链表。
- 从Stack Reconciler到Fiber Reconciler，源码层面其实就是干了一件递归改循环的事情


### Fiber节点是如何被创建并构建Fiber树的
render阶段开始于performSyncWorkOnRoot或performConcurrentWorkOnRoot方法的调用。这取决于本次更新是同步更新还是异步更新。
