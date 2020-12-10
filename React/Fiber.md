### 为什么需要fiber

原因是大量的同步计算任务阻塞了浏览器的UI渲染。因为在默认情况下，JS运算、页面布局、页面绘制都是运行在浏览器的主线程当中，他们之间是互斥的关系。如果JS运算持续占用主线程，页面就没法得到及时的更新。当我们调用setState更新页面的时候，React会遍历应用的所有节点，计算出差异，然后再更新UI。整个过程是不能被打断的。如果页面元素很多，整个过程占用的时机就可能超过16ms，就容易出现掉帧的现象。

- 树节点庞大时，会导致递归调用执行栈越来越深
- 不能中断执行，页面会等待递归执行完成才重新渲染

### 背景
- react在进行组件渲染时，从setState开始到渲染完成整个过程是同步的（“一气呵成”）。如果需要渲染的组件比较庞大，js执行会占据主线程时间较长，会导致页面响应度变差，使得react在动画、手势等应用中效果比较差。
- 页面卡顿：Stack reconciler的工作流程很像函数的调用过程。父组件里调子组件，可以类比为函数的递归；对于特别庞大的vDOM树来说，reconciliation过程会很长(x00ms)，超过16ms,在这期间，主线程是被js占用的，因此任何交互、布局、渲染都会停止，给用户的感觉就是页面被卡住了。

### 卡顿原因
在setState后，react会立即开始reconciliation过程，从父节点（Virtual DOM）开始遍历，以找出不同。将所有的Virtual DOM遍历完成后，reconciler才能给出当前需要修改真实DOM的信息，并传递给renderer，进行渲染，然后屏幕上才会显示此次更新内容。对于特别庞大的vDOM树来说，reconciliation过程会很长(x00ms)，在这期间，主线程是被js占用的，因此任何交互、布局、渲染都会停止，给用户的感觉就是页面被卡住了。

### 实现原理
> 旧版 React 通过递归的方式进行渲染，使用的是 JS 引擎自身的函数调用栈，它会一直执行到栈空为止。而Fiber实现了自己的组件调用栈，它以链表的形式遍历组件树，可以灵活的暂停、继续和丢弃执行的任务。实现方式是使用了浏览器的requestIdleCallback这一 API。
 Fiber 其实指的是一种数据结构，它可以用一个纯 JS 对象来表示

### Scheduler
scheduling(调度)是fiber reconciliation的一个过程，主要决定应该在何时做什么。在stack reconciler中，reconciliation是“一气呵成”，对于函数来说，这没什么问题，因为我们只想要函数的运行结果，但对于UI来说还需要考虑以下问题：
- 并不是所有的state更新都需要立即显示出来，比如屏幕之外的部分的更新
- 并不是所有的更新优先级都是一样的，比如用户输入的响应优先级要比通过请求填充内容的响应优先级更高
- 理想情况下，对于某些高优先级的操作，应该是可以打断低优先级的操作执行的，比如用户输入时，页面的某个评论还在reconciliation，应该优先响应用户输入

所以理想状况下reconciliation（调和）的过程应该是，每次只做一个很小的任务，做完后，回到主线程看下有没有什么更高优先级的任务需要处理，如果有则先处理更高优先级的任务

### 任务拆分 fiber-tree & fiber
先看一下stack-reconciler下的react是怎么工作的。代码中创建（或更新）一些元素，react会根据这些元素创建（或更新）Virtual DOM，然后react根据更新前后virtual DOM的区别，去修改真正的DOM。注意，在stack reconciler下，DOM的更新是同步的，也就是说，在virtual DOM的比对过程中，发现一个instance有更新，会立即执行DOM操作。
而fiber-conciler下，操作可以分成很多小部分，并且可以被中断，所以同步操作DOM可能会导致fiber-tree与实际DOM的不同步。对于每个节点来说，其不光存储了对应元素的基本信息，还要保存一些用于任务调度的信息。因此，fiber仅仅是一个对象，表征reconciliation阶段所能拆分的最小工作单元，和上图中的react instance一一对应。通过stateNode属性管理Instance自身的特性。通过child和sibling表征当前工作单元的下一个工作单元，return表示处理完成后返回结果所要合并的目标，通常指向父节点。整个结构是一个链表树。每个工作单元（fiber）执行完成后，都会查看是否还继续拥有主线程时间片，如果有继续下一个，如果没有则先处理其他高优先级事务，等主线程空闲下来继续执行。
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

总的来讲，通常，客户端线程执行任务时会以帧的形式划分，大部分设备控制在30-60帧是不会影响用户体验；在两个执行帧之间，主线程通常会有一小段空闲时间，requestIdleCallback可以在这个空闲期（Idle Period）调用空闲期回调（Idle Callback），执行一些任务

- 低优先级任务由requestIdleCallback处理；
- 高优先级任务，如动画相关的由requestAnimationFrame处理；
- requestIdleCallback可以在多个空闲期调用空闲期回调，执行任务；
- requestIdleCallback方法提供deadline，即任务执行限制时间，以切分任务，避免长时间执行，阻塞UI渲染而导致掉帧；


一旦reconciliation过程得到时间片，就开始进入work loop。work loop机制可以让react在计算状态和等待状态之间进行切换。为了达到这个目的，对于每个loop而言，需要追踪两个东西：下一个工作单元（下一个待处理的fiber）;当前还能占用主线程的时间。第一个loop，下一个待处理单元为根节点。
