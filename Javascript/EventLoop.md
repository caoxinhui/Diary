![浏览器内核（渲染进程）.png](http://ww1.sinaimg.cn/large/92babc53gy1giulcnjkurj21pv0ilq6s.jpg)
### 进程线程
进程：资源分配的最小单位
线程：程序执行的最小单位
### 任务队列
所有任务可以分成两种，一种是同步任务（synchronous），另一种是异步任务（asynchronous），
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

### Node.js 的 EventLoop
Nodejs运行机制
```
（1）V8引擎解析JavaScript脚本。
（2）解析后的代码，调用Node API。
（3）libuv库负责Node API的执行。它将不同的任务分配给不同的线程，形成一个Event Loop（事件循环），以异步的方式将任务的执行结果返回给V8引擎。
（4）V8引擎再将结果返回给用户。
```
process.nextTick 方法可以在当前"执行栈"的尾部----下一次Event Loop（主线程读取"任务队列"）之前----触发回调函数。
setImmediate 方法则是在当前"任务队列"的尾部添加事件。
process.nextTick和setImmediate的一个重要区别：多个process.nextTick语句总是在当前"执行栈"一次执行完，多个setImmediate可能则需要多次loop才能执行完。

### 宏任务
JS 中，大部分任务都是在主线程上执行的，常见任务
- setTimeout
- setInterval 
- requestAnimationFrame 
- I/O
- setImmediate
- 渲染事件
- 用户交互事件
- js脚本执行
- 网络请求、文件读写完成事件等等。
其中 setImmediate 只存在于node中，requestAnimationFrame 只存在于 浏览器中

JS引擎需要对之执行的顺序做一定的安排，V8 其实采用的是一种队列的方式来存储这些任务， 即先进来的先执行。
将队列中的任务一一取出，然后执行。但是其中包含了两种任务队列，除了上述提到的任务队列， 还有一个**延迟队列**，它专门处理诸如setTimeout/setInterval这样的定时器回调任务。

普通任务队列和延迟队列中的任务，都属于**宏任务**。


### 微任务
微任务包括
- Promise
- MutationObserver
- Process.nextTick

其中process.nextTick只存在于Node中，MutationObserver只存在于浏览器中。

引入微任务的初衷是为了解决异步回调的问题
在每一个宏任务中定义一个微任务队列，当该宏任务执行完成，会检查其中的微任务队列，如果为空则直接执行下一个宏任务，如果不为空，则依次执行微任务，执行完成才去执行下一个宏任务。
常见的微任务有 MutationObserver、Promise.then(或.reject) 以及以 Promise 为基础开发的其他技术(比如fetch API), 还包括 V8 的垃圾回收过程


事件的执行顺序，是先执行宏任务，然后执行微任务。任务可以有同步任务和异步任务，同步的进入主线程，异步的进入 Event Table 并注册函数，异步事件执行完后，会将回调函数放入 Event Queue 中，同步任务执行完成后，会从 Event Queue 中读取事件放入主线程执行，回调函数还可能包含不同的任务，因此会循环执行上述操作。

```js
setTimeout(function() {
    console.log('a')
});

new Promise(function(resolve) {
    console.log('b');
    for(var i =0; i <10000; i++) {
        i ==99 && resolve();
    }
}).then(function() {
    console.log('c')
});

console.log('d');
//b
//d
//c
//a
```

1.首先执行script下的宏任务，遇到setTimeout，将其放入宏任务的队列里。
2.遇到Promise，new Promise直接执行，打印b。
3.遇到then方法，是微任务，将其放到微任务的队列里。
4.遇到console.log('d')，直接打印。
5.本轮宏任务执行完毕，查看微任务，发现then方法里的函数，打印c。
6.本轮event loop全部完成。
7.下一轮循环，先执行宏任务，发现宏任务队列中有一个setTimeout，打印a。

```js
console.log('a');

setTimeout(function () {
    console.log('b');
    process.nextTick(function () {
        console.log('c');
    })
    new Promise(function (resolve) {
        console.log('d');
        resolve();
    }).then(function () {
        console.log('e')
    })
})
process.nextTick(function () {
    console.log('f');
})
new Promise(function (resolve) {
    console.log('g');
    resolve();
}).then(function () {
    console.log('h')
})

setTimeout(function () {
    console.log('i');
    process.nextTick(function () {
        console.log('j');
    })
    new Promise(function (resolve) {
        console.log('k');
        resolve();
    }).then(function () {
        console.log('l')
    })
})
```

第一轮事件循环：
1.第一个宏任务(整体script)进入主线程，console.log('a')，打印a。
2.遇到setTimeout，其回调函数进入宏任务队列，暂定义为setTimeout1。
3.遇到process.nextTick()，其回调函数被分发到微任务队列，暂定义为process1。
4.遇到Promise，new Promise直接执行，打印g。then进入微任务队列，暂定义为then1。
5.遇到setTimeout，其回调函数进入宏任务队列，暂定义为setTimeout2。
此时我们看一下两个任务队列中的情况

|  宏任务队列   | 微任务队列  |
|  ----  | ----  |
| setTimeout1/setTimeout2 | process1/then1 |

第一轮宏任务执行完毕，打印出a和g。
查找微任务队列中有process1和then1。全部执行，打印f和h。
第一轮事件循环完毕，打印出a、g、f和h。

第二轮事件循环：
1. 从setTimeout1宏任务开始，首先是console.log('b')，打印b。
2. 遇到process.nextTick()，进入微任务队列，暂定义为process2。
3. new Promise直接执行，输出d，then进入微任务队列，暂定义为then2。
此时两个任务队列中

|  宏任务队列   | 微任务队列  |
|  ----  | ----  |
| setTimeout2 | process2/then2 |

第二轮宏任务执行完毕，打印出b和d。
查找微任务队列中有process2和then2。全部执行，打印c和e。
第二轮事件循环完毕，打印出b、d、c和e。

第三轮事件循环
1.执行setTimeout2，遇到console.log('i')，打印i。
2.遇到process.nextTick()，进入微任务队列，暂定义为process3。
3.new Promise直接执行，打印k。
4.then进入微任务队列，暂定义为then3。
此时两个任务队列中
宏任务队列：空
微任务队列：process3、then3
第三轮宏任务执行完毕，打印出i和k。
查找微任务队列中有process3和then3。全部执行，打印j和l。
第三轮事件循环完毕，打印出i、k、j和l。

**Tips**
以上是在浏览器中的运行结果，在node中的运行结果不一样

### 浏览器环境下EventLoop执行流程
1. 一开始整段脚本作为第一个宏任务执行
2. 执行过程中同步代码直接执行，宏任务进入宏任务队列，微任务进入微任务队列
3. 当前宏任务执行完出队，检查微任务队列，如果有则依次执行，直到微任务队列为空
4. 执行浏览器 UI 线程的渲染工作
5. 检查是否有Web worker任务，有则执行
6. 执行队首新的宏任务，回到2，依此循环，直到宏任务和微任务队列都为空


### nodejs环境下EventLoop
1. 执行 定时器回调 的阶段。检查定时器，如果到了时间，就执行回调。这些定时器就是setTimeout、setInterval。这个阶段暂且叫它timer。
2. 轮询(英文叫poll)阶段。因为在node代码中难免会有异步操作，比如文件I/O，网络I/O等等，那么当这些异步操作做完了，就会来通知JS主线程，怎么通知呢？就是通过'data'、 'connect'等事件使得事件循环到达 poll 阶段


1. timer 阶段
2. I/O 异常回调阶段
3. 空闲、预备状态(第2阶段结束，poll 未触发之前)
4. poll 阶段
5. check 阶段
6. 关闭事件的回调阶段


### nodejs 和 浏览器关于eventLoop的主要区别
两者最主要的区别在于浏览器中的微任务是在每个相应的宏任务中执行的，而nodejs中的微任务是在不同阶段之间执行的。


### process.nextTick
process.nextTick 是一个独立于 eventLoop 的任务队列。
在每一个 eventLoop 阶段完成后会去检查这个队列，如果里面有任务，会让这部分任务优先于微任务执行。
