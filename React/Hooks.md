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
