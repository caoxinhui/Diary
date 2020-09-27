### for、 forEach 、 for/in、 for/of

#### 语义概览
for 和 for/in 获得数组的 index
```js
const arr = ['a', 'b', 'c']
for (let i = 0; i < arr.length; i++) {
    console.log(arr[i])
}
for (let i in arr) {
    console.log(arr[i])
}
```

forEach 和 for/of 获得数组的 值
```js
const arr = ['a', 'b', 'c']
arr.forEach((v, i) => console.log(v))
for (const v of arr) {
    console.log(v)
}
```

#### 非数字属性
JavaScript数组是对象，可以给数组添加字符串属性
```js
const arr = ['a', 'b', 'c']
arr.test = 'bad'
console.log(arr.test)
arr[1] === arr['1']
```

for/in 将打印出bad，其他的3个会忽略非数字属性
```js
const arr = ['a', 'b', 'c']
arr.test = 'bad'
for (let i in arr) {
    console.log(arr[i])
}
```


#### 处理空元素
for/in 和 forEach 跳过空元素， for 和 for/of 不会跳过
```js
const arr = ['a', , 'c']
for (let i = 0; i < arr.length; i++) {
    console.log(arr[i])
}
arr.forEach(v => console.log(v))
for (let i in arr) {
    console.log(arr[i])
}

for (const v of arr) {
    console.log(v)
}
```

#### 函数上下文
for, for/in, and for/of 的 this 和外部作用域的值保持一致，forEach则不同，除非使用箭头函数

#### Async/Await and Generators

在forEach内部不能使用await