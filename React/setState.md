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
      setTime((previousCount) => previousCount + 1);
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