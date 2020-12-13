### const 和 var 区别

### tree shaking 如何处理副作用，window对象上挂载方法，并不想要摇树

### HTTP 缓存
如果经常更新，但是又不想更新那么频繁
cache-control 和 Etag 配合使用


### 从输入url到页面渲染经过了什么

### 白屏时间处理方法

### map 和 weakmap 区别
weakmap只接受对象作为键名，不接受其他类型的值作为键名，而且键名所指向的对象不计入垃圾回收机制。
weakmap设计的目的在于，键名是对象的弱引用（垃圾回收机制不该将引用考虑在内）。
weakmap的场合，它的键所对应的对象可能会在将来消失，weakmap结构有助于防止内存泄漏。
weakmap只有四种方法可用 get,set,has,delete

1. 一旦dom节点删除，状态会自动消失，不存在内存泄漏的风险
```js
let myElement = document.getElementById('logo')
let myWeakmap = new WeakMap()
myWeakmap.set(myElement, {timesClicked: 0})
myElement.addEventListener('click', function () {
    let logoData = myWeakmap.get(myElement)
    logoData.timesClicked++
    myWeakmap.set(myElement, logoData)
}, false)
```
2. 部署私有属性
```js
let _counter = new WeakMap()
let _action = new WeakMap()

class Countdown {
    constructor(counter, action) {
        _counter.set(this, counter)
        _counter.set(this, action)
    }

    dec() {
        let counter = _counter.get(this)
        if (counter < 1) return
        _counter.set(this, --counter)
        if (counter === 0) {
            _action.get(this)()
        }
    }
}

let c = new Countdown(2,()=>console.log('Done'))
c.dec()
c.dec()

// Countdown类的两个内部属性，_counter,_action,是实例的弱引用，如果删除实例，它们也会随之消失，不会造成内存泄漏
```
### 笔试题
```js
creatObj('a,b,c')
// {a:{b:{c:null}}}

repeat('s',1) // s
repeat('s',2) // ss
```
