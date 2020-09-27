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