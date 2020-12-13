## 常见问题
- 怎么利用call、apply来求一个数组中最大或者最小值
- 如何利用call、apply来做继承
- apply、call、bind的区别和主要应用场景

```js
let obj = {name: 'tony'}

function Child(name) {
    this.name = name
}

Child.prototype = {
    constructor: Child,
    showName: function () {
        console.log(this.name)
    }
}

const child = new Child("tomas")
child.showName()

child.showName.call(obj)
child.showName.apply(obj)

const bind = child.showName.bind(obj)
bind()
```

### call/apply 和 bind的区别
call和apply改变了函数的this上下文后便执行该函数,而bind则是返回改变了上下文后的一个函数。

### call 和 apply的区别
他们俩之间的差别在于参数的区别，call和apply的第一个参数都是要改变上下文的对象，而call从第二个参数开始以参数列表的形式展现，apply则是把除了改变上下文对象的参数放在一个数组里面作为它的第二个参数。


### 应用

#### 类数组
js中的伪数组(例如通过document.getElementsByTagName获取的元素、含有length属性的对象)具有length属性，并且可以通过0、1、2…下标来访问其中的元素，但是没有Array中的push、pop等方法。就可以利用call，apply来转化成真正的数组，就可以使用数组的方法了

```html
<div class="div1">1</div>
<div class="div1">2</div>
<div class="div1">3</div>

let div = document.getElementsByTagName('div');
console.log(div); // HTMLCollection(3) [div.div1, div.div1, div.div1] 里面包含length属性

let arr2 = Array.prototype.slice.call(div);
console.log(arr2); // 数组 [div.div1, div.div1, div.div1]
```

####  fn内的arguments
```html
function fn10() {
    return Array.prototype.slice.call(arguments);
}
console.log(fn10(1,2,3,4,5)); // [1, 2, 3, 4, 5]
```

#### 含有length属性的对象
```js
let obj4 = {
	0: 1,
	1: 'thomas',
	2: 13,
	length: 3 // 一定要有length属性
};

console.log(Array.prototype.slice.call(obj4)); // [1, "thomas", 13]
```


### Array.toString()
toString() 返回一个字符串，表示指定的数组及其元素。
Array对象覆盖了Object的 toString 方法。对于数组对象，toString 方法连接数组并返回一个字符串，其中包含用逗号分隔的每个数组元素。

#### Array方法
- Array.from
```js
// 创建二维数组
Array.from(new Array(5),()=> (new Array(5)).fill(0))
```
- Array.isArray
- Array.of
- concat
- copyWithin
- entries
- every
- fill
- filter
- find
- findIndex
- flat
- flatMap
- forEach
- includes
- indexOf
- join
- keys
- lastIndexOf
- map
- pop
- push
- reduce
- reduceRight
- reverse
- shift
- slice
- some
- sort
- splice
- toLocaleString
- toSource
- unshift
- values
