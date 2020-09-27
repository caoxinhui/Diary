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