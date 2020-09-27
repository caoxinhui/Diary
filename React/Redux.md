[深入理解 react/redux 数据流并基于其优化前端性能](https://github.com/shaozj/blog/issues/36)
context创建全局store，全局状态更新，会引起组件内部不必要的更新

使用 react.memo， props引用

如果你的组件在相同 props 的情况下渲染相同的结果，那么你可以通过将其包装在 React.memo 中调用，以此通过记忆组件渲染结果的方式来提高组件的性能表现。

检测是否是H2
```js
var loadTimes = window.chrome.loadTimes();
var spdy = loadTimes.wasFetchedViaSpdy;
var info = loadTimes.npnNegotiatedProtocol || loadTimes.connectionInfo;
if(spdy && /^h2/i.test(info)) {
    return console.info('本站点使用了HTTP/2');
}
```


### classComponent 使用 context
```jsx harmony
import React, { Children } from "react";
import "./styles.css";
const defaultValue = {
  name: "hello",
  age: 12,
  contents: ["yelopo"]
};
const MyContext = React.createContext(defaultValue);
export default class App extends React.Component {
  newValue = {
    name: "cax",
    age: 22,
    contents: ["yelopo"]
  };
  render() {
    return (
      <div className="App">
        <MyContext.Provider value={this.newValue}>
          <Chiol />
        </MyContext.Provider>
        <h1>Hello CodeSandbox</h1>
        <h2>Start editing to see some magic happen!</h2>
      </div>
    );
  }
}

class Chiol extends React.Component {
  render() {
    return (
      <MyContext.Consumer>
        {({ name, age, contents }) => (
          <div>
            <div>{name}</div>
            <div>{age}</div>
            <div>{contents}</div>
          </div>
        )}
      </MyContext.Consumer>
    );
  }
}

```


### react/redux 更新机制
setState 会触发组件 re-render，而父组件的 re-render 会导致所有子组件 re-render（其实这里是一般情况，下方将说明不 re-render 的情况），除非子组件用了 shouldComponentUpdate 之类的优化。但是，有一种情况例外，如果子组件是 this.props.children, 父组件 re-render 不会导致子组件 re-render


[redux做的性能优化](https://github.com/shaozj/blog/issues/36)
### react 数据流和渲染机制
Context api 导致的 re-render

All consumers that are descendants of a Provider will re-render whenever the Provider's value prop changes. 


#### children 相关的 re-render 机制
组件内渲染 this.props.children 不 re-render


### 性能优化实现
1. 每次 store 变动，都会触发根组件 setState 从而导致 re-render。我们知道当父组件 re-render 后一定会导致子组件 re-render 。然而，引入 react-redux 并没有这个副作用，这是如何处理的？
其实在 react-redux v6 中，需要关心这个问题，在 v6 中，每次 store 的变化会触发根组件的 re-render。但是根组件的子组件不应该 re-render。其实是用到了我们上文中提到的 this.props.children。避免了子组件 re-render。在 v7 中，其实不存在该问题，store 中值的变化不会触发根组件 Provider 的 re-render。


2. 不同的子组件，需要的只是 store 上的一部分数据，如何在 store 发生变化后，仅仅影响那些用到 store 变化部分 state 的组件？


## redux 状态管理

[redux原理原文链接](https://github.com/brickspert/blog/issues/22)

### 状态值 只有 count 值

```js
// 修改count值后，使用count的地方都能收到通知。使用发布-订阅模式
let state = {
    count: 1
}

let listeners = []

function subscribe(listener){
    listeners.push(listener)
}

function changeCount(count) {
    state.count = count
    for (let i = 0; i < listeners.length; i++) {
        const listener = listeners[i]
        listener()
    }
}

subscribe(() => {
    console.log(state.count)
})

changeCount(2)
changeCount(3)
changeCount(4)
```

### 将 count 值调整为 initState

```js
const createStore = function(initState) {
    let state = initState
    let listeners = []

    function subscribe(listener) {
        listeners.push(listener)
    }

    function changeState(newState) {
        state = newState
        for (let i = 0; i < listeners.length; i++) {
            const listener = listeners[i]
            listener()
        }
    }

    function getState() {
        return state
    }
    return {
        getState,
        changeState,
        subscribe
    }
}
```

### 对状态约束，只允许通过 action 操作。（明确改动范围）

```js
function plan(state, action) {
    switch (action.type) {
        case 'INCREMENT':
            return {
                ...state,
                count: state.count + 1
            }
            case 'DECREMENT':
                return {
                    ...state,
                    count: state.count - 1
                }
                default:
                    return state
    }
}

const createStore = function(plan, initState) {
    let state = initState
    let listeners = []

    function subscribe(listener) {
        listeners.push(listener)
    }

    function changeState(action) {
        state = plan(state, action)
        for (let i = 0; i < listeners.length; i++) {
            const listener = listeners[i]
            listener()
        }
    }

    function getState() {
        return state
    }
    return {
        subscribe,
        getState,
        changeState
    }
}
```

#### 使用

```js
let initState = {
    count: 0
}
let store = createStore(plan, initState)
store.subscribe(() => {
    let state = store.getState()
    console.log(state.count)
})
store.changeState({
    type: 'INCREMENT'
})
store.changeState({
    type: 'DECREMENT'
})
```

### 多文件协作

```js
let state = {
    counter: {
        count: 0
    },
    info: {
        name: '',
        description: ''
    }
}

function counterReducer(state, action) {
    switch (action.type) {
        case 'INCRE':
            return {
                count: state.count + 1
            }
        case 'DECRE':
            return {
                count: state.count - 1
            }
        default:
            return count
    }
}

function InfoReducer(state, action) {
    switch (action.type) {
        case 'SET_NAME':
            return {
                ...state,
                name: action.name
            }
        case 'SET_DESCRIPTION':
            return {
                ...state,
                description: action.description
            }
        default:
            return state
    }
}

const reducers = combineReducers({
    counter: counterReducer,
    info: InfoReducer
})

function combineReducers(reducers) {
    const reducerKeys = Object.keys(reducers)
    return function combination(state, actions) {
        const nextState = {}
        for (let i = 0; i < reducerKeys.length; i++) {
            const key = reducerKeys[i]
            const reducer = reducers[key]
            const previousState = state[key]
            const nextStateForKey = reducer(previousState, actions)
            nextState[key] = nextStateForKey
            state[key] = nextStateForKey
        }
        return nextState
    }
}

let listeners = []

function subscribe(listener) {
    listeners.push(listener)
}
subscribe(() => {
    console.log(state)
})


function changeCount() {
    const newState = reducers(state, {type: 'INCRE'})
    for (let i = 0; i < listeners.length; i++) {
        listeners[i]()
    }
}

changeCount()


```

#### 使用

```js
const reducer = combineReducers({
    counter: counterReducer,
    info: InfoReducer
})
let initState = {
    counter: {
        count: 0
    },
    info: {
        name: '',
        description: ""
    }
}
let store = createStore(reducer, initState)
store.subscribe(() => {
    let state = store.getState()
    console.log(state.counter.count, state.info.name, state.info.description)
})
// 这里 dispatch 同前面 changeState
store.dispatch({
    type: 'INCREMENT'
})
store.dispatch({
    type: 'SET_NAME',
    name: ''
})
```

### state 拆分与合并

```js
let initState = {
    count: 0
}

function countReducer(state, action) {
    if (!state) {
        state = initState
    }
    switch (action.type) {
        case 'INCREMENT':
            return {
                count: state.count + 1
            }
            default:
                return state
    }
}

const createStore = function(reducer, initState) {
    let state = initState
    let listeners = []

    function subscribe(listener) {
        listeners.push(listener)
    }

    function dispatch(action) {
        state = reducer(state, action)
        for (let i = 0; i < listeners.length; i++) {
            const listener = listeners[i]
            listener()
        }
    }

    function getState() {
        return state
    }
    dispatch({
        type: Symbol()
    })
    return {
        subscribe,
        dispatch,
        getState
    }
}
```

### 中间件 middleware
> 中间件增强 dispatch 的功能

createStore(reducers[,initialState])
reducer(previousState,action)=>newState


```js
const createStore = function (reducer, initState) {
    let state = initState
    let listeners = []

    function subscribe(listener) {
        listeners.push(listener)
    }

    function dispatch(action) {
        state = reducer(state, action)
        for (let i = 0; i < listeners.length; i++) {
            listeners[i]()
        }
    }

    function getState() {
        return state
    }

    dispatch({type: Symbol()})

    return {
        subscribe,
        dispatch,
        getState
    }
}
let state = {

    count: 0

}


function counterReducer(state, action) {
    switch (action.type) {
        case 'INCRE':
            return {
                count: state.count + 1
            }
        case 'DECRE':
            return {
                count: state.count - 1
            }
        default:
            return state
    }
}

const loggerMiddleware = (action) => {
    console.log('this state', store.getState());
    console.log('action', action);
    next(action);
    console.log('next state', store.getState());
}

const exceptionMiddleware = (next) => (action) => {
    try {
        next(action)
    } catch (e) {
        console.error(e)
    }
}
const store = createStore(counterReducer, state)
const next = store.dispatch

store.dispatch = exceptionMiddleware(loggerMiddleware(next))

store.dispatch({
    type: 'INCRE'
})

```


### 实现 applyMiddleware
```js
const applyMiddleware = function (...middlewares) {
    return function rewriteCreateStoreFunc(oldCreateStore) {
        return function newCreateStore(reducer, initState) {
            const store = oldCreateStore(reducer, initState)
            const chain = middlewares.map(middleware => middleware(store))
            let dispatch = store.dispatch
            chain.reverse().map(middleware => dispatch = middleware(dispatch))
            store.dispatch = dispatch
            return store
        }
    }
}
```

## react-imvc 状态管理

```js
const createStore = function (reducer, initState) {
    let state = initState
    let listeners = []

    function subscribe(listener) {
        listeners.push(listener)
    }

    function dispatch(action) {
        state = reducer(state, action)
        for (let i = 0; i < listeners.length; i++) {
            listeners[i]()
        }
    }

    function getState() {
        return state
    }

    dispatch({type: Symbol()})
    subscribe((data) => {
        dispatch({
            type: data.actionType,
            payload: data.actionPayload
        })
    })
    return {
        subscribe,
        dispatch,
        getState
    }
}
let state = {
    count: 0
}

```
