### 底层架构 —— Fiber架构
`Concurrent（并发） Mode`，最关键的一点是：实现异步可中断的更新。
基于这个前提，React花费2年时间重构完成了Fiber架构。
Fiber机构的意义在于，他将单个组件作为工作单元，使以组件为粒度的“异步可中断的更新”成为可能。



#### batchedUpdates
如果我们在一次事件回调中触发多次更新，他们会被合并为一次更新进行处理。在`Concurrent Mode`中，是以优先级为依据对更新进行合并的，使用范围更广。

                                   
### Scheduler的原理和实现
Scheduler包含两个功能：
1. 时间切片
2. 优先级调度


#### 时间切片原理
时间切片的本质是模拟实现requestIdleCallback

```js
一个task(宏任务) -- 队列中全部job(微任务) -- requestAnimationFrame -- 浏览器重排/重绘 -- requestIdleCallback
```

`requestIdleCallback`是在“浏览器重排/重绘”后如果当前帧还有空余时间时被调用的。
唯一能精准控制调用时机的API是requestAnimationFrame，他能让我们在“浏览器重排/重绘”之前执行JS。

这也是为什么我们通常用这个API实现JS动画 —— 这是浏览器渲染前的最后时机，所以动画能快速被渲染。

在React的render阶段，开启Concurrent Mode时，每次遍历前，都会通过Scheduler提供的shouldYield方法判断是否需要中断遍历，使浏览器有时间渲染：

```js
function workLoopConcurrent() {
  // Perform work until Scheduler asks us to yield
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}
```


#### 优先级调度
Scheduler对外暴露了一个方法unstable_runWithPriority。
这个方法接受一个优先级与一个回调函数，在回调函数内部调用获取优先级的方法都会取得第一个参数对应的优先级：
```js
function unstable_runWithPriority(priorityLevel, eventHandler) {
  switch (priorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
    case LowPriority:
    case IdlePriority:
      break;
    default:
      priorityLevel = NormalPriority;
  }

  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}
```


#### 优先级的意义
Scheduler对外暴露最重要的方法便是unstable_scheduleCallback。该方法用于以某个优先级注册回调函数。
不同优先级意味着不同时长的任务过期时间：
```js
var timeout;
switch (priorityLevel) {
  case ImmediatePriority:
    timeout = IMMEDIATE_PRIORITY_TIMEOUT;
    break;
  case UserBlockingPriority:
    timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
    break;
  case IdlePriority:
    timeout = IDLE_PRIORITY_TIMEOUT;
    break;
  case LowPriority:
    timeout = LOW_PRIORITY_TIMEOUT;
    break;
  case NormalPriority:
  default:
    timeout = NORMAL_PRIORITY_TIMEOUT;
    break;
}

var expirationTime = startTime + timeout;
```

```js
// Times out immediately
var IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out
var USER_BLOCKING_PRIORITY_TIMEOUT = 250;
var NORMAL_PRIORITY_TIMEOUT = 5000;
var LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
var IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;
```

如果该任务的过期时间比当前时间还短，表示他已经过期了，需要立即被执行。


Scheduler存在两个队列：
- timerQueue：保存未过期任务
- taskQueue：保存已过期任务

每当有新的未过期任务被注册，我们将其插入timerQueue并重新排列timerQueue中任务的顺序。
当timerQueue中有任务过期，我们将其取出并加入taskQueue。
取出taskQueue中最早过期的任务并执行他。

为了能在O(1)复杂度找到两个队列中时间最早的那个任务，Scheduler使用小顶堆
