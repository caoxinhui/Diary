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


### react合成事件
React 通过将事件 normalize 以让他们在不同浏览器中拥有一致的属性。


### props 和 state区别
- props 是传递给组件的（类似于函数的形参），而 state 是在组件内被组件自己管理的（类似于在一个函数内声明的变量）。
- props 是不可修改的，所有 React 组件都必须像纯函数一样保护它们的 props 不被更改。 由于 props 是传入的，并且它们不能更改，因此我们可以将任何仅使用 props 的 React 组件视为 pureComponent，也就是说，在相同的输入下，它将始终呈现相同的输出。
- state 是在组件中创建的，一般在 constructor中初始化 state
- state 是多变的、可以修改，每次setState都异步更新的。

### 1万个同属性子元素，react是如何做的（react事件机制）
- 最大程度上解决了 IE 等浏览器的不兼容问题
- 事件绑定到Document上，减少事件绑定的开销。
- React 通过对象池的形式管理合成事件对象的创建和销毁，减少了垃圾的生成和新对象内存的分配，提高了性能。
- 事件合成，即事件自定义，React 可以更加自由的定义事件，比如表单的一些onChange事件。
- 抽象跨平台事件机制，这点和VirtualDOM的意义相似。
- React打算干预事件的分发，不同类型的事件有不同的优先级，比如高优先级的事件可以中断渲染，让用户代码可以及时响应用户交互。


### setState内部实现
```jsx harmony
onClick = () => {
  this.setState({ index: this.state.index + 1 });
  this.setState({ index: this.state.index + 1 });
};
```
在react眼里，变成
```jsx harmony
Object.assign(previousState, { index: state.index + 1 }, { index: state.index + 1 });
```

由于后面的数据会覆盖前面的更改，所以最终只加了一次

**setState流程图**
![setState流程图](http://imweb-io-1251594266.file.myqcloud.com/Fm4JuXvwxmtZ_1RNpYnVvlZrSMdk)


#### ReactBaseClasses.js
```js
ReactComponent.prototype.setState = function(partialState, callback) {
  this.updater.enqueueSetState(this, partialState);
  if (callback) {
    this.updater.enqueueCallback(this, callback, 'setState');
  }
};
```
这里的partialState可以传object,也可以传function,它会产生新的state以一种Object.assgine（）的方式跟旧的state进行合并。

#### enqueueSetState
enqueueSetState 做了两件事： 1、将新的state放进数组里 2、用enqueueUpdate来处理将要更新的实例对象
```js
enqueueSetState:function(publicInstance, partialState) {
  // 获取当前组件的instance
  var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'setState');
  // 将要更新的state放入一个数组里
  var queue = internalInstance._pendingStateQueue || (internalInstance._pendingStateQueue = []);
  queue.push(partialState);
  //  将要更新的component instance也放在一个队列里
  enqueueUpdate(internalInstance);
}
```
#### enqueueUpdate
##### ReactUpdates.js
```js
function enqueueUpdate(component) {
  // 如果没有处于批量创建/更新组件的阶段，则处理update state事务
  if (!batchingStrategy.isBatchingUpdates) {
    batchingStrategy.batchedUpdates(enqueueUpdate, component);
    return;
  }
  // 如果正处于批量创建/更新组件的过程，将当前的组件放在dirtyComponents数组中
  dirtyComponents.push(component);
}
```

#### batchingStrategy
##### ReactDefaultBatchingStrategy.js
```js
var ReactDefaultBatchingStrategy = {
  // 用于标记当前是否出于批量更新
  isBatchingUpdates: false,
  // 当调用这个方法时，正式开始批量更新
  batchedUpdates: function(callback, a, b, c, d, e) {
    var alreadyBatchingUpdates = ReactDefaultBatchingStrategy.isBatchingUpdates;
    ReactDefaultBatchingStrategy.isBatchingUpdates = true;
    // 如果当前事务正在更新过程在中，则调用callback，既enqueueUpdate
    if (alreadyBatchingUpdates) {
      return callback(a, b, c, d, e);
    } else {
      // 否则执行更新事务
      return transaction.perform(callback, null, a, b, c, d, e);
    }
  }
};
```
1. 如果当前事务正在更新过程中，则使用enqueueUpdate将当前组件放在dirtyComponent里。 
2. 如果当前不在更新过程的话，则执行更新事务。


#### transaction
transaction对象，它暴露了一个perform的方法，用来执行anyMethod，在anyMethod执行的前，需要先执行所有wrapper的initialize方法，在执行完后，要执行所有wrapper的close方法，就辣么简单。

在ReactDefaultBatchingStrategy.js,tranction 的 wrapper有两个 FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES

````js
var RESET_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: function () {
    ReactDefaultBatchingStrategy.isBatchingUpdates = false;
  }
};

var FLUSH_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates)
};

var TRANSACTION_WRAPPERS = [FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES];
````
这两个wrapper的initialize都没有做什么事情，但是在callback执行完之后，RESET_BATCHED_UPDATES 的作用是将isBatchingUpdates置为false, FLUSH_BATCHED_UPDATES 的作用是执行flushBatchedUpdates,然后里面会循环所有dirtyComponent,调用updateComponent来执行所有的生命周期方法，componentWillReceiveProps, shouldComponentUpdate, componentWillUpdate, render, componentDidUpdate 最后实现组件的更新。
