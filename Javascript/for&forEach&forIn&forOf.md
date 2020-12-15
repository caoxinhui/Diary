### for、 forEach 、 for/in、 for/of


for..of和for..in均可迭代一个列表；但是用于迭代的值却不同，for..in迭代的是对象的 键 的列表，而for..of则迭代对象的键对应的值。

for...of循环、扩展运算符、解构赋值、Array.from方法内部调用的都是遍历器接口。这意味着，它们可以将Generator函数返回的Iterator对象作为参数
```js
function* numbers() {
    yield 1
    yield 2
    return 3
    yield 4
}

[...numbers()]
Array.from(numbers())
let [x, y] = numbers()
```


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

#### for
当在循环满足特定条件时跳出循环体，或跳出本次循环直接进行下一次循环。
```js
for (let i = 0; i < arr.length; i++) {
    if (i === 3) continue
    if (i > 7) break
}

```

#### forEach
`arr.forEach(callback[,thisArg])` thisArg 用来改变this指向。
for，map 由于是通过回调函数的方式对遍历到的元素进行操作，即使在回调函数中 return ，也仅能够跳出当前的回调函数，无法阻止遍历本身的暂停。
```js
const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
arr.forEach(item => {
    console.log(item)
    if (item > 3) return
})

```

#### 非数字属性
JavaScript数组是对象，可以给数组添加字符串属性
```js
const arr = ['a', 'b', 'c']
arr.test = 'bad'
console.log(arr.test)
arr[1] === arr['1']
```

for/in 将打印出bad，其他的3个会忽略非数字属性。for/in 包含数组的原型属性，方法以及索引
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

在forEach内部不能使用await，且不能通过continue，break跳出循环


### Generator的遍历
for...of循环可以自动遍历Generator函数运行时生成的Iterator对象。除了for...of外，扩展运算符、解构赋值、Array.from方法内部调用的，都是遍历器接口
