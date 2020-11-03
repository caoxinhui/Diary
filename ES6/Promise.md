ES6 规定，Promise对象是一个构造函数，用来生成Promise实例。

一个异步操作的结果是返回另一个异步操作,由于p2返回的是另一个 Promise，导致p2自己的状态无效了，由p1的状态决定p2的状态。所以，后面的then语句都变成针对后者（p1）。又过了 2 秒，p1变为rejected，导致触发catch方法指定的回调函数。
```js
const p1 = new Promise(function (resolve, reject) {
    setTimeout(() => reject(new Error('fail')), 3000)
})
const p2 = new Promise(function (resolve, reject) {
    setTimeout(() => resolve(p1), 1000)
})
p2.then(result => console.log(result)).catch(error => console.log(error))

```
调用resolve或reject并不会终结 Promise 的参数函数的执行。调用resolve(1)以后，后面的console.log(2)还是会执行，并且会首先打印出来。这是因为立即 resolved 的 Promise 是在本轮事件循环的末尾执行，总是晚于本轮循环的同步任务。
```js
new Promise((resolve, reject) => {
    resolve(1);
    console.log(2);
}).then(r => {
    console.log(r);
});
// 2
// 1
```

Promise.prototype.then
then方法返回的是一个新的promise实例，因此可以采用链式写法

Promise.prototype.catch
```js
p.then(value => console.log('fulfilled:', value)).catch(error => console.log(error))
//等同于
p.then(val => console.log(val)).then(null, error => console.log(error))
```

```js
const promise = new Promise(function (resolve, reject) {
    throw new Error('test')
})
promise.catch(function (error) {
    console.log(error)
})

//等价
const promise = new Promise(function (resolve, reject) {
    try {
        throw new Error('test')
    } catch (e) {
        reject(e)
    }
})
promise.catch(function (error) {
    console.log(error)
})
```


如果 Promise 状态已经变成resolved，再抛出错误是无效的。

```js
const promise = new Promise(function (resolve, reject) {
    resolve('ok')
    throw new Error('test')
})
promise.then(function (value) {
    console.log(value)
}).catch(error => {
    console.log(error)
})
```

Promise 对象的错误具有“冒泡”性质，会一直向后传递，直到被捕获为止。也就是说，错误总是会被下一个catch语句捕获。
```js
getJSON('/post/1.json').then(function(post) {
  return getJSON(post.commentURL);
}).then(function(comments) {
  // some code
}).catch(function(error) {
  // 处理前面三个Promise产生的错误
});
```

then中返回的结果会作为入参
```js
const p1 = new Promise((resolve, reject) => (resolve('hello'))).then(result=>result).then(result=>console.log({result}))
```
