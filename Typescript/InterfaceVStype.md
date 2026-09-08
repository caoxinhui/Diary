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

---

# TypeScript 常用语法速查

## 1. 基础类型与变量标注

```ts
let userName: string = 'Ducc'
let age: number = 18
let ok: boolean = true
let big: bigint = 100n
let sym: symbol = Symbol('key')

// any 关闭类型检查（尽量不用）；unknown 是安全版 any，使用前必须收窄
let a: any = 1
let u: unknown = 1
if (typeof u === 'number') u.toFixed()   // unknown 必须先收窄才能用

// void：函数无返回值；never：不可能有值（抛错 / 死循环 / 穷尽检查）
function log(): void {}
function fail(msg: string): never { throw new Error(msg) }
```

## 2. 数组、元组、对象

```ts
let list1: number[] = [1, 2, 3]
let list2: Array<number> = [1, 2, 3]
let frozen: readonly number[] = [1, 2, 3]   // 不可 push/修改

// 元组：固定长度 + 每一位的类型
let pair: [string, number] = ['a', 1]
let named: [name: string, age?: number] = ['a']   // 具名 + 可选
let rest: [string, ...number[]] = ['a', 1, 2]     // 剩余元素

// 对象：可选 ?、只读 readonly、索引签名
interface Config {
  readonly id: string
  name?: string
  [key: string]: unknown
}
```
## 3. 联合类型、交叉类型、字面量类型

```ts
type Id = string | number             // 联合：满足其一
type Draggable = { drag(): void }
type Resizable = { resize(): void }
type UI = Draggable & Resizable       // 交叉：同时满足

type Direction = 'up' | 'down'        // 字面量联合，比 enum 更轻量
type HttpCode = 200 | 404

// 可辨识联合（Discriminated Union）：最常用的状态建模方式
type Result =
  | { status: 'success'; data: string }
  | { status: 'error'; error: Error }

function handle(r: Result) {
  if (r.status === 'success') r.data   // 这里自动收窄，能访问 data
  else r.error
}
```

## 4. 枚举

```ts
enum Status { Pending, Success = 10, Failed }   // 数字枚举，默认从 0 递增
enum Lang { Zh = 'zh', En = 'en' }              // 字符串枚举
const enum Flag { On = 1 }                      // 编译期内联，不生成运行时对象

// 现代等价写法：as const 对象 + 联合类型，更利于 tree-shaking
const Roles = { Admin: 'admin', User: 'user' } as const
type Role = typeof Roles[keyof typeof Roles]    // 'admin' | 'user'
```
## 5. 函数

```ts
// 可选参数、默认值、剩余参数
function greet(name: string, greeting = 'hi', ...rest: string[]): string {
  return `${greeting} ${name}`
}

// 函数类型
type Handler = (e: Event) => void
type Comparator<T> = (a: T, b: T) => number

// 重载：多个声明 + 一个实现签名
function parse(v: string): string[]
function parse(v: number): number[]
function parse(v: any): any[] { return [v] }

// this 类型
function onClick(this: HTMLButtonElement, e: MouseEvent) { this.disabled = true }

// 类型谓词：自定义类型守卫
function isString(v: unknown): v is string { return typeof v === 'string' }

// 断言函数：调用之后，后续代码里 v 就是非空的
function assertNonNull<T>(v: T): asserts v is NonNullable<T> {
  if (v == null) throw new Error('empty')
}
```
## 6. 泛型

```ts
function identity<T>(v: T): T { return v }
identity<string>('a')    // 显式指定
identity('a')            // 自动推断

// 约束 extends、默认类型
function getLen<T extends { length: number }>(v: T) { return v.length }
interface Box<T = string> { value: T }

// 多类型参数 + keyof 约束（写工具函数最常见的组合）
function pick<T extends object, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

// 泛型类
class Stack<T> {
  private items: T[] = []
  push(item: T) { this.items.push(item) }
  pop(): T | undefined { return this.items.pop() }
}
```

### 6.1 泛型约束的高级写法

**多重约束**：用交叉类型同时满足多个形状。

```ts
interface HasId { id: string }
interface HasName { name: string }

function label<T extends HasId & HasName>(v: T) { return `${v.id}-${v.name}` }
```

**按键筛选的约束**：只允许传「值是某种类型」的键。

```ts
// 取出 T 中值为 string 的键名
type StringKeys<T> = { [K in keyof T]-?: T[K] extends string ? K : never }[keyof T]

function getStr<T extends object, K extends StringKeys<T> & keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

getStr({ name: 'a', age: 1 }, 'name')
// getStr({ name: 'a', age: 1 }, 'age')   // Error: 'age' 的值不是 string
```

**构造签名约束**：写工厂函数和 Mixin 的基础。

```ts
type Ctor<T = {}> = new (...args: any[]) => T

function create<T>(C: new () => T): T { return new C() }

function Timestamped<TBase extends Ctor>(Base: TBase) {
  return class extends Base { createdAt = Date.now() }
}

class User { constructor(public name = '') {} }
const TUser = Timestamped(User)
new TUser().createdAt   // number
```
**元组约束与可变元组**：约束成 `readonly unknown[]` 才能安全地拆解参数列表。

```ts
function tail<T extends readonly unknown[]>(arr: readonly [unknown, ...T]): T {
  return arr.slice(1) as unknown as T
}
tail([1, 'a', true] as const)   // readonly ['a', true]

type First<T extends readonly unknown[]> =
  T extends readonly [infer F, ...unknown[]] ? F : never

// 给已有函数签名前置一个参数
type PrependArg<F extends (...a: any) => any, A> =
  F extends (...args: infer P) => infer R ? (first: A, ...rest: P) => R : never
```

**递归约束**：处理嵌套结构。

```ts
type DeepReadonly<T> = T extends (...a: any[]) => any
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

// 点号路径类型：常用于 i18n key、表单字段名校验
type Path<T> = T extends object
  ? { [K in keyof T & string]: T[K] extends object ? K | `${K}.${Path<T[K]>}` : K }[keyof T & string]
  : never

type P = Path<{ a: { b: { c: number } } }>   // 'a' | 'a.b' | 'a.b.c'
```
**分布式条件类型与阻止分布**：裸类型参数会对联合逐项展开，用元组包一层可以关掉。

```ts
type ToArray<T> = T extends any ? T[] : never
type A1 = ToArray<string | number>     // string[] | number[]

type ToArray2<T> = [T] extends [any] ? T[] : never
type A2 = ToArray2<string | number>    // (string | number)[]
```

**infer 上加约束**（TS 4.8+）：推断的同时做过滤，省掉一层嵌套条件类型。

```ts
type FirstStr<T> = T extends [infer S extends string, ...unknown[]] ? S : never
type R1 = FirstStr<['a', 1]>   // 'a'
type R2 = FirstStr<[1, 'a']>   // never
```

**const 类型参数**（TS 5.0）：调用方不写 `as const` 也能推断出字面量。

```ts
function names<const T extends readonly string[]>(v: T): T { return v }
const r = names(['a', 'b'])   // readonly ['a', 'b']，而不是 string[]
```

**NoInfer**（TS 5.4）：让某个参数不参与推断，只做校验。

```ts
declare function streetLight<C extends string>(colors: C[], defaultColor?: NoInfer<C>): void

streetLight(['red', 'green'], 'red')
// streetLight(['red', 'green'], 'blue')   // Error: 'blue' 不在 colors 里
```
**互斥属性（XOR）**：约束「两组属性只能出现一组」，React 组件 props 常用。

```ts
type Without<T, U> = { [K in Exclude<keyof T, keyof U>]?: never }
type XOR<T, U> = (Without<T, U> & U) | (Without<U, T> & T)

type LinkProps = XOR<{ href: string }, { onClick(): void }>

const p1: LinkProps = { href: '/a' }                       // OK
const p2: LinkProps = { onClick() {} }                      // OK
// const p3: LinkProps = { href: '/a', onClick() {} }       // Error: 不能同时给
```

**拒绝被放宽的宽泛类型**：只接受字面量，不接受 `string`。

```ts
type Literal<T extends string> = string extends T ? never : T

declare function tag<T extends string>(v: Literal<T>): T
declare const s: string

tag('a')     // OK，返回 'a'
// tag(s)    // Error: string 太宽
```

**保留字面量补全，同时允许自由输入**：`(string & {})` 这个 trick 能让编辑器仍提示已知值。

```ts
type Color = 'red' | 'blue' | (string & {})

const c1: Color = 'red'        // 有补全提示
const c2: Color = '#fff'       // 也允许
```




## 7. 类型断言与非空断言

```ts
const el = document.getElementById('app') as HTMLInputElement
const el2 = <HTMLInputElement>document.getElementById('app')  // .tsx 中不可用
el!.value = '1'                        // ! 非空断言，跳过 null 检查
const n = 'abc' as unknown as number   // 双重断言，无关类型强转，慎用

// as const 将对象/数组变为只读字面量类型（最精确）
const config = {
  host: 'localhost',
  port: 8080,
} as const
// 此时 config.host 类型为 'localhost'，而非 string；且属性全部 readonly
```

## 8. 类型收窄（Narrowing）

```ts
type Circle = { kind: 'circle'; r: number }
type Square = { kind: 'square'; size: number }

function f(v: string | Date | Circle | Square | null) {
  if (typeof v === 'string') v.trim()       // typeof
  else if (v instanceof Date) v.getTime()   // instanceof
  else if (v && 'r' in v) v.r               // in 操作符（右侧必须是对象类型）
  const s = v ?? 'default'                  // ?? 空值合并
  const t = v?.toString()                   // ?. 可选链
}

// 穷尽检查：将来漏掉某个分支时会在编译期报错
function assertNever(x: never): never { throw new Error('unexpected: ' + x) }
```

## 9. 类型运算符

```ts
interface User { id: number; name: string; tags: string[] }

type K = keyof User               // 'id' | 'name' | 'tags'
type V = User['name']             // string，索引访问
type Tag = User['tags'][number]   // string，取数组元素类型

const conf = { port: 80, host: 'a' }
type Conf = typeof conf           // { port: number; host: string }

// 条件类型 + infer 提取类型
type ElementOf<T> = T extends (infer U)[] ? U : never
type Unwrap<T> = T extends Promise<infer U> ? U : T

// 映射类型：修饰符可加可减（+/-），键可用 as 重映射
type Optional<T> = { [K in keyof T]?: T[K] }
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] }

// 模板字面量类型
type EventName = `on${'Click' | 'Focus'}`   // 'onClick' | 'onFocus'
```
## 10. 常用内置工具类型

```ts
interface User { id: number; name: string; age?: number }
declare function fn(a: string, b: number): boolean
declare class Cls { x: number }

type T1 = Partial<User>              // 全部变可选
type T2 = Required<User>             // 全部变必填
type T3 = Readonly<User>             // 全部变只读
type T4 = Pick<User, 'id' | 'name'>  // 挑选属性
type T5 = Omit<User, 'age'>          // 排除属性
type T6 = Record<string, User>       // 构造键值类型

type T7 = Exclude<'a' | 'b', 'a'>    // 'b'，从联合中排除
type T8 = Extract<'a' | 'b', 'a'>    // 'a'，从联合中提取
type T9 = NonNullable<string | null> // string

type T10 = ReturnType<typeof fn>     // boolean
type T11 = Parameters<typeof fn>     // [a: string, b: number]
type T12 = Awaited<Promise<string>>  // string，递归解包 Promise
type T13 = InstanceType<typeof Cls>  // Cls

type T14 = Uppercase<'a'>            // 'A'；另有 Lowercase / Capitalize / Uncapitalize
```

## 11. as const 与 satisfies

```ts
const arr = [1, 2] as const     // readonly [1, 2]，字面量不再放宽成 number[]

// satisfies：既校验是否符合类型，又保留精确的字面量推断
const colors = {
  red: '#f00',
  blue: '#00f',
} satisfies Record<string, `#${string}`>

colors.red   // 类型是 '#f00'；若写成 : Record<string, string> 就会退化成 string
```
## 12. 类

```ts
abstract class Base {
  abstract run(): void          // 抽象方法，子类必须实现
  protected log() {}            // 自身与子类可访问
}

interface Serializable { toJSON(): string }

class Service extends Base implements Serializable {
  static VERSION = '1.0'        // 静态成员
  readonly id: string           // 只读，只能在构造器内赋值
  private cache = new Map()     // 编译期私有
  #secret = 1                   // 运行时私有（ES 私有字段）

  // 参数属性：构造参数加修饰符，自动挂到实例上
  constructor(public name: string, id: string) {
    super()
    this.id = id
  }

  get upper() { return this.name.toUpperCase() }        // 存取器
  set upper(v: string) { this.name = v.toLowerCase() }

  run() {}
  toJSON() { return JSON.stringify({ id: this.id }) }
}
```
## 13. 声明与模块

```ts
// 全局声明（一般放在 .d.ts）
declare const __VERSION__: string
declare function gtag(...args: unknown[]): void

// 给非代码资源补类型（需写在没有顶层 import/export 的全局 .d.ts 里）
declare module '*.svg' {
  const src: string
  export default src
}

// 扩展已有类型（利用接口的声明合并）
declare global {
  interface Window { __APP__: { version: string } }
}

// 仅类型导入/导出，编译后被完全擦除
import type { User } from './types'
import { type User as U, createUser } from './types'
export type { User }

// 命名空间：老代码常见，新项目统一用 ES Module
namespace Utils { export const noop = () => {} }
```

## 14. tsconfig 高频配置

| 配置 | 作用 |
| --- | --- |
| `strict` | 一次性开启全部严格检查，建议始终 `true` |
| `strictNullChecks` | `null` / `undefined` 不再能赋给其他类型 |
| `noImplicitAny` | 禁止隐式 `any` |
| `target` / `lib` | 编译目标语法与内置类型库 |
| `module` / `moduleResolution` | 模块规范与解析策略（`bundler` / `node16`） |
| `baseUrl` / `paths` | 路径别名，如 `@/*` → `src/*` |
| `esModuleInterop` | 兼容 CommonJS 的默认导出 |
| `skipLibCheck` | 跳过 `.d.ts` 检查，明显加快编译 |
| `declaration` | 输出 `.d.ts`，写库必开 |
| `noUncheckedIndexedAccess` | 索引访问结果自动带上 `undefined` |







