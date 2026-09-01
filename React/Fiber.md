### 为什么需要 Fiber

一句话：**React 15 的更新过程是「一个不可中断的同步长任务」，它会长时间霸占渲染进程主线程，导致这期间的输入、动画、绘制全部停摆。Fiber 的目的不是让计算变快，而是让这个长任务变得「可以被打断」，从而把主线程及时还给浏览器。**

#### 1. 前置：主线程的时间预算只有 16.6ms

屏幕以 60Hz 刷新时，浏览器每 16.6ms 要输出一帧。这一帧里，渲染进程的主线程要依次完成：

```
处理输入事件 → 执行 JS（含 timer、微任务）→ rAF 回调 → 样式计算 → 布局 → 分层 → 生成绘制指令 → 提交给合成线程
```

关键在于 **JS 执行、样式计算、布局、绘制都挤在渲染进程的同一条主线程上，彼此互斥**。JS 不交出主线程，后面的排版和绘制就没机会跑。所以只要一段 JS 连续执行超过约 16ms，这一帧就来不及产出，表现为掉帧；连续占用几百毫秒，就是「页面卡死」。

#### 2. React 15 的问题出在哪

React 15 的协调器叫 **Stack Reconciler**，遍历方式是**递归**：父组件的 render 里递归处理子组件，靠的是 JS 引擎自带的函数调用栈。这带来两个致命特性：

- **不可中断**。递归一旦开始，就会一路执行到调用栈清空为止。中间没有任何「暂停点」—— 调用栈由 JS 引擎自己管理，React 无法在递归到一半时把栈帧存下来、下一帧再恢复。
- **栈深度随组件树增长**。层级深时执行栈越来越深，既有性能开销，也有爆栈风险。

于是 `setState` 之后是这样一气呵成的：

```
setState → 从根节点递归遍历 vDOM → diff 出全部差异 → 交给 Renderer → 操作真实 DOM → 屏幕更新
         └───────────── 全程同步，主线程被独占，无法插入任何其他工作 ─────────────┘
```

对一棵几千节点的组件树，这个过程轻松跑到几百毫秒。这期间：

- 用户敲键盘 → 输入事件堆在队列里，光标不动，输入框「没反应」
- 主线程驱动的动画 → 直接冻住（只有 `transform`/`opacity` 这类走合成线程的还能动）
- 用户点击 → 事件回调要等 diff 结束才执行，感觉「点了没用」

#### 3. 为什么「优化 diff 算法」解决不了

问题的本质不是**算得慢**，而是**不肯让**。

即使把 diff 优化到原来的十分之一，它仍然是一个「开始了就必须做完」的同步任务。只要单次任务时长超过一帧的预算，就一定会阻塞渲染和交互。而组件树规模由业务决定，React 无法假设它一定小。

那能不能把计算丢进 Web Worker？也不行：

- 协调过程要读写组件实例、闭包、context，这些无法结构化克隆传给 Worker
- 结果最终仍要操作 DOM，而 Worker 没有 DOM 访问权

所以唯一的出路是：**留在主线程，但把任务切碎，并交出调度权。**

#### 4. Fiber 做的三件事

**① 递归改循环：自己实现一套调用栈**

Fiber 把 vDOM 树换成**链表结构的 Fiber 树**，每个节点靠三个指针连接：

```js
const fiber = {
  stateNode, // 节点实例
  child,     // 第一个子节点
  sibling,   // 下一个兄弟节点
  return,    // 父节点（处理完后返回的目标）
};
```

这三个指针本质上是**手写的栈帧**。有了它们，遍历就从「递归」变成了 `while` 循环：任意时刻中断，只要记住当前处理到哪个 fiber（`workInProgress`），下次从这个节点继续往下走即可。递归做不到这件事，因为现场存在引擎的调用栈里，React 拿不到。

**② 时间切片：每做完一个工作单元就抬头看一眼**

一个 fiber 节点就是一个**最小工作单元**。work loop 的逻辑是：

```js
function workLoopConcurrent() {
  // 每处理完一个 fiber，就检查时间片是否用完
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress);
  }
}
```

`shouldYield()` 判断这一片（约 5ms）时间是否耗尽。耗尽就退出循环，把主线程还给浏览器去处理输入、排版、绘制；浏览器空下来后再调度 React 从 `workInProgress` 继续。**一个长任务由此被切成一串短任务。**

**③ 优先级调度：让紧急的事插队**

有了中断能力，才谈得上调度。Scheduler 给不同来源的更新分配优先级：用户输入 > 动画 > 网络数据填充 > 屏幕外内容。高优先级更新进来时，可以打断正在进行的低优先级协调，先响应用户，之后低优先级任务再从头重做。

#### 5. 中断了，会不会看到画一半的界面？

不会。Fiber 把更新拆成两个阶段：

| 阶段 | 做什么 | 能否中断 |
|---|---|---|
| **render（协调）** | 构建 workInProgress 树、diff、标记 effect | ✅ 可中断、可丢弃、可重做 |
| **commit（提交）** | 按 effect list 一次性批量操作真实 DOM | ❌ 同步执行，不可中断 |

render 阶段的工作全部做在内存里的 workInProgress 树上，屏幕显示的仍是 current 树，中断时用户看到的是上一个完整状态；只有 render 全部完成才进入 commit 一次性提交。这就是双缓存的思路。

代价是：**如果 DOM 变更本身数量巨大，commit 阶段依然会卡。** Fiber 优化的是计算阶段，不是 DOM 操作阶段。

#### 6. Fiber 带来了哪些新能力

Fiber 真正交付的是三个原语：**可中断、可丢弃、可重做**。掉帧只是它最早、最好讲，但收益最小的那个用例。React 16 之后所有让人眼前一亮的能力，本质都是这三个原语的下游消费者。

回答时按「是否真的依赖 Fiber」分档，比罗列版本号更有说服力。

**① 强依赖：没有 Fiber 就做不出来**

| 能力 | 版本 | 依赖 Fiber 的哪一点 |
|---|---|---|
| **Error Boundary**（`componentDidCatch`） | 16.0 | 自己的调用栈：沿 `return` 指针向上 unwind 找到最近的 boundary，把该子树换成 fallback 重渲染 |
| **render 可返回数组 / 字符串 / Fragment** | 16.0 / 16.2 | `child` + `sibling` 链表：一个节点天然可以有多个子节点，不再要求「一个组件 → 一个子实例」 |
| **Portal**（`createPortal`） | 16.0 | fiber 树（逻辑父子）与宿主树（真实 DOM 位置）解耦，commit 时才决定挂到哪 |
| **Suspense + `React.lazy`** | 16.6 | 可丢弃 + 可重做：render 中 throw Promise，扔掉这棵 WIP 树，resolve 后重来 |
| **DevTools Profiler / `<Profiler>`** | 16.5 | fiber 上有 `actualDuration` / `treeBaseDuration`，有显式工作单元才谈得上测量 |
| **并发特性**（`startTransition`、`useTransition`、`useDeferredValue`） | 18 | 可中断 + 优先级 + 丢弃过时的中间结果 |
| **自动批处理**（automatic batching） | 18 | Lane 模型统一收敛所有来源的更新 |
| **`useSyncExternalStore`** | 18 | 反向产物：并发渲染会 tearing，外部 store 必须强制同步读取 |
| **Suspense SSR / `renderToPipeableStream`** | 18 | 服务端也能挂起某棵子树，先把别的发出去 |
| **Selective Hydration** | 18 | 按用户交互优先级决定先 hydrate 哪一块，可插队 |
| **`<Activity>`**（原 Offscreen） | 19.2 | 双缓存：保留一棵不 commit 的树连同 state 和 DOM，之后原样恢复 |
| **RSC / Actions / `use()` / `useOptimistic`** | 19 | 建在 Suspense + transition 基础设施之上，属于传递依赖 |

**② 间接依赖：实现建在 Fiber 上，但不是 Fiber 的必然产物**

**Hooks（16.8）**——state 存在 `fiber.memoizedState` 上的一条链表里，靠 `current` / `alternate` 这对树区分「上一次的值」和「这一次的值」，被丢弃的渲染因此不会污染已提交的状态。实现上确实吃了 Fiber 的红利。

但 Hooks 不是 Fiber 逼出来的：class 组件也有实例可以挂 state，Hooks 解决的是逻辑复用和 class 的心智负担，属于独立动机。**只有 `useTransition` / `useDeferredValue` / `useSyncExternalStore` / `useInsertionEffect` 是强依赖 Fiber 的那几个。**

**新 Context API（`createContext`，16.3）**——旧 context 会被 `shouldComponentUpdate` 的 bailout 截断。新实现用 `fiber.dependencies` 记录哪些 fiber 消费了这个 context，更新时由 `propagateContextChange` 遍历 fiber 树精确标记它们，从而能穿透 bailout。这套依赖收集需要一棵可遍历、可标记的持久化树。

**③ Fiber 带来的约束，而不是能力**

这一档容易被忽略，但主动提到会显得真读过源码：

- **`componentWillMount` / `componentWillReceiveProps` / `componentWillUpdate` 被标记 `UNSAFE_`**（16.3）：render 阶段可中断、可重做，意味着这些钩子**可能被调用多次**，在里面发请求或改外部状态就会出 bug。替代品 `getDerivedStateFromProps`（静态纯函数，拿不到 `this`）和 `getSnapshotBeforeUpdate`（挪到不可中断的 commit 前）正是为此设计。
- **`StrictMode` 双调用**（16.3 引入，18 加强为 effect 也双调）：故意跑两遍来暴露不纯的 render。
- **render 必须是纯函数**——从「最佳实践」变成了硬性要求，因为一次 render 随时可能被丢弃重来。

#### 7. 面试常见误区

- **Fiber 不会让更新变快。** 拆分任务、维护链表和优先级都有额外开销，总耗时反而略有增加。它优化的是**响应性**（长任务不再阻塞交互），不是**吞吐量**。
- **diff 算法本身没有变快。** 同层比较 + `key` 的策略 React 15 就是这样，Fiber 改的是**遍历方式**（递归→循环），不是比较策略。
- **React 16 的 SSR 重写和 `renderToNodeStream` 不是 Fiber 的功劳。** 那是独立重写的一条代码路径，服务端渲染在 16 里根本不走 Fiber reconciler；真正吃 Fiber 的是 18 的 Suspense SSR + Selective Hydration。
- **Fiber 架构 ≠ 并发特性。** React 16 只是把架构换成了 Fiber，具备了「可中断」这个基础设施，但默认的 Legacy 模式下更新依然同步不可中断。真正用上时间切片和优先级要到 React 18 的 `createRoot` + `startTransition` / `useDeferredValue`。所以「升到 16 就不卡了」是错的。
- **Fiber 不是多线程。** 全程仍是渲染进程那一条主线程，只是把独占改成了分时复用。
- **「Fiber」一词有三义**：新架构（Fiber Reconciler）、最小工作单元、描述节点的那个纯 JS 对象。回答时最好点明在说哪一个。

#### 8. 一句话版本

> React 15 用递归遍历 vDOM，借用 JS 引擎的调用栈，更新过程同步且不可中断；组件树大时单次更新耗时几百毫秒，独占渲染进程主线程，造成掉帧和输入无响应。Fiber 把树改成链表、递归改成循环，用 `child`/`sibling`/`return` 指针自己实现了可保存现场的调用栈，从而能在每个工作单元结束后检查时间片并让出主线程，并在此基础上支持优先级插队。render 阶段可中断，commit 阶段同步提交，保证用户不会看到不完整的 UI。

> 更进一步：Fiber 的价值远不止「不掉帧」。它真正交付的是**可中断、可丢弃、可重做**这三个原语，而 Error Boundary、Fragment、Portal、Suspense、并发特性、Selective Hydration、RSC 全都是这三个原语的下游产物——这也是 React 愿意为它付出巨大实现复杂度的原因。








### 实现原理
> 旧版 React 通过递归的方式进行渲染，使用的是 JS 引擎自身的函数调用栈，它会一直执行到栈空为止。而 Fiber 实现了自己的组件调用栈，它以链表的形式遍历组件树，可以灵活地暂停、继续和丢弃执行的任务。

Fiber 同时也指一种数据结构，可以用一个纯 JS 对象来表示。

**⚠️ 注意：让出主线程靠的不是 `requestIdleCallback`。** 这是流传很广的说法，但 React 从未使用该 API，而是自己实现了一套 Scheduler（`scheduler` 包）。原因：

- **调用频率太低且不稳定**。`requestIdleCallback` 只在一帧还有空闲时才触发，低负载下约 20Hz，达不到 60fps 需要的节奏；页面繁忙时可能长时间不触发，更新会被无限期推迟。
- **触发时机不可控**。它由浏览器决定何时算「空闲」，React 需要的是「我说了算」的可控让出点，还要能按优先级区分同步/插队/延后。
- **兼容性差**。Safari 长期不支持。

React 的实际做法：用 **`MessageChannel`** 的 `port.postMessage` 产生一个**宏任务**，把执行权交回事件循环——浏览器得以在这个间隙处理输入、样式计算、布局和绘制，随后宏任务回调再让 React 从 `workInProgress` 继续。不支持 `MessageChannel` 时降级到 `setTimeout(fn, 0)`。

为什么用宏任务而不是微任务：微任务会在当前任务末尾立刻清空，浏览器根本没有机会插入渲染，等于没让。为什么不用 `requestAnimationFrame`：它在渲染前触发，页面不可见（切到后台标签页）时会被暂停。

时间片长度是 React 自己定的固定值（约 5ms，见 `frameYieldMs`），不依赖浏览器给的 `deadline`；`shouldYield()` 就是拿当前时间和这个截止点比较。

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

客户端执行任务时以帧为单位划分，大部分设备维持在 30-60 帧就不会影响体验。所以 React 需要的能力是：**在一帧的预算内做一小段工作，然后主动把主线程交还给浏览器，让它有机会完成排版绘制和响应输入。**

浏览器原生的空闲期 API `requestIdleCallback` 看起来正是为此设计的（在两帧之间的空闲期回调，并提供 `deadline` 用于切分任务），**但 React 没有采用它**——频率太低、时机不可控、Safari 不支持，详见上文「实现原理」。React 用 `MessageChannel` 宏任务自己实现让出，时间片固定约 5ms。

面试时如果被问到 `requestIdleCallback`，正确的回答是：「它是理解 Fiber 时间切片思路的最佳类比，也是 React 早期的探索方向，但最终实现没有用它，React 自己写了 Scheduler。」

- 高优先级任务，如动画相关的仍由 `requestAnimationFrame` 处理；
- `shouldYield()` 检查的是 React 自己设定的 5ms 截止时间，不是浏览器给的 `deadline`；
- 切分任务的目的都是一样的：避免单个任务长时间执行，阻塞 UI 渲染导致掉帧。


一旦reconciliation过程得到时间片，就开始进入work loop。work loop机制可以让react在计算状态和等待状态之间进行切换。为了达到这个目的，对于每个loop而言，需要追踪两个东西：下一个工作单元（下一个待处理的fiber）;当前还能占用主线程的时间。第一个loop，下一个待处理单元为根节点。


### react为何要使用深度优先遍历
1. 递归渲染的不可暂停的性质，而为了实现在 reconcile 阶段的暂停功能，必须要重新将虚拟 dom 转换为一种易暂停的数据结构——树结构
2. 如果树结构使用广度优先遍历，那么组件的生命周期将会乱套，因为生命周期的顺序是父componentWillMount-子componentWillMount-子componentDidMount-父componentDidMount，深度优先遍历可完美复现 react 15 的生命周期顺序；且一个虚拟 dom 的渲染要暂停，一般是得把最底层的虚拟 dom 给渲染完之后再暂停，没有道理先渲染组件的 sibling 组件


### Fiber源码解析
#### Stack Reconciler 和  Fiber Reconciler

Stack Reconciler 的实现使用了同步递归模型，该模型依赖于内置堆栈来遍历。如果只依赖内置调用堆栈，那么它将一直工作，直到堆栈为空。


#### Work
在 React Reconciliation 过程中出现的各种必须执行计算的活动，比如 state update，props update 或 refs update 等，这些活动我们可以统一称之为 work。
```js
Fiber = {
  // 标识 fiber 类型的标签，详情参看下述 WorkTag
  tag: WorkTag,
  // 指向父节点
  return: Fiber | null,
  // 指向子节点
  child: Fiber | null,
  // 指向兄弟节点
  sibling: Fiber | null,
  // 在开始执行时设置 props 值
  pendingProps: any,
  // 在结束时设置的 props 值
  memoizedProps: any,
  // 当前 state
  memoizedState: any,
  // Effect 类型，详情查看以下 effectTag
  effectTag: SideEffectTag,
  // effect 节点指针，指向下一个 effect
  nextEffect: Fiber | null,
  // effect list 是单向链表，第一个 effect
  firstEffect: Fiber | null,
  // effect list 是单向链表，最后一个 effect
  lastEffect: Fiber | null,
  // work 的过期时间，可用于标识一个 work 优先级顺序
  expirationTime: ExpirationTime
};
```

从react元素创建一个fiber对象
```js
export function createFiberFromElement(element: ReactElement, mode: TypeOfMode, expirationTime: ExpirationTime): Fiber {
    const fiber = createFiberFromTypeAndProps(type, key, pendingProps, owner, mode, expirationTime);
    return fiber;
}
```

#### workTag
workTag用于标志一个React元素的类型
```js
export const FunctionComponent = 0;
export const ClassComponent = 1;
export const IndeterminateComponent = 2; // Before we know whether it is function or class
export const HostRoot = 3; // Root of a host tree. Could be nested inside another node.
export const HostPortal = 4; // A subtree. Could be an entry point to a different renderer.
export const HostComponent = 5;
export const HostText = 6;
export const Fragment = 7;
export const Mode = 8;
export const ContextConsumer = 9;
export const ContextProvider = 10;
export const ForwardRef = 11;
export const Profiler = 12;
export const SuspenseComponent = 13;
export const MemoComponent = 14;
export const SimpleMemoComponent = 15;
export const LazyComponent = 16;
export const IncompleteClassComponent = 17;
export const DehydratedSuspenseComponent = 18;
export const EventComponent = 19;
export const EventTarget = 20;
export const SuspenseListComponent = 21;
```

#### EffectTag

#### Reconciliation 和 Scheduling
协调（Reconciliation）：
简而言之，根据 diff 算法来比较虚拟 DOM，从而可以确认哪些部分的 React 元素需要更改。

调度（Scheduling）：
可以简单理解为是一个确定在什么时候执行 work 的过程。

#### Render 阶段
##### enqueueSetState
```js
// Component函数
function Component(props, context, updater) {
    this.props = props;
    this.context = context;
    this.updater = updater || ReactNoopUpdateQueue;
}

// Component原型对象挂载 setState
Component.prototype.setState = function (partialState, callback) {
    this.updater.enqueueSetState(this, partialState, callback, 'setState');
};
```
```js
const classComponentUpdater = {
    enqueueSetState(inst, payload, callback) {
        // 获取 fiber 对象
        const fiber = getInstance(inst);
        const currentTime = requestCurrentTime();

        // 计算到期时间 expirationTime
        const expirationTime = computeExpirationForFiber(currentTime, fiber, suspenseConfig);

        const update = createUpdate(expirationTime, suspenseConfig);
        // 插入 update 到队列
        enqueueUpdate(fiber, update);
        // 调度 work 方法
        scheduleWork(fiber, expirationTime);
    },
};
```
```js
export const NoPriority = 0;
export const ImmediatePriority = 1;
export const UserBlockingPriority = 2;
export const NormalPriority = 3;
export const LowPriority = 4;
export const IdlePriority = 5;
```
##### renderRoot
```js
function renderRoot(
  root: FiberRoot,
  expirationTime: ExpirationTime,
  isSync: boolean,
) | null {
  do {
    // 优先级最高，走同步分支
    if (isSync) {
      workLoopSync();
    } else {
      workLoop();
    }
  } while (true);
}

// 所有的fiber节点都在workLoop 中被处理
function workLoop() {
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress);
  }
}
```
##### performUnitOfWork
```js
function performUnitOfWork(unitOfWork: Fiber): Fiber | null {
    const current = unitOfWork.alternate;

    let next;
    next = beginWork(current, unitOfWork, renderExpirationTime);

    // 如果没有新的 work，则认为已完成当前工作
    if (next === null) {
        next = completeUnitOfWork(unitOfWork);
    }

    return next;
}
```
##### completeUnitOfWork
```js
function completeUnitOfWork(unitOfWork: Fiber): Fiber | null {
    // 深度优先搜索算法
    workInProgress = unitOfWork;
    do {
        const current = workInProgress.alternate;
        const returnFiber = workInProgress.return;

        /*
    	构建 effect-list部分
    */
        if (returnFiber.firstEffect === null) {
            returnFiber.firstEffect = workInProgress.firstEffect;
        }
        if (workInProgress.lastEffect !== null) {
            if (returnFiber.lastEffect !== null) {
                returnFiber.lastEffect.nextEffect = workInProgress.firstEffect;
            }
            returnFiber.lastEffect = workInProgress.lastEffect;
        }

        if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = workInProgress;
        } else {
            returnFiber.firstEffect = workInProgress;
        }
        returnFiber.lastEffect = workInProgress;

        const siblingFiber = workInProgress.sibling;
        if (siblingFiber !== null) {
            // If there is more work to do in this returnFiber, do that next.
            return siblingFiber;
        }
        // Otherwise, return to the parent
        workInProgress = returnFiber;
    } while (workInProgress !== null);
}
```
#### Commit 阶段
##### commitRootImpl
commit 阶段实质上被分为如下三个子阶段：
- before mutation
- mutation phase
- layout phase

```js
function commitRootImpl(root) {
    if (firstEffect !== null) {
        // before mutation 阶段，遍历 effect list
        do {
            try {
                commitBeforeMutationEffects();
            } catch (error) {
                nextEffect = nextEffect.nextEffect;
            }
        } while (nextEffect !== null);

        // the mutation phase 阶段，遍历 effect list
        nextEffect = firstEffect;
        do {
            try {
                commitMutationEffects();
            } catch (error) {
                nextEffect = nextEffect.nextEffect;
            }
        } while (nextEffect !== null);

        // 将 work-in-progress 树替换为 current 树
        root.current = finishedWork;

        // layout phase 阶段，遍历 effect list
        nextEffect = firstEffect;
        do {
            try {
                commitLayoutEffects(root, expirationTime);
            } catch (error) {
                captureCommitPhaseError(nextEffect, error);
                nextEffect = nextEffect.nextEffect;
            }
        } while (nextEffect !== null);

        nextEffect = null;
    } else {
        // No effects.
        root.current = finishedWork;
    }
}
```

##### commitBeforeMutationEffects
```js
function commitBeforeMutationLifeCycles(
  current: Fiber | null,
  finishedWork: Fiber,
): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent:
    ...
    // 属性 stateNode 表示对应组件的实例
    // 在这里 class 组件实例执行 instance.getSnapshotBeforeUpdate()
    case ClassComponent: {
      if (finishedWork.effectTag & Snapshot) {
        if (current !== null) {
          const prevProps = current.memoizedProps;
          const prevState = current.memoizedState;
          const instance = finishedWork.stateNode;
          const snapshot = instance.getSnapshotBeforeUpdate(
            finishedWork.elementType === finishedWork.type
              ? prevProps
              : resolveDefaultProps(finishedWork.type, prevProps),
            prevState,
          );

          instance.__reactInternalSnapshotBeforeUpdate = snapshot;
        }
      }
      return;
    }
    case HostRoot:
    case HostComponent:
    case HostText:
    case HostPortal:
    case IncompleteClassComponent:
      ...
  }
}
```
##### commitMutationEffects
```js
function commitMutationEffects() {
  while (nextEffect !== null) {
    const effectTag = nextEffect.effectTag;

    let primaryEffectTag = effectTag & (Placement | Update | Deletion);
    switch (primaryEffectTag) {
      case Placement:
        ...
      case PlacementAndUpdate:
        ...
      case Update: {
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      case Deletion: {
        commitDeletion(nextEffect);
        break;
      }
    }
  }
}
```
##### commitLayoutEffects
```js
function commitLifeCycles(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedExpirationTime: ExpirationTime,
): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent:
      ...
    case ClassComponent: {
      // 属性 stateNode 表示对应组件的实例
      // 在这里 class 组件实例执行 componentDidMount/DidUpdate
      const instance = finishedWork.stateNode;
      if (finishedWork.effectTag & Update) {
        // 首次渲染时，还没有 current 树
        if (current === null) {
          instance.componentDidMount();
        } else {
          const prevProps =
            finishedWork.elementType === finishedWork.type
              ? current.memoizedProps
              : resolveDefaultProps(finishedWork.type, current.memoizedProps);
          const prevState = current.memoizedState;
          instance.componentDidUpdate(
            prevProps,
            prevState,
            instance.__reactInternalSnapshotBeforeUpdate,
          );
        }
      }
      const updateQueue = finishedWork.updateQueue;
      if (updateQueue !== null) {
        commitUpdateQueue(
          finishedWork,
          updateQueue,
          instance,
          committedExpirationTime,
        );
      }
      return;
    }
    case HostRoot:
    case HostComponent:
    case HostText:
    case HostPortal:
    case Profiler:
    case SuspenseComponent:
    case SuspenseListComponent:
      ...
  }
}
```

### 调用链路
![调用链路](https://p1.music.126.net/VU37zHp-6hAUfNaZbu3HRw==/109951165071751567.jpg)
