### 箭头函数
```js
const obj = {
    a: function() { console.log(this) },
    b: {
    	c: () => {console.log(this)}
	}
}
obj.a()   //没有使用箭头函数打出的是obj
obj.b.c()  //打出的是window对象！！

```
obj.a调用后打出来的是obj对象，而obj.b.c调用后打出的是window对象而非obj，这表示多层对象嵌套里箭头函数里this是和最最外层保持一致的。


#### 箭头函数使用注意点
1. 函数体内的this对象就是定义时所在的对象，而不是使用时所在的对象
2. 不可以当做构造函数，不可以使用new命令
3. 不可以使用arguments对象，该对象在函数体内不存在。如果要用，可以用rest参数代替
4. 不可以使用yield命令，因此箭头函数不能用作Generator函数


### this几个例外情况
1. 被忽略的this
```js
function func() {
  console.log(this.a);
}

var a = 2;
func.call(null); //>> 2
                 //this指向了window
```
2. 隐式指向之隐式丢失
```js
function func() {
  console.log(this.a);
}
var a = 2;
var o = { a: 3, func: func };
var p = { a: 4 };
o.func(); //>> 3
(p.func = o.func)(); //>> 2
// 赋值表达式 p.func=o.func 的返回值是目标函数的引用，也就是 func 函数的引用
// 因此调用位置是 func() 而不是 p.func() 或者 o.func()
```
3. 箭头函数
箭头函数不遵守this的四种指向规则，而是根据函数定义时的作用域来决定 this 的指向。何谓“定义时的作用域”？就是你定义这个箭头函数的时候，该箭头函数在哪个函数里，那么箭头函数体内的this就是它父函数的this。
```js
function func() {
  // 返回一个箭头函数
  return a => {
    //this 继承自 func()
    console.log(this.a);
  };
}
var obj1 = {
  a: 2
};
var obj2 = {
  a: 3
};

var bar = func.call(obj1);
bar.call(obj2); //>> 2         不是 3 ！

// func() 内部创建的箭头函数会捕获调用时 func() 的 this。
// 由于 func() 的 this 绑定到 obj1， bar（引用箭头函数）的 this 也会绑定到 obj1，
// this一旦被确定，就不可更改，所以箭头函数的绑定无法被修改。（new 也不行！）
```
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
