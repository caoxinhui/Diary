[参考文献](https://overreacted.io/zh-hans/how-are-function-components-different-from-classes/)
React 中 props 是不可变的，但是，this 是可变的
React本身会随着时间的推移而改变，以便你可以在渲染方法以及生命周期方法中得到最新的实例
不同于this，props对象本身永远不会被React改变。

1. 输入框中随意输入内容
2. 点击send
3. 继续输入某些内容
4. 查看控制台打印的内容
### 区别示例
- class Component
> 控制台打出的是变化后的值
```jsx harmony
class App extends React.Component {
  constructor() {
    super();
    this.state = { message: "" };
  }
  handleMessageChange = e => {
    this.setState({
      message: e.target.value
    });
  };
  handleSendClick = () => {
    setTimeout(() => {
      console.log(this.state.message);
    }, 3000);
  };
  render() {
    return (
      <>
        <input value={this.state.message} onChange={this.handleMessageChange} />
        <button onClick={this.handleSendClick}>Send</button>
      </>
    );
  }
}
```
- functional component
> 控制台打出的是点击send时input输入框的值
```jsx harmony
export default function MessageThread() {
  const [message, setMessage] = useState("");
  const showMessage = () => {
    console.log("you said: " + message);
  };
  const handleSendClick = () => {
    setTimeout(showMessage, 3000);
  };
  const handleMessageChange = e => {
    setMessage(e.target.value);
  };
  return (
    <>
      <input value={message} onChange={handleMessageChange} />
      <button onClick={handleSendClick}>Send</button>
    </>
  );
}
```

### 解决class component问题
- 一种方法是在调用事件之前读取this.props，然后将他们显式地传递到timeout回调函数中去
```jsx harmony
class App extends React.Component {
    constructor() {
        super();
        this.state = { message: "" };
    }
    handleMessageChange = e => {
        this.setState({
            message: e.target.value
        });
    };
    handleSendClick = () => {
        //将当前信息暂存，显示传递到timeout中去
        const message = this.state.message
        setTimeout(() => {
            console.log(message);
        }, 3000);
    };
    render() {
        return (
            <>
                <input value={this.state.message} onChange={this.handleMessageChange} />
                <button onClick={this.handleSendClick}>Send</button>
            </>
        );
    }
}
```

- 在特定渲染中捕获所用的props或者state
[代码示例](https://codesandbox.io/s/summer-monad-t60xh?file=/src/ProfilePageClass.js)
```jsx harmony
class ProfilePage extends React.Component {
  render() {
    const props = this.props;
    const showMessage = () => {
      alert("Followed " + props.user);
    };

    const handleClick = () => {
      setTimeout(showMessage, 3000);
    };

    return <button onClick={handleClick}>Follow</button>;
  }
}
```


### 如果想要读取未来的值，functional component可以使用ref
```jsx harmony
export default function MessageThread() {
    const [message, setMessage] = useState("");
    const ref = useRef()
    const showMessage = () => {
        console.log("you said: " + ref.current);
    };
    const handleSendClick = () => {
        setTimeout(showMessage, 3000);
    };
    const handleMessageChange = e => {
        setMessage(e.target.value);
    };
    return (
        <>
            <input ref={ref} value={message} onChange={handleMessageChange}/>
            <button onClick={handleSendClick}>Send</button>
        </>
    );
}
```


[原文链接](https://zh-hans.reactjs.org/blog/2020/05/22/react-hooks.html)
class 组件中，我们从 this 获取到 props.count。this固定指向同一个组件实例
函数组件中，每次执行 render，props 作为该函数的参数传入，它是函数作用域下的变量。

由于 props 是 Example 函数作用域下的变量，可以说对于这个函数的每一次调用中，都产生了新的 props 变量，它在声明时被赋予了当前的属性，他们相互间互不影响。



### 为什么要有函数式组件 

1. hooks是比HOC和render props更优雅的逻辑复用方式
2. 函数式组件的心智模型更加“声明式”。hooks（主要是useEffect）取代了生命周期的概念（减少API），让开发者的代码更加“声明化”：
- 旧的思维：“我在这个生命周期要检查props.A和state.B（props和state），如果改变的话就触发xxx副作用”。这种思维在后续修改逻辑的时候很容易漏掉检查项，造成bug。
- 新的思维：“我的组件有xxx这个副作用，这个副作用依赖的数据是props.A和state.B”。从过去的命令式转变成了声明式编程。
- 类似的道理，除了声明副作用的API，react还提供了声明“复杂计算”的API（useMemo），取代了过去“在生命周期做dirty检查，将计算结果缓存在state里”的做法。

### 为什么函数式组件性能更优
 
- **组件不会被实例化，整体渲染性能得到提升**

因为组件被精简成一个`render`方法的函数来实现的，由于是无状态组件，所以无状态组件就不会在有组件实例化的过程，无实例化过程也就不需要分配多余的内存，从而性能得到一定的提升。

- **组件不能访问 this 对象**

无状态组件由于没有实例化过程，所以无法访问组件this中的对象，例如：this.ref、this.state等均不能访问。若想访问就不能使用这种形式来创建组件。

- **组件无法访问生命周期的方法**

因为无状态组件是不需要组件生命周期管理和状态管理，所以底层实现这种形式的组件时是不会实现组件的生命周期方法。所以无状态组件是不能参与组件的各个生命周期管理的。

- **无状态组件只能访问输入的 props ，同样的 props 会得到同样的渲染结果，不会有副作用**

无状态组件被鼓励在大型项目中尽可能以简单的写法来分割原本庞大的组件，未来React也会这种面向无状态组件在譬如无意义的检查和内存分配领域进行一系列优化，所以只要有可能，**尽量使用无状态组件**。


### class component劣势
以前class组件的生命周期处理副作用要么混在一起写，要么高阶组件拆分出来组合，但有多个高阶组件包裹的时候写法不优雅
