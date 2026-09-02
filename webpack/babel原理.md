# Babel 原理

### 抽象语法树（AST）
解析器会根据ECMAScript 标准「JavaScript语言规范」来对代码字符串进行词法分析，拆分成一个个词法单元，再遍历各个词法单元进行语法分析构造出AST。
### 词法分析（Lexical Analysis）
对代码解析时先进入词法分析阶段，tokenizer(分词器)会将原始代码按照特定字符(如let、var、=等保留字)分成一个个叫token的东西。token由分号、标签、变量、字符串等组成，tokenizer将tokens构造成如下数据结构。
### 语法分析（Syntactic Analysis）
词法分析完毕后进入语法分析阶段，语法分析将tokens重新格式化为描述语法各部分及其相互关系的表示形式，这就是抽象语法树。这个抽象语法树就是写Babel插件的核心概念，因为代码转换就是针对各个节点进行操作。
                                                             
### Babel编译过程
- 用解析器将代码转换成AST(抽象语法树) @babel/parser
- 遍历AST后使用插件进行修改 @babel/traverse
- 将AST转化成代码 @babel/generator

---

### Babel 和 Webpack 的关系

一句话：**不是替代关系，是"流水线"和"流水线上的一个工位"。** Webpack 负责依赖图和打包，它本身**完全不做语法转换**；Babel 负责把一个 JS 文件的新语法降级成旧语法，它本身**完全不知道依赖图和打包**。两者靠 `babel-loader` 这个适配层接在一起。

#### 接头在哪

放到 [webpack原理.md 的构建数据流](webpack原理.md#L16) 里，Babel 只占其中一格：

```
 读到 ./src/a.js
   │
   │ 按路径匹配 module.rules → 命中 { test: /\.js$/, use: 'babel-loader' }
   ▼
 babel-loader（约 200 行的胶水）
   │  把源码字符串交给 @babel/core.transform
   │    ├─ @babel/parser    → Babel AST
   │    ├─ @babel/traverse  → 按 preset / plugin 改 AST
   │    └─ @babel/generator → 生成 ES5 代码字符串
   ▼
 降级后的字符串还给 webpack
   │
   │ webpack 用 acorn 再解析一遍 → ESTree AST
   ▼
 找出 import / require → 登记依赖 → 继续递归
```

注意这里**有两棵互不复用的 AST**：Babel 用 `@babel/parser`，webpack 用 `acorn`。所以一个 JS 文件在一次构建里至少被完整 parse 两次 —— 这也是 Babel 通常是构建里最慢一环的原因，对应的优化就是 `babel-loader` 的 `cacheDirectory`、`thread-loader`，以及 webpack5 的 `cache: { type: 'filesystem' }`。

#### 分工边界

| | Babel | Webpack |
| --- | --- | --- |
| 处理单位 | 单个文件，进字符串出字符串 | 整个项目，进 entry 出 bundle |
| 认识 CSS / 图片吗 | 不认识 | 认识（交给别的 loader） |
| 认识 `import` 吗 | 认识，但只是个语法节点 | 认识，且据此构建依赖图 |
| 管 polyfill 吗 | 管（`core-js` / `regenerator`） | 不管，只当普通模块打进去 |
| 管代码分割 / Tree Shaking 吗 | 不管 | 管 |

#### 顺序带来的一个经典坑

因为 **Babel 先跑、Webpack 后分析**，Babel 的配置会直接影响 Webpack 的能力。最典型的是 `@babel/preset-env` 的 `modules` 选项：

```js
presets: [['@babel/preset-env', { modules: false }]]  // 必须
```

如果写成 `modules: 'commonjs'`，Babel 会把 `import` / `export` 提前转成 `require` / `exports`，等 webpack 拿到代码时静态结构已经没了 —— **Tree Shaking 直接全废**（见 [TreeShaking.md](TreeShaking.md)）。默认值 `'auto'` 之所以能正常工作，是因为 `babel-loader` 通过 caller 告知了 `supportsStaticESM: true`，Babel 才保留 ESM。

#### 松耦合的证据

- `babel-loader` 可以整个换成 `swc-loader` / `esbuild-loader`，webpack 完全不在乎，它只要一个"能返回 JS 字符串的函数"。
- Babel 也可以脱离 webpack 单用：`@babel/cli` 编译库、`babel-jest` 编译测试文件。
- 两者少见的**共享输入是 `browserslist`**：`preset-env` 读它决定降级到什么程度，autoprefixer 读它加前缀，webpack5 的 `target: 'browserslist'` 读它决定自己注入的 runtime 代码能不能用箭头函数。

#### 同类对照

`sass-loader` / `less-loader` 是同一个模式的另一个样本：主流程都只有几十行，真正的编译在外部包里。差异在于 Babel 不需要「解析桥接」（webpack 自己会再 parse 一遍找依赖），而 Sass / Less 的 `@import` webpack 看不懂，必须把 enhanced-resolve 桥接进编译器的 import 钩子。见 [CSS预处理器与loader原理.md](CSS预处理器与loader原理.md)。
