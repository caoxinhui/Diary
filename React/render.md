## beforeMutation
在rootFiber.firstEffect上保存了一条需要执行副作用的Fiber节点的单向链表effectList，这些Fiber节点的updateQueue中保存了变化的props。

这些副作用对应的DOM操作在commit阶段执行。
除此之外，一些生命周期钩子（比如componentDidXXX）、hook（比如useEffect）需要在commit阶段执行。


commit阶段的主要工作（即Renderer的工作流程）分为三部分：
- before mutation阶段（执行DOM操作前）
- mutation阶段（执行DOM操作）
- layout阶段（执行DOM操作后）


before mutation阶段的代码很短，整个过程就是遍历effectList并调用commitBeforeMutationEffects函数处理。


### getSnapshotBeforeUpdate
从Reactv16开始，componentWillXXX钩子前增加了UNSAFE_前缀。是因为Stack Reconciler重构为Fiber Reconciler后，render阶段的任务可能中断/重新开始，对应的组件在render阶段的生命周期钩子（即componentWillXXX）可能触发多次。
React提供了替代的生命周期钩子getSnapshotBeforeUpdate。getSnapshotBeforeUpdate是在commit阶段内的before mutation阶段调用的，由于commit阶段是同步的，所以不会遇到多次调用的问题。

### useEffect
useEffect异步调用分为三步：
1. before mutation阶段在scheduleCallback中调度flushPassiveEffects
2. layout阶段之后将effectList赋值给rootWithPendingPassiveEffects
3. scheduleCallback触发flushPassiveEffects，flushPassiveEffects内部遍历rootWithPendingPassiveEffects
与 componentDidMount、componentDidUpdate 不同的是，在浏览器完成布局与绘制之后，传给 useEffect 的函数会延迟调用。这使得它适用于许多常见的副作用场景，比如设置订阅和事件处理等情况，因此不应在函数中执行阻塞浏览器更新屏幕的操作。
useEffect异步执行的原因主要是防止同步执行时阻塞浏览器渲染。

我们知道了在before mutation阶段，会遍历effectList，依次执行：
1. 处理DOM节点渲染/删除后的 autoFocus、blur逻辑
2. 调用getSnapshotBeforeUpdate生命周期钩子
3. 调度useEffect

## mutation

commitMutationEffects会遍历effectList

1. 根据ContentReset effectTag重置文字节点
2. 更新ref
3. 根据effectTag分别处理，其中effectTag包括(Placement | Update | Deletion | Hydrating)
