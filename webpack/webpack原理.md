# Webpack 原理

### Webpack 是什么

一句话：**静态模块打包器（static module bundler）**。从一个或多个入口出发，递归分析出整个项目的依赖关系，把 JS / CSS / 图片 / 字体等**一切资源都当成模块**，转换之后打包成浏览器可以直接运行的少量静态文件。

它要解决的是「源码直接丢给浏览器跑不起来」的四个问题：

| 痛点 | 手写 `<script>` 的样子 | Webpack 的解法 |
| --- | --- | --- |
| 依赖顺序 | 人肉排 `<script>` 顺序，A 依赖 B 就必须写在 B 后面，改一处顺序全炸 | 从 entry 递归构建依赖图，顺序由图推导出来 |
| 请求数量 | 几十个小文件 = 几十个请求，HTTP/1.1 下同域并发只有 6 条 | 打成少数几个 bundle，按需再切 chunk |
| 作用域污染 | `var` 全挂在 `window` 上，防冲突只能靠 IIFE + 命名空间约定 | 每个模块包一层函数作用域，对外只暴露 `exports` |
| 只认 JS | ES6+ / TS / SCSS / 图片浏览器都不认 | loader 把任意类型的文件转成合法的 JS 模块 |

### 一次构建的数据流

```
 webpack.config.js + shell 参数 ──合并──→ 最终 options
        │
        ▼
 ┌─ entry: ./src/index.js
 │      │  读文件 → 用路径匹配 module.rules → 跑 loader 链（从右到左）
 │      ▼
 │   转成 JS 的模块 ──acorn 解析──→ AST
 │      │  遇到 import / require 就登记一条依赖
 │      ▼
 │   对新依赖重复上面两步，直到没有新模块
 └──────────────────────────── ⇒ Dependency Graph（模块 + 边）
        │
        │ seal：按 entry / 动态 import() / splitChunks 切分
        ▼
   Chunk ──优化：Tree Shaking、压缩混淆、提取 CSS、加 hash──→ Asset
        │
        ▼
   写到 output.path（HtmlWebpackPlugin 顺手生成引用它们的 html）
```

关键点：**依赖图是"分析"出来的，不是配置出来的**。你只声明入口，剩下的靠静态分析 `import` / `require` 得到 —— 这也是 Tree Shaking 只对 ESM 有效的根因：`import` 是编译期可确定的静态结构，`require` 可以写在 `if` 里，图就画不准了。

### 主要功能

| 功能 | 靠什么实现 | 收益 |
| --- | --- | --- |
| 语法降级与类型编译 | `babel-loader` / `ts-loader` / `swc-loader` | 源码用 ES6+ / TS，产物兼容目标浏览器 |
| 样式处理 | `sass-loader` → `css-loader` → `style-loader`（或 `MiniCssExtractPlugin.loader`） | 直接 `import './a.scss'`，还能开 CSS Modules |
| 静态资源 | webpack5 的 `asset/resource`、`asset/inline`（旧版 `file-loader` / `url-loader`） | 小图自动转 base64，大图输出带 hash 的文件 |
| 代码分割 | 多 entry、`import()` 动态导入、`optimization.splitChunks` | 首屏只加载必要的 chunk，公共依赖单独缓存 |
| Tree Shaking | ESM 静态分析 + `usedExports` + Terser 删死代码 | 未被引用的导出不进产物，详见 [TreeShaking.md](TreeShaking.md) |
| 压缩混淆 | `mode: 'production'` 默认启用 TerserPlugin | 体积下降，同时去掉 `console` 等 |
| HMR | `webpack-dev-server` + `HotModuleReplacementPlugin` | 运行时替换模块，不刷新页面、不丢当前状态 |
| 环境变量注入 | `DefinePlugin` | 编译期替换 `process.env.NODE_ENV`，配合压缩把死分支整块删掉 |
| 路径别名 | `resolve.alias` / `resolve.extensions` | 用 `@/utils` 代替一串 `../../` |

### loader 和 plugin 的分工

这是最高频的一道追问，答清"作用域不同"就够了：

- **loader 是文件级的转换器**，只关心"把这一个文件的内容变成另一份内容"。它作用在模块加载阶段，配在 `module.rules` 里，同一条规则的多个 loader **从右到左 / 从下到上**串行执行，本质是 `a(b(c(source)))`。
- **plugin 是构建级的扩展**，通过 `apply(compiler)` 往 webpack 生命周期的 hook 上挂回调（底层是 tapable 的发布订阅），能拿到 `compiler` / `compilation` 做任何事：改产物、加文件、生成 manifest、注入 html。loader 做不到的（跨模块、跨阶段、改输出列表）都归 plugin。

一句话：**loader 管"怎么读懂一个文件"，plugin 管"整个打包流程里还要额外做什么"。**

---

### webpack核心概念
- entry 一个可执行模块或库的入口文件。
- module 一切皆模块。不只是 JS，CSS、图片、字体经 loader 转换后都是模块。
- chunk 多个文件组成的一个代码块，例如把一个可执行模块和它所有依赖的模块组合和一个 chunk 这体现了webpack的打包机制。
- bundle / asset chunk 经过优化后最终落盘的文件，文件名由 `output.filename` 和 hash 规则决定。
- loader 文件转换器，例如把es6转换为es5，scss转换为css。
- plugin 插件，用于扩展webpack的功能，在webpack构建生命周期的节点上加入扩展hook为webpack加入功能。
- output 产物输出到哪里、叫什么名字（`path` / `filename` / `publicPath`）。
- mode `development` / `production`，一个开关决定一整套默认优化（压缩、Tree Shaking、devtool、`process.env.NODE_ENV`）。

### webpack构建流程
- 解析webpack配置参数，合并从`shell`传入和`webpack.config.js`文件里配置的参数，生产最后的配置结果。
- 注册所有配置的插件，好让插件监听webpack构建生命周期的事件节点，以做出对应的反应，实例化 Compiler。
- 从配置的entry入口文件开始解析文件构建AST语法树，找出每个文件所依赖的文件，递归下去。
- 在解析文件递归的过程中根据文件类型和loader配置找出合适的loader用来对文件进行转换。
- 递归完后得到每个文件的最终结果，根据entry配置生成代码块chunk。
- 输出所有chunk到文件系统。


#### 初始化阶段
|事件名|解释|
| ---- |---- |
|初始化参数|从配置文件和 Shell 语句中读取与合并参数，得出最终的参数。 这个过程中还会执行配置文件中的插件实例化语句 new Plugin()。|
|实例化 Compiler|用上一步得到的参数初始化 Compiler 实例，Compiler 负责文件监听和启动编译。Compiler 实例中包含了完整的 Webpack 配置，全局只有一个 Compiler 实例。|
|加载插件|依次调用插件的 apply 方法，让插件可以监听后续的所有事件节点。同时给插件传入 compiler 实例的引用，以方便插件通过 compiler 调用 Webpack 提供的 API。|
|environment|开始应用 Node.js 风格的文件系统到 compiler 对象，以方便后续的文件寻找和读取。|
|entry-option|读取配置的 Entrys，为每个 Entry 实例化一个对应的 EntryPlugin，为后面该 Entry 的递归解析工作做准备。|
|after-plugins|调用完所有内置的和配置的插件的 apply 方法。|
|after-resolvers|根据配置初始化完 resolver，resolver 负责在文件系统中寻找指定路径的文件。|


#### 编译阶段
|事件名|解释|
| ---- |---- |
|before-run|清除缓存|
|run|启动一次新的编译。|
|watch-run|和 run 类似，区别在于它是在监听模式下启动的编译，在这个事件中可以获取到是哪些文件发生了变化导致重新启动一次新的编译。|
|compile|该事件是为了告诉插件一次新的编译将要启动，同时会给插件带上 compiler 对象。|
|compilation|当 Webpack 以开发模式运行时，每当检测到文件变化，一次新的 Compilation 将被创建。一个 Compilation 对象包含了当前的模块资源、编译生成资源、变化的文件等。Compilation 对象也提供了很多事件回调供插件做扩展。|
|make|一个新的 Compilation 创建完毕，即将从 Entry 开始读取文件，根据文件类型和配置的 Loader 对文件进行编译，编译完后再找出该文件依赖的文件，递归的编译和解析。|
|after-compile|一次 Compilation 执行完成。这里会根据编译结果 合并出我们最终生成的文件名和文件内容。|
|invalid|当遇到文件不存在、文件编译错误等异常时会触发该事件，该事件不会导致 Webpack 退出。|

这里主要最重要的就是compilation过程，compilation 实际上就是调用相应的 loader 处理文件生成 chunks并对这些 chunks 做优化的过程。几个关键的事件（Compilation对象this.hooks中）：

|事件名|解释|
| ---- |---- |
|build-module|使用对应的 Loader 去转换一个模块。|
|normal-module-loader|在用 Loader 对一个模块转换完后，使用 acorn 解析转换后的内容，输出对应的抽象语法树（AST），以方便 Webpack 后面对代码的分析。|
|program|从配置的入口模块开始，分析其 AST，当遇到 require 等导入其它模块语句时，便将其加入到依赖的模块列表，同时对新找出的依赖模块递归分析，最终搞清所有模块的依赖关系。|
|seal|所有模块及其依赖的模块都通过 Loader 转换完成后，根据依赖关系开始生成 Chunk|



#### 输出阶段
|事件名|解释|
| ---- |---- |
|should-emit|所有需要输出的文件已经生成好，询问插件哪些文件需要输出，哪些不需要。|
|emit|确定好要输出哪些文件后，执行文件输出，可以在这里获取和修改输出内容。|
|after-emit|文件输出完毕。|
|done|成功完成一次完成的编译和输出流程。|
|failed|如果在编译和输出流程中遇到异常导致 Webpack 退出时，就会直接跳转到本步骤，插件可以在本事件中获取到具体的错误原因。|

---

### 热更新（HMR）原理

一句话：**编译侧生成"补丁文件"，运行时侧用补丁替换掉内存里的模块工厂函数，并沿依赖链向上找到愿意接手的模块重新执行它的回调。** 全程不刷新页面，所以 state 能留住。

#### 三方参与者

| 角色 | 在哪 | 干什么 |
| --- | --- | --- |
| webpack（watch 模式） | Node | 监听文件、**增量**重新编译、产出 hot-update 补丁 |
| webpack-dev-server / dev-middleware | Node | 产物存内存（memfs，不落盘）、起 WebSocket、编译完广播消息 |
| HMR runtime + dev-server client | 浏览器 bundle 里 | 收消息、下载补丁、执行替换。它们是被**当作额外 entry 注入**进 bundle 的 |

`HotModuleReplacementPlugin` 负责往每个 chunk 里塞 HMR runtime；dev-server 负责把 client 代码加进 entry。webpack5 的 dev-server 里 `hot: true` 是默认值，插件会自动加上。

#### 完整链路

```
 你保存了 src/Button.jsx
   │
 ┌─ Node 侧
 │ watch 触发 → 只重新编译受影响的模块（复用上一次 compilation 的模块图）
 │ 编译完成，dev-server 挂在 done hook 上拿到 stats
 │ 产出两个内存文件，⚠️ 文件名用的是【上一次的 hash】：
 │    [oldHash].hot-update.json          manifest：哪些 chunk 变了
 │    [chunkId].[oldHash].hot-update.js  补丁：新的模块工厂函数
 │ 通过 WebSocket 广播 { type:'hash', data:newHash } → { type:'ok' }
 └────────────────────────┬─────────────────────────────────
                          ▼
 ┌─ 浏览器侧
 │ client 收到 ok → module.hot.check()
 │   │  用自己当前持有的 hash 拼出 URL，向 publicPath 拉那两个文件
 │   │  补丁是 JSONP 形式：webpackHotUpdate(chunkId, { './Button.jsx': fn })
 │   ▼
 │ apply 阶段
 │   ① 标记过期模块（outdated modules）
 │   ② 沿依赖链向上冒泡，找有没有祖先注册过 module.hot.accept
 │   ③ 找到了 → 跑过期模块的 dispose handler（清定时器 / 监听器）
 │              → 替换 __webpack_modules__ 里的工厂函数
 │              → 删掉 __webpack_module_cache__ 里的旧实例
 │              → 执行那个 accept 回调，模块被重新 require 一次
 │   ④ 一路冒泡到 entry 都没人 accept → 放弃，location.reload()
 └──────────────────────────────────────────────────────────
```

两个容易被追问的点：

- **为什么请求的是旧 hash 命名的文件**：客户端只知道自己当前跑的是哪个 hash，服务端编译时就以「上一次的 hash」给补丁命名，两边才对得上。所以连续快改两次、中间某个补丁没拉到，链就断了，只能整页刷新。
- **"增量"增量在哪**：省的是重新 parse / transform 未变模块的时间，依赖图是复用的。但受影响模块的 loader 链（babel 等）还是要重跑。

#### 为什么必须框架配合

webpack 只给了 `module.hot.accept` / `module.hot.dispose` 这套原语，**"替换之后怎么不丢状态"是框架的事**：

```js
if (module.hot) {
  module.hot.accept('./render', () => render(App))  // 手写的样子
}
```

- **CSS 最简单**：`style-loader` 的 HMR handler 直接换掉 `<style>` 标签的 `textContent`，没有状态概念，所以 CSS 热更新天然好用。
- **React**：`react-refresh`（Fast Refresh）靠 babel plugin 给每个组件注册一个 signature，替换时如果组件类型和 hooks 结构没变，就保留 Fiber 上的 state 只换渲染函数。
- **Vue**：`vue-loader` 给每个 SFC 生成 `__VUE_HMR_RUNTIME__.reload(id, comp)`，模板变化只重渲染、script 变化才重建组件。

#### 常见失效原因

- 改的模块及其祖先**没有任何人 accept** → 直接退化成整页刷新（表现就是"HMR 没生效"）。
- 组件导出成匿名箭头函数 / 一个文件里混着导出非组件的东西 → react-refresh 拿不到稳定 signature，放弃热替换。
- 模块**顶层写了副作用**（注册全局监听、`setInterval`）又没写 `dispose` 清理 → 每次热更新叠加一份，行为越来越诡异。
- 循环依赖会让冒泡查找的边界变得不可预期。

对比一句：**live reload 是 `location.reload()`，状态全丢；HMR 是换模块，状态保留** —— 这是二者唯一但关键的区别。

---

### 获取模块内容
```js
const fs = require('fs')
const getModuleInfo = (file)=>{
    const body = fs.readFileSync(file,'utf-8')
    console.log(body);
}
getModuleInfo("./src/index.js")
```

### 分析模块
安装`@babel/parser` 分析模块的主要任务是 将获取到的模块内容 解析成AST语法树
```js
// 获取主入口文件
const fs = require('fs')
const parser = require('@babel/parser')
const getModuleInfo = (file)=>{
    const body = fs.readFileSync(file,'utf-8')
    const ast = parser.parse(body,{
        sourceType:'module' //表示我们要解析的是ES模块
    });
    console.log(ast);
}
getModuleInfo("./src/index.js")
```
当前我们解析出来的不单单是index.js文件里的内容，它也包括了文件的其他信息。 而它的内容其实是它的属性program里的body里

### 收集依赖
安装`@babel/traverse`。遍历AST，将用到的依赖收集起来
```js
const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const getModuleInfo = (file)=>{
    const body = fs.readFileSync(file,'utf-8')
    const ast = parser.parse(body,{
        sourceType:'module' //表示我们要解析的是ES模块
    });
    
    // 新增代码
    const deps = {}
    traverse(ast,{
        ImportDeclaration({node}){
            const dirname = path.dirname(file)
            const abspath = './' + path.join(dirname,node.source.value)
            deps[node.source.value] = abspath
        }
    })
    console.log(deps);
}
getModuleInfo("./src/index.js")
```

### ES6转成ES5（AST）
把ES6的AST转化成ES5的AST`npm install @babel/core @babel/preset-env`
```js
const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')
const getModuleInfo = (file)=>{
    const body = fs.readFileSync(file,'utf-8')
    const ast = parser.parse(body,{
        sourceType:'module' //表示我们要解析的是ES模块
    });
    const deps = {}
    traverse(ast,{
        ImportDeclaration({node}){
            const dirname = path.dirname(file)
            const abspath = "./" + path.join(dirname,node.source.value)
            deps[node.source.value] = abspath
        }
    })
    
    // 新增代码
    const {code} = babel.transformFromAst(ast,null,{
        presets:["@babel/preset-env"]
    })
    console.log(code);

}
getModuleInfo("./src/index.js")
```
### 递归获取所有依赖
```js
const getModuleInfo = (file)=>{
    const body = fs.readFileSync(file,'utf-8')
    const ast = parser.parse(body,{
        sourceType:'module' //表示我们要解析的是ES模块
    });
    const deps = {}
    traverse(ast,{
        ImportDeclaration({node}){
            const dirname = path.dirname(file)
            const abspath = "./" + path.join(dirname,node.source.value)
            deps[node.source.value] = abspath
        }
    })
    const {code} = babel.transformFromAst(ast,null,{
        presets:["@babel/preset-env"]
    })
    // 新增代码
    const moduleInfo = {file,deps,code}
    return moduleInfo
}
```
