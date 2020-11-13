### 前言

[参考文章](https://github.com/brickspert/blog/issues/26)
<!-- more -->


### useState 原理
```js
function Count() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <div>{count}</div>
      <Button onClick={() => { setCount(count + 1) }}>点击</Button>
    </div>
  )
}

let _state
function useState(initialValue) {
  _state = initialValue
  function setState(newValue) {
    _state = newValue
    render()
  }
  return [_state, setState]
}
```

### useEffect 原理
```js
useEffect(() => {
  console.log(count)
}, [count])


let _deps
function useEffect(callback, depArray) {
  const hasNoDeps = !depArray
  const hasChangedDeps = _deps
    ? !depArray.every((el, i) => el === _deps[i])
    : true
  if (hasNoDeps || hasChangedDeps) {
    callback()
    _deps = depArray
  }
}
```

但是如果页面中需要使用多个useState就会有问题，因为useState需要公用全局变量_state，我们需要可以存储多个_state 和 _deps

关键在于：
1. 初次渲染的时候，按照useState、useEffect的顺序，把state，deps等按顺序塞到 memoizedState 数组中
2. 更新的时候，按照顺序，从 memoizedState 中把上次记录的值拿回来。

```js
let memoizedState = []
let cursor = 0

function useState(initialValue) {
  memoizedState[cursor] = memoizedState[cursor] || initialValue
  const currentCursor = cursor
  function setState(newState) {
    memoizedState[currentCursor] = newState
    render()
  }
  return [memoizedState[cursor + 1], setState] //  返回当前 state，并把 cursor 加 1
}

function useEffect(callback, depArray) {
  const hasNoDeps = !depArray
  const deps = memoizedState[cursor]
  const hasChangedDeps = deps
    ? !depArray.every((el, i) => el === deps[i])
    : true
  if (hasNoDeps || hasChangedDeps) {
    callback()
    memoizedState[cursor] = depArray
  }
  cursor++
}
```

### why hooks
#### component非UI逻辑复用困难
一些状态相关或者副作用相关的非UI逻辑在不同组件之间复用起来十分困难


hooks相对于高阶组件和renderProps在复用代码逻辑方面有以下优势：
- 写法简单
- 组合简单
- 容易扩展
- 没有wrapper hell：hooks不会改变组件的层级结构，也不会有wrapper hell问题的产生


#### 组件的生命周期函数不适合side effect逻辑的管理
side effect的相关逻辑可能被分散到 `componentDidMount, componentWillMount, componentDidUpdate`三个生命周期中
这些互相关联的逻辑被分散到不同的函数中会导致bug的发生和产生数据不一致的情况。我们还可能会在组件的同一个生命周期函数防止很多互不关联的side effect逻辑。
由于每个hook都是一个函数，所以可以将和某个side effect相关的逻辑都放到同一个函数里面。


#### 不友好的class component

生命周期函数不适合side effect
由于JS本身的原因，在Class Component中你要手动为注册的event listener绑定this

