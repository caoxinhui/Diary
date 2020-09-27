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
