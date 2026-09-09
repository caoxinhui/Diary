---
title: "EventLoop"
tags: [JavaScript]
prereq:
  - Javascript/作用域、执行上下文.md
  - 操作系统/纤程.md
related:
  - ES6/Promise.md
  - 面试题/计时器.md
deep:
  - 性能/浏览器.md
dup: []
---

![浏览器内核（渲染进程）.png](http://ww1.sinaimg.cn/large/92babc53gy1giulcnjkurj21pv0ilq6s.jpg)

### why EventLoop
各种浏览器事件同时触发时，肯定有一个先来后到的排队问题。决定这些事件如何排队触发的机制，就是事件循环。


### 进程线程
进程：资源分配的最小单位
线程：程序执行的最小单位
### 任务队列
所有任务可以分成两种，一种是同步任务（synchronous），另一种是异步任务（asynchronous）

**同步任务**
在主线程上排队执行的任务，只有前一个任务执行完毕，才能执行后一个任务；

**异步任务**
不进入主线程、而进入"任务队列"（task queue）的任务，只有"任务队列"通知主线程，某个异步任务可以执行了，该任务才会进入主线程执行。

```
（1）所有同步任务都在主线程上执行，形成一个执行栈（execution context stack）。
（2）主线程之外，还存在一个"任务队列"（task queue）。只要异步任务有了运行结果，就在"任务队列"之中放置一个事件。
（3）一旦"执行栈"中的所有同步任务执行完毕，系统就会读取"任务队列"，看看里面有哪些事件。那些对应的异步任务，于是结束等待状态，进入执行栈，开始执行。
（4）主线程不断重复上面的第三步。
```
### 定时器
setTimeout(fn,0)指定某个任务在主线程最早可得的空闲时间执行，也就是说，尽可能早得执行。它在"任务队列"的尾部添加一个事件，因此要等到同步任务和"任务队列"现有的事件都处理完，才会得到执行。HTML5标准规定了setTimeout()的第二个参数的最小值（最短间隔），不得低于4毫秒，如果低于这个值，就会自动增加。

### 宏任务
JavaScript外部的队列，外部队列主要是浏览器协调的各类事件的队列。
JS 中，大部分任务都是在主线程上执行的，常见任务
- setTimeout
- setInterval 
- requestAnimationFrame 
- I/O
- setImmediate
- 渲染事件
- 用户交互事件(鼠标、键盘)
- js脚本执行
- History API 操作
- 网络请求、文件读写完成事件等等。
其中 setImmediate 只存在于node中，requestAnimationFrame 只存在于 浏览器中

JS引擎需要对之执行的顺序做一定的安排，V8 其实采用的是一种队列的方式来存储这些任务， 即先进来的先执行。
将队列中的任务一一取出，然后执行。但是其中包含了两种任务队列，除了上述提到的任务队列， 还有一个**延迟队列**，它专门处理诸如setTimeout/setInterval这样的定时器回调任务。

普通任务队列和延迟队列中的任务，都属于**宏任务**。


### 微任务
JavaScript语言内部的事件队列
微任务包括
- Promise
- MutationObserver
- Process.nextTick

其中process.nextTick只存在于Node中，MutationObserver只存在于浏览器中。

**引入微任务的初衷是为了解决异步回调的问题**

在每一个宏任务中定义一个微任务队列，当该宏任务执行完成，会检查其中的微任务队列，如果为空则直接执行下一个宏任务，如果不为空，则依次执行微任务，执行完成才去执行下一个宏任务。
常见的微任务有 `MutationObserver`、`Promise.then(或.reject)` 以及以 `Promise` 为基础开发的其他技术(比如fetch API), 还包括 V8 的垃圾回收过程


事件的执行顺序，是先执行宏任务，然后执行微任务。任务可以有同步任务和异步任务，同步的进入主线程，异步的进入 `Event Table` 并注册函数，异步事件执行完后，会将回调函数放入 `Event Queue` 中，同步任务执行完成后，会从 `Event Queue` 中读取事件放入主线程执行，回调函数还可能包含不同的任务，因此会循环执行上述操作。

**Tips**

以上是在浏览器中的运行结果，在node中的运行结果不一样


### nodejs 和 浏览器关于eventLoop的主要区别
两者最主要的区别在于浏览器中的微任务是在每个相应的宏任务中执行的，而nodejs中的微任务是在不同阶段之间执行的。


### await 和 promise执行顺序
async 返回一个promise，返回的promise会放到回调队列中等待

### Tips

then中的微任务和return new Promise优先级不一样 👈
```js
async function async1() {
  console.log('async1 start');
  async2().then(()=>{
    console.log('async1 end');
  });
}

async function async2() {
  console.log('async2');
  return new Promise(((resolve, reject) => resolve()))
}


async1()
new Promise(function(resolve) {
  console.log('promisea');
  resolve();
}).then(function() {
  return new Promise((resolve, reject) => resolve())
}).then(function() {
  console.log('promisec')
})
```

<!-- KG:AUTO-START 由 scripts/kg.mjs build 生成，请勿手改；关系维护在 frontmatter -->
### 相关内容
- **前置**：[作用域、执行上下文](./作用域、执行上下文.md)、[进程、线程、纤程](../操作系统/纤程.md)
- **深入**：[浏览器的进程、线程与事件循环全景](../性能/浏览器.md)
- **相关**：[Promise](../ES6/Promise.md)、[计时器](../面试题/计时器.md)、[Slate 原理](../React-imvc/slate.md)
- **被引用**：[React 调度](../React/调度.md)、[高并发：Node.js 与 Java 的两条路](../性能/高并发.md)、[高级前后端能力地图（AI 时代）](../成长路线/高级前后端能力地图.md)
<!-- KG:AUTO-END -->
