### ES5/6继承的差别
```js
// ES6
class Super {}
class Sub extends Super {}

const sub = new Sub();

Sub.__proto__ === Super;
```

```js
class ColorPoint extends Point {
    constructor(x, y, color) {
        super(x, y);
        this.color = color
    }

    toString() {
        return this.color + ' ' + super.toString()
    }

}
```
super指代父类的实例（父类的this对象)，子类必须在constructor中调用super方法，因为子类没有自己的this对象，而是继承了父类的this对象，然后对其进行加工。

ES5的继承实质上是先创造子类的实例对象this，然后再将父类的方法添加到this上（Parent.apply(this)）。ES6的继承实质上是先创造父类的实例对象this,然后再用子类的构造函数修改this


### 类的prototype属性和__proto__属性
class作为构造函数的语法糖，同时有prototype属性和__proto__属性，因此同时存在两条继承链
1. 子类的 __proto__ 属性表示构造函数的继承，总是指向父类
2. 子类 prototype 属性 __proto__ 属性表示方法的继承，总是指向父类的prototype属性

```js
class B extends A {
}

B.__proto__ === A
B.prototype.__proto__ === A.prototype


Object.setPrototypeOf(B.prototype, A.prototype)
Object.setPrototypeOf(B, A)
Object.setPrototypeOf = function (obj, proto) {
    obj.__proto__ = proto
    return obj
}
```


```js
// ES5
function Super() {}
function Sub() {}

Sub.prototype = new Super(); 
Sub.prototype.constructor = Sub;

var sub = new Sub();
```

### class 和 function 函数的区别
1. class 声明会提升，但不会初始化赋值。Foo 进入暂时性死区，类似于 let、const 声明变量。
```js
const bar = new Bar(); // it's ok
function Bar() {
  this.bar = 42;
}

const foo = new Foo(); // ReferenceError: Foo is not defined
class Foo {
  constructor() {
    this.foo = 42;
  }
}
```
2. class 声明内部会启用严格模式。
```js
// 引用一个未声明的变量
function Bar() {
  baz = 42; // it's ok
}
const bar = new Bar();

class Foo {
  constructor() {
    fol = 42; // ReferenceError: fol is not defined
  }
}
const foo = new Foo();
```

3. class 的所有方法（包括静态方法和实例方法）都是不可枚举的。
```js
// 引用一个未声明的变量
function Bar() {
  this.bar = 42;
}
Bar.answer = function() {
  return 42;
};
Bar.prototype.print = function() {
  console.log(this.bar);
};
const barKeys = Object.keys(Bar); // ['answer']
const barProtoKeys = Object.keys(Bar.prototype); // ['print']

class Foo {
  constructor() {
    this.foo = 42;
  }
  static answer() {
    return 42;
  }
  print() {
    console.log(this.foo);
  }
}
const fooKeys = Object.keys(Foo); // []
const fooProtoKeys = Object.keys(Foo.prototype); // []
```

4. class 的所有方法（包括静态方法和实例方法）都没有原型对象 prototype，所以也没有[[construct]]，不能使用 new 来调用。
```js
function Bar() {
  this.bar = 42;
}
Bar.prototype.print = function() {
  console.log(this.bar);
};

const bar = new Bar();
const barPrint = new bar.print(); // it's ok

class Foo {
  constructor() {
    this.foo = 42;
  }
  print() {
    console.log(this.foo);
  }
}
const foo = new Foo();
const fooPrint = new foo.print(); // TypeError: foo.print is not a constructor
```

5. 必须使用 new 调用 class。
```js
function Bar() {
  this.bar = 42;
}
const bar = Bar(); // it's ok

class Foo {
  constructor() {
    this.foo = 42;
  }
}
const foo = Foo(); // TypeError: Class constructor Foo cannot be invoked without 'new'
```

### es6类和继承的实现原理
[es6类和继承的实现原理](https://cloud.tencent.com/developer/article/1500264)


### ES5实现ES6的Class
