### 共同点
#### 都可以描述一个对象或者函数

- interface
```typescript
interface User {
    name: string,
    age: number
}

interface SetUser {
    (name: string, age: number): void
}
```

- type
```typescript
type User = {
    name: string,
    age: number
}
type SetUser = (name: string, age: number): void;
```

#### 扩展与交叉类型
interface 可以 extends ，type 不允许 extends 和 implement，但 type 可以通过交叉类型实现 interface 和 extends 的行为

- interface extends interface

```typescript
interface Name {
    name: string
}

interface User extends Name {
    age: number
}
```

- interface extends type
```typescript
type Name = {
    name: string
}

interface User extends Name {
    age: number
}
```

- type 与 type 交叉

```typescript
type Name = {
    name: string
}
type User = Name & {
    age: number
}
```

- type 与 interface 交叉
```typescript
interface Name {
    name: string
}

type User = Name & {
    age: number
}
```

### 不同点

#### type 可以， interface 不行
- type 可以声明基本类型别名，联合类型，元组等类型
```typescript
// 基本类型别名
type Number = string
interface Dog {
    Wof()
}
interface Cat {
    Miao()
}
// 联合类型
type Pet = Dog | Cat
// 具体定义数组每个位置的类型
type PetList = [Dog,Pet]
```

- type 语句中还可以使用 typeof 获取实例的 类型进行赋值
```typescript
// 当你想获取一个变量的类型时，使用 typeof
let div = document.createElement('div');
type B = typeof div
```
#### interface 可以而 type 不行
- interface 能够声明合并
```typescript
interface User {
  name: string
  age: number
}

interface User {
  sex: string
}

/*
User 接口为 {
  name: string
  age: number
  sex: string 
}
*/
```


## 类型和接口的区别
1. 类型别名更为通用，右边可以是任何类型，包括类型表达式（类型，外加&或|等类型运算符），而在接口声明中，右边必须为结构。例如，下述类型别名不能用接口重写
```ts
type A = number
type B = A | string
```

2. 扩展接口时，Typescript将检查扩展的接口是否可赋值给被扩展的接口，例如：
```ts
interface A {
    good(x: number): string
    bad(x: number): string
}

interface B extends A {
    good(x: string | number): string
    bad(x: string): string // Error: Interface B incorrectly extends interface A.Type number is not assignable to type string
}
```
而使用交集类型时不会出现这种问题。如果把前例中的接口换成类型别名，把extends换成交集运算符(&)，typescript将尽其所能，把扩展和被扩展的类型组合在一起，最终的结果是重载bad的签名，而不会抛出编译时错误。

建模对象类型的继承时，Typescript对接口所做的可赋值性检查是捕获错误的有力工具。

3. 同一作用域中的多个同名接口将自动合并，同一作用域中的多个同名类型别名将导致编译时错误。这个特性称为声明合并。

```ts
interface User {
    name: string
}

interface User {
    age: number 
}

let a: User = {
    name: 'Ashely',
    age: 30
}

```
使用类型别名重写的话，会报错
```ts
type User = {
    name: string
}

type User = {
    age: number  // Error: Duplicate identifier 'User'
}
```