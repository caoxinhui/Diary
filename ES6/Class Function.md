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


### 类的`prototype`属性和`__proto__`属性
class作为构造函数的语法糖，同时有`prototype`属性和`__proto__`属性，因此同时存在两条继承链
1. 子类的 `__proto__` 属性表示构造函数的继承，总是指向父类
2. 子类 prototype 属性 `__proto__` 属性表示方法的继承，总是指向父类的`prototype`属性


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
#### 类的实现
转换前：
```js
class Parent {
  constructor(a) {
    this.filed1 = a;
  }

  filed2 = 2;
  func1 = function() {
  };
}
```
转换后：
```js
function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError('Cannot call a class as a function');
  }
}

var Parent = function Parent(a) {
  _classCallCheck(this, Parent);
  this.filed2 = 2;
  this.func1 = function() {

  };
  this.filed1 = a;
};
```
可见class的底层依然是构造函数
1. 调用_classCallCheck方法判断当前函数调用前是否有new关键字
> 构造函数执行前有new关键字，会在构造函数内部创建一个空对象，将构造函数的proptype指向这个空对象的proto,并将this指向这个空对象。如上，_classCallCheck中：this instanceof Parent 返回true。
  若构造函数前面没有new则构造函数的proptype不会不出现在this的原型链上，返回false。

2. 将class内部的变量和函数赋给this。
3. 执行constuctor内部的逻辑。
4. return this (构造函数默认在最后我们做了)。

#### 继承的实现
转换前：
```js
class Child extends Parent {
  constructor(a, b) {
    super(a);
    this.filed3 = b;
  }

  filed4 = 1;
  func2 = function() {

  };
}
```
转换后：
```js
var Child = function(_Parent) {
  //调用_inherits函数继承父类的proptype。
  _inherits(Child, _Parent);

  function Child(a, b) {
    _classCallCheck(this, Child);
    // 这里的Child.proto || Object.getPrototypeOf(Child)实际上是父构造函数(_inherits最后的操作)，然后通过call将其调用方改为当前this，并传递参数。
    var _this = _possibleConstructorReturn(this, (Child.__proto__ || Object.getPrototypeOf(Child)).call(this, a));
    _this.filed4 = 1;
    _this.func2 = function() {
    };
    _this.filed3 = b;
    return _this;
  }

  return Child;
}(Parent);


/**
 *
 * (1) 校验父构造函数。
 * (2) 典型的寄生继承：用父类构造函数的proptype创建一个空对象，并将这个对象指向子类构造函数的proptype。
 * (3) 将父构造函数指向子构造函数的proto（这步是做什么的不太明确，感觉没什么意义。）
 */
function _inherits(subClass, superClass) {
  if (typeof superClass !== 'function' && superClass !== null) {
    throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: { value: subClass, enumerable: false, writable: true, configurable: true }
  });
  if (superClass)
    Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
}


//校验this是否被初始化，super是否调用，并返回父类已经赋值完的this。
function _possibleConstructorReturn(self, call) {
  if (!self) {
    throw new ReferenceError('this hasn\'t been initialised - super() hasn\'t been called');
  }
  return call && (typeof call === 'object' || typeof call === 'function') ? call : self;
}

```
1. 调用_inherits函数继承父类的proptype。
2. 用一个闭包保存父类引用，在闭包内部做子类构造逻辑。
3. new检查。
4. 用当前this调用父类构造函数。
5. 将行子类class内部的变量和函数赋给this。
6. 执行子类constuctor内部的逻辑。
可见，es6实际上是为我们提供了一个“组合寄生继承”的简单写法。

### super
super代表父类构造函数。
super.fun1() 等同于 Parent.fun1() 或 Parent.prototype.fun1()。
super() 等同于Parent.prototype.construtor()
当我们没有写子类构造函数时：
```js
var Child = function (_Parent) {
  _inherits(Child, _Parent);

  function Child() {
    _classCallCheck(this, Child);

    return _possibleConstructorReturn(this, (Child.__proto__ || Object.getPrototypeOf(Child)).apply(this, arguments));
  }

  return Child;
}(Parent);
```
可见默认的构造函数中会主动调用父类构造函数，并默认把当前constructor传递的参数传给了父类。
所以当我们声明了constructor后必须主动调用super(),否则无法调用父构造函数，无法完成继承。
典型的例子就是Reatc的Component中，我们声明constructor后必须调用super(props)，因为父类要在构造函数中对props做一些初始化操作。
### ES5实现ES6的Class
