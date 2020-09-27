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
