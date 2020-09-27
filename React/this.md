### class component中声明函数的几种方法
- 方法1
```jsx harmony
class ProfilePage extends React.Component {
  showMessage = () => {
    console.log("Followed ");
  };

  handleClick = () => {
    setTimeout(this.showMessage, 0);
  };

  render() {
    return <button onClick={this.handleClick}>Follow</button>;
  }
}
```
- 方法2
```jsx harmony
class ProfilePage extends React.Component {
  constructor(props) {
    super(props);
    this.showMessage = this.showMessage.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }
  showMessage() {
    console.log("Followed ");
  }

  handleClick() {
    setTimeout(this.showMessage, 0);
  }

  render() {
    return <button onClick={this.handleClick}>Follow</button>;
  }
}
```

- 方法3
```jsx harmony
export default class ProfilePage extends React.Component {
  render() {
    const showMessage = () => {
      console.log("Followed ");
    };
    const handleClick = () => {
      setTimeout(showMessage, 0);
    };
    return <button onClick={handleClick}>Follow</button>;
  }
}
```

- 方法4
```jsx harmony
export default class ProfilePage extends React.Component {
  showMessage() {
    console.log("Followed ");
  }
  render() {
    const handleClick = () => {
      setTimeout(this.showMessage, 0);
    };
    return <button onClick={handleClick}>Follow</button>;
  }
}
```


### 为什么要在React类组件中为事件处理函数绑定this
[原文地址](https://medium.freecodecamp.org/this-is-why-we-need-to-bind-event-handlers-in-class-components-in-react-f7ea1a6f93eb)

- 如果不绑定方法，this值为window全局对象，严格模式下为undefined
> 此时，handleClick方法丢失了上下文（组件实例），即this
```jsx harmony
export default class ProfilePage extends React.Component {
  constructor(props) {
    super(props);
  }
  handleClick(event) {
    console.log(this);
  }
  render() {
    return <button onClick={this.handleClick}>Follow</button>;
  }
}
```

#### 默认绑定
````js
function display() {
    console.log(this)
}

display()
````
#### 隐式绑定
```js
const obj = {
    name: 'Saurabh',
    display: function () {
        console.log(this.name)
    }
}
obj.display()
```

事件处理程序方法会丢失其隐式绑定的上下文。当事件被触发并且处理程序被调用时，this的值会回退到默认绑定，即值为 undefined，这是因为类声明和原型方法是以严格模式运行。
当我们将事件处理程序的 this 绑定到构造函数中的组件实例时，我们可以将它作为回调传递，而不用担心会丢失它的上下文。
箭头函数可以免除这种行为，因为它使用的是词法 this 绑定，会将其自动绑定到定义他们的函数上下文。
