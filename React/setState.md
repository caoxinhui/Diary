## setState 使用方式

### 通过setState第二个参数，设置count值

```jsx harmony
this.setState({ count: this.state.count + 1 }, () => {
  this.setState({ count: this.state.count + 1 }, () => {
    this.setState({ count: this.state.count + 1 }, () => {
      console.log(this.state.count);
    });
  });
});
```


### setState的参数
 第一个参数可以是对象，也可以是方法，方法的入参是前一个状态

```jsx harmony
this.setState((prevState) => {
  return {
    count: prevState + 1
  };
});
console.log(this.state.count);
```
### 批量更新
react的setState是一个异步方法，React 会将所有的 setState 方法打包成一次进行更新，每次修改 state 都会进行更新。这样的设计主要是为了提高 UI 更新的性能，

我们知道 React 中 state 的改变会导致 UI 的更新。如果想要进行同步操作逻辑有两种方法。

1. 通过异步实现
```jsx harmony
componentDidMount(){
    setTimeout(() => {
        this.setState({
            value: this.state.value + 1
        })
        console.log('value', this.state.value)
    }, 0)
}
```
2. 通过回调函数实现
```jsx harmony
this.setState({
      value: this.state.value + 1
    }, () => {
      console.log('value', this.state.value) 
})
```

### 判断批量更新
在更新逻辑的部分，可以看到 React 会通过 batchingStrategy.isBatchingUpdates 判断当前的逻辑状态下是否需要进行批量更新

- 如果不是，那么就直接进行页面的批量更新，将之前累积的所有状态一次更新到组件上。
- 如果是，那么所有的组件状态不进行立即更新，而是将组件状态存放在一个叫 dirtyComponents 的数组中去，等待下次更新时机的到来再进行更新


#### 以下将一直渲染为5，即使他的父组件重新渲染
```jsx harmony
import React from "react";
import "./styles.css";

export default function App() {
  let variable = 5;
  setTimeout(() => {
    variable = variable + 5;
  }, 100);
  return <div className="App">{variable}</div>;
}
```


#### 一秒+3
```jsx harmony
export default function App() {
    const [variable, setVariable] = useState(5)
    setTimeout(() => {
        setVariable(variable + 3)
    }, 1000)
    return (
        <div className="App">
            {variable}
        </div>
    );
}
```


#### re-render会加3，否则不变
````jsx harmony
export default function App() {
    const variable = useRef(5)
    setTimeout(() => {
        variable.current = variable.current + 3
    }, 1000)
    return (
        <div className="App">
            {variable}
        </div>
    );
}
````


#### 父级
```jsx harmony
export default function App() {
  const [variable, setVariable] = useState(5);
  setTimeout(() => {
    setVariable(variable + 3);
  }, 1000);
  return (
    <div className="App">
      <h1>Hello {variable}</h1>
      <h2>Start editing to see some magic happen!</h2>
      <Child />
    </div>
  );
}

function Child() {
  let variable = 5;

  setTimeout(() => {
    variable = variable + 3;
  }, 100);

  return <div>{variable}</div>;
}
```

[参考文献](https://css-tricks.com/using-requestanimationframe-with-react-hooks/)


#### 实现一个计时器
<!-- 方法1 -->
```js
export default function App() {
  const startTime = Date.now();
  const [time, setTime] = useState(startTime);
  useEffect(() => {
    const id = setInterval(() => {
      setTime(Date.now() - startTime);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);
  return (
    <div className="App">
      <h1>{time}</h1>
      <h2>Start editing to see some magic happen!</h2>
    </div>
  );
}
```


<!-- 方法2 -->
也能实现计时，但是会不停地执行卸载
```js
export default function App() {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTime(time + 1000);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [time]);
  return (
    <div className="App">
      <h1>{time}</h1>
      <h2>Start editing to see some magic happen!</h2>
    </div>
  );
}
```

<!-- 方法3 -->
```js
export default function App() {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTime(previousCount => previousCount + 1);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);
  return (
    <div className="App">
      <h1>{time}</h1>
      <h2>Start editing to see some magic happen!</h2>
    </div>
  );
}
```

### 合成事件中的setState
react为了解决跨平台，兼容性问题，自己封装了一套事件机制，代理了原生事件，像在jsx中常见的onClick，onChange这些都是合成事件。

#### 生命周期函数中的setState
```jsx harmony
class App extends Component {
  state = { val: 0 }
 componentDidMount() {
    this.setState({ val: this.state.val + 1 })
   console.log(this.state.val) // 输出的还是更新前的值 --> 0
 }
  render() {
    return (
      <div>
        {`Counter is: ${this.state.val}`}
      </div>
    )
  }
}
```
当componentDidmount执行的时候，react内部并没有更新，执行完componentDidmount后才去commitUpdateQueue更新。这就导致你在componentDidmount中setState完去console.log拿的结果还是更新前的值。

#### 原生事件中的setState
```jsx harmony
export default class App extends React.Component {
  constructor() {
    super();
    this.state = {
      val: 0
    };
  }

  changeValue = () => {
    this.setState({ val: this.state.val + 1 });
    console.log(this.state.val);
  };

  componentDidMount() {
    document.body.addEventListener("click", this.changeValue, false);
  }

  render() {
    return <div>{`counter is :${this.state.val}`}</div>;
  }
}
```
原生事件是指非react合成事件，原生自带的事件监听 addEventListener ，或者也可以用原生js、jq直接 document.querySelector().onclick 这种绑定事件的形式都属于原生事件。
原生事件中setState的调用栈


#### setTimeout中的setState
```jsx harmony
export default class App extends React.Component {
  constructor() {
    super();
    this.state = {
      val: 0
    };
  }

  batchUpdates = () => {
    this.setState({ val: this.state.val + 1 });
    console.log(this.state.val);
    this.setState({ val: this.state.val + 1 });
    console.log(this.state.val);
    this.setState({ val: this.state.val + 1 });
    console.log(this.state.val);
  };

  render() {
    return (
      <div onClick={this.batchUpdates}>{`counter is :${this.state.val}`}</div>
    );
  }
}
```
上面的结果最终是1，在setState的时候react内部会创建一个updateQueue，通过firstUpdate、lastUpdate、lastUpdate.next去维护一个更新的队列，在最终的performWork中，相同的key会被覆盖，只会对最后一次的setState进行更新，

1. setState只在合成事件和钩子函数中是“异步”的，在原生事件和setTimeout 中都是同步的。
2. setState 的“异步”并不是说内部由异步代码实现，其实本身执行的过程和代码都是同步的，只是合成事件和钩子函数的调用顺序在更新之前，导致在合成事件和钩子函数中没法立马拿到更新后的值，形成了所谓的“异步”，当然可以通过第二个参数 setState(partialState, callback) 中的callback拿到更新后的结果。
3. setState 的批量更新优化也是建立在“异步”（合成事件、钩子函数）之上的，在原生事件和setTimeout 中不会批量更新，在“异步”中如果对同一个值进行多次setState，setState的批量更新策略会对其进行覆盖，取最后一次的执行，如果是同时setState多个不同的值，在更新时会对其进行合并批量更新。
