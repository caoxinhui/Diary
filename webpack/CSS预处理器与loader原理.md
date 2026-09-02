# CSS 预处理器与 loader 原理

> 代码摘录来自实际安装的 `sass-loader@12.1.0` / `less-loader@10.2.0`，新版本差异见文末「版本演进」。

### 谁把 Sass / Less 编译成 CSS

不是 Babel，也不是浏览器，而是各自专门的编译器：

| 语言 | 编译器 | 实现语言 |
| --- | --- | --- |
| Sass / SCSS | **Dart Sass**（官方主推，npm 包名 `sass`） | Dart，发布时用 dart2js 编译成 JS |
| | ~~LibSass / node-sass~~（已废弃） | C++，Node 通过 N-API 绑定 |
| | ~~Ruby Sass~~（2019 停止维护） | Ruby |
| Less | **less.js** | JavaScript，Node 和浏览器都能跑 |
| Stylus | stylus | JavaScript |

另有 Rust 实现的 `grass`（Sass 兼容）、`sass-embedded`（把 Dart VM 当常驻进程调用）。esbuild 不处理预处理器；Vite 内部直接调 `sass` / `less` 包；Rspack 仍走 `sass-loader`。

### 编译流程：和 Babel 同骨架，中间一步不同

三者的整体流程与 [Babel](babel原理.md) 完全一致：

```
源码 → 词法分析(Tokenizer) → 语法分析(Parser) → AST → 求值/转换 → 代码生成 → 产物
```

差别在中间那一步：

- **Babel**：AST → transform → generate，是**结构变换**。插件改写节点，`const` 变 `var`、箭头函数变 `function`，输出仍是同一层级的代码。
- **Sass / Less**：AST → **evaluate（求值）** → generate，更像一个**解释器**。因为预处理器的语言特性带有运行时语义：

| 特性 | 求值阶段要做的事 |
| --- | --- |
| 变量 `$color: red` | 建立作用域链，按词法作用域查找 |
| 嵌套 `.a { .b {} }` | **选择器拼接**，把树结构拍平成 CSS 的平坦规则列表 |
| mixin / `@include` | 本质是函数调用，参数绑定 + AST 内联展开 |
| `@if` / `@each` / `@for` | 真的要执行控制流，循环体展开 N 次 |
| `100px / 3` | 单位感知的数值计算 |

所以 Sass 编译器内部有 Environment（作用域）、Value 类型系统（SassNumber / SassColor / SassList…）、函数调用栈这些解释器的部件，Babel 没有。

### 一个最小的求值示例

看输入输出对比，最能理解「求值」这步在干什么：

```scss
$primary: #333;
@mixin flex($dir: row) {
  display: flex;
  flex-direction: $dir;
}
.card {
  @include flex(column);
  color: $primary;
  &__title { font-size: 16px; }
  .icon { color: lighten($primary, 20%); }
}
```

编译后：

```css
.card {
  display: flex;
  flex-direction: column;   /* mixin 内联 + 参数绑定 */
  color: #333;              /* 变量求值 */
}
.card__title {              /* & 父选择器字符串替换 */
  font-size: 16px;
}
.card .icon {               /* 嵌套 → 后代选择器拼接 */
  color: #666;              /* 内置函数在编译期执行 */
}
```

`lighten()` 是**编译期**算完的，产物里只剩结果值。这是预处理器变量和 CSS 原生 `var()` 的本质区别：后者在浏览器运行时求值，能被 JS 动态改；前者不能。

### PostCSS 不是预处理器

容易混的一个概念。PostCSS 不定义新语法，输入输出都是（近似）合法的 CSS，靠插件在 CSS AST 上做变换。所以 autoprefixer、cssnano 这类工作必须排在 Sass 编译**之后**。Tailwind 也是 PostCSS 插件（v4 起换成了自己的 Lightning CSS 路线）。

---

### 在 webpack 里的位置

```js
{
  test: /\.scss$/,
  use: [
    'style-loader',   // 4. 运行时 <style> 插入 DOM
    'css-loader',     // 3. 解析 @import / url()，转成 JS 模块
    'postcss-loader', // 2. 后处理：autoprefixer、压缩
    'sass-loader',    // 1. 调用 sass 包，SCSS → CSS
  ],
}
```

loader 从右到左执行（见 [webpack原理.md 的 loader 和 plugin 分工](webpack原理.md#L55)）。`sass-loader` 必须排在最右，因为 `css-loader` 只认合法 CSS。

### sass-loader / less-loader 的本质

两个 loader 都**不做任何解析和编译**。它们干的是四件事：

1. 校验、组装编译器的 options
2. **把 webpack 的模块解析能力（enhanced-resolve）桥接进编译器的 import 钩子** ← 唯一的技术核心
3. 把编译过程中读到的所有文件登记为 webpack 依赖，让 watch 生效
4. 把产物 CSS 和 sourcemap 交给下一个 loader

真正的编译在 `sass` / `less` 这两个 npm 包里。所以「sass-loader 原理」= 「如何把两套互不相识的解析系统缝在一起」。

### sass-loader 主流程

`sass-loader/dist/index.js` 全文只有 77 行：

```js
async function loader(content) {
  const options = this.getOptions(schema);        // schema-utils 校验
  const callback = this.async();                  // 声明异步 loader
  const implementation = getSassImplementation(this, options.implementation);
  //  ↑ 决定用 dart-sass 还是 node-sass，靠读 implementation.info 字符串判断

  const sassOptions = await getSassOptions(this, options, content, implementation, useSourceMap);

  if (shouldUseWebpackImporter) {
    sassOptions.importer.push(getWebpackImporter(this, implementation, includePaths));
  }                                               // ← 注入 webpack importer

  const render = getRenderFunctionFromSassImplementation(implementation);
  render(sassOptions, (error, result) => {
    let map = result.map ? JSON.parse(result.map) : null;
    if (map && useSourceMap) map = normalizeSourceMap(map, this.rootContext);

    result.stats.includedFiles.forEach(f => this.addDependency(path.normalize(f)));
    callback(null, result.css.toString(), map);   // 产物交给 css-loader
  });
}
```

`getSassOptions` 里几个值得注意的处理：

```js
options.file = loaderContext.resourcePath;
options.data = additionalData ? `${additionalData}\n${content}` : content;  // 变量注入
if (!options.outputStyle && isProductionLikeMode(loaderContext))
  options.outputStyle = "compressed";            // 生产环境默认压缩（坑，见文末）
if (ext === ".sass" && options.indentedSyntax === undefined)
  options.indentedSyntax = true;                 // 按扩展名自动切缩进语法
options.includePaths = [process.cwd(), ...userPaths, ...SASS_PATH.split(":")];
```

### sass-loader 的解析桥接：importer 回调

Sass 的 legacy API 提供 `importer(url, prev, done)` 钩子，sass-loader 的实现：

```js
function getWebpackImporter(loaderContext, implementation, includePaths) {
  const resolve = getWebpackResolver(loaderContext.getResolve, implementation, includePaths);
  return function importer(originalUrl, prev, done) {
    const { fromImport } = this;                  // 区分 @import 还是 @use
    resolve(prev, originalUrl, fromImport)
      .then(result => {
        loaderContext.addDependency(path.normalize(result));
        done({ file: result.replace(MATCH_CSS, "") });
        //                        ↑ 故意去掉 .css 后缀
      })
      .catch(() => done({ file: originalUrl }));  // 解析失败就还给 sass 自己处理
  };
}
```

那个 `.replace(MATCH_CSS, "")` 是有意为之的 hack，源码注释写着「By removing the CSS file extension, we trigger node-sass to include the CSS file instead of just linking it」。因为 Sass 规范规定以 `.css` 结尾的 `@import` 要**原样输出成 CSS `@import`**，而 webpack 场景下我们希望它被内联进来，所以骗编译器把它当 Sass 文件读。

#### 四个 resolver

`getWebpackResolver` 里创建了**四个**不同配置的 resolver，沿两个维度切分：

- **module vs import**：`@use` 走 module（`mainFiles: ["_index", "index"]`），`@import` 走 import（`mainFiles: ["_index.import", "_index", "index.import", "index"]`）。`.import.scss` 是 Sass 的兼容机制，让一个包能给 `@import` 和 `@use` 提供不同入口。
- **sass 语义 vs webpack 语义**：前者关掉了 `alias / mainFields / exportsFields / modules`，纯粹模拟 Sass 自己的 load path 查找；后者才带上 webpack 的完整能力：

```js
{
  dependencyType: "sass",
  conditionNames: ["sass", "style"],              // package.json exports 条件
  mainFields: ["sass", "style", "main", "..."],
  extensions: [".sass", ".scss", ".css"],
  restrictions: [/\.((sa|sc|c)ss)$/i],            // 禁止解析到 .js
  preferRelative: true                            // "foo" 先当 ./foo 试
}
```

#### 为什么要分这两套

因为 Sass 的导入优先级是固定的：

```
1. 相对于当前文件      2. 自定义 importer      3. cwd
4. includePaths        5. SASS_PATH
```

自定义 importer 排在第 2 位，会**抢在** 3/4/5 前面执行。如果 importer 里直接用 webpack 语义解析，`includePaths` 的优先级就被破坏了。所以 sass-loader 在 `includePaths` 非空时，手工把 3/4/5 的查找顺序在 importer 内部重放一遍。node-sass 更极端，它连第 1 步都排在 importer 之后，所以代码里还有 `if (!isDartSass)` 的额外补偿分支。

这段是整个 loader 里最绕的地方，也是历史 issue 最集中的地方。

#### 候选路径生成

`getPossibleRequests` 负责展开 Sass 的 partial 约定：

| 输入 | 生成的候选（按序尝试） |
| --- | --- |
| `./theme` | `_theme` → `theme` |
| `theme`（`@import`） | `_theme.import` → `theme.import` → `_theme` → `theme` |
| `~bootstrap/scss/mixins` | 去掉 `~` → `bootstrap/scss/_mixins` → `bootstrap/scss/mixins` |
| `~bootstrap` | 补成 `bootstrap/`，让 `mainFields` 生效 |
| `foo.css` | **返回空数组**，直接放弃，交给 Sass 输出原生 `@import` |

`startResolving` 是个递归的「串行降级」：拿第一个候选试，`catch` 掉错误后砍掉队首继续，候选耗尽就换下一个 resolver，全部失败才 reject。

---

### less-loader 主流程

结构类似但更短：

```js
async function lessLoader(source) {
  const lessOptions = getLessOptions(this, options, implementation);
  if (useSourceMap) lessOptions.sourceMap = { outputSourceFiles: true };

  let data = source;
  if (options.additionalData) data = `${options.additionalData}\n${data}`;

  implementation.logger.addListener(loggerListener);   // 把 less 日志接到 webpack logger
  try {
    result = await implementation.render(data, lessOptions);
  } finally {
    implementation.logger.removeListener(loggerListener);
    delete lessOptions.pluginManager.webpackLoaderContext;
    delete lessOptions.pluginManager;                   // 注释写明：Fix memory leaks in `less`
  }

  result.imports.forEach(item => {
    if (isUnsupportedUrl(item)) return;                 // 过滤 data-uri / http
    if (path.isAbsolute(path.normalize(item))) this.addDependency(path.normalize(item));
  });
  callback(null, css, normalizeSourceMap(map, this.rootContext));
}
```

`lessOptions.filename = loaderContext.resourcePath` 必须设置，否则 FileManager 拿到入口文件的路径是 `undefined`——因为内容是通过字符串传进 `render()` 的，Less 不知道它从哪来。sass-loader 对应的是 `options.file`。

### less-loader 的解析桥接：FileManager 插件

Less 没有 importer 回调，它有**插件系统 + FileManager 抽象**。所以 less-loader 走的是继承 + 注册：

```js
class WebpackFileManager extends implementation.FileManager {
  supports(filename) {
    if (filename[0] === "/" || IS_NATIVE_WIN32_PATH.test(filename)) return true;
    if (this.isPathAbsolute(filename)) return false;    // 绝对路径交还给 less 默认实现
    return true;
  }

  supportsSync() { return false; }   // webpack 解析是异步的，data-uri() 等同步场景降级

  async loadFile(filename, ...args) {
    try {
      result = await super.loadFile(filename, ...args); // ① 先让 less 自己找
    } catch (error) {
      if (error.type !== "File" && error.type !== "Next") throw error;
      result = await this.resolveFilename(filename, ...args); // ② 失败才用 webpack 找
      loaderContext.addDependency(result);
      return super.loadFile(result, ...args);
    }
    loaderContext.addDependency(path.normalize(result.filename));
    return result;
  }
}

return {
  install(lessInstance, pluginManager) {
    pluginManager.addFileManager(new WebpackFileManager());
  },
  minVersion: [3, 0, 0],
};
```

注意这里的**优先级和 sass-loader 相反**：

- less-loader：Less 原生解析优先，失败才兜底给 webpack
- sass-loader：webpack 解析优先，失败才兜底给 Sass

这直接导致一个可观察的行为差异——Less 里同名文件的相对路径解析永远赢过 alias，Sass 里则不一定。

resolver 配置也只有一个，比 sass-loader 简单：

```js
loaderContext.getResolve({
  dependencyType: "less",
  conditionNames: ["less", "style"],
  mainFields: ["less", "style", "main", "..."],
  mainFiles: ["index", "..."],        // 没有 partial 概念，不需要 _ 前缀
  extensions: [".less", ".css"],
  preferRelative: true,
})
```

---

### sourcemap 归一化

两者共用同一套思路：

```js
function normalizeSourceMap(map, rootContext) {
  delete newMap.file;        // 此刻还不知道最终产物文件名，留着会误导后续 loader
  newMap.sourceRoot = "";
  newMap.sources = newMap.sources.map(source =>
    getURLType(source) === "path-relative"
      ? path.resolve(rootContext, path.normalize(source))   // 转绝对原生路径
      : source);                                            // file:// 等原样保留
  return newMap;
}
```

必须做这一步：编译器返回的是 POSIX 相对路径或 `file://` URL，而 webpack 的 sourcemap 链要求原生绝对路径，否则 Windows 上 source-map 模块解析不了、devtool 里点不开原文件。

配套的三个 option：

- `sourceMapContents: true` / `outputSourceFiles: true` —— 把源码内容嵌进 map
- `omitSourceMapUrl: true` —— 不要在 CSS 末尾追加 `/*# sourceMappingURL */`，那是 webpack 的活
- `outFile` —— 随便指一个路径，只为让 `sources` 里的相对路径有基准（node-sass 用 `data` 时不给基准就不产出 map）

### 依赖收集与 watch

这是 loader 必须做、编译器不会做的事。两者的依赖来源不同：

| | 来源 | 说明 |
| --- | --- | --- |
| sass-loader | `result.stats.includedFiles` | 编译成功后一次性拿到全量列表 |
| less-loader | `result.imports` | 同上，需过滤 data-uri / http |
| 两者 | importer / FileManager 内部 `addDependency` | 兜底，编译**失败**时 stats 拿不到，靠这里保证 watch 仍能触发 |

出错分支里也要 `addDependency(error.file)`——不然改了那个报错文件，webpack 不会重新编译，你会以为改动没生效。

---

### 两者对照

| | sass-loader | less-loader |
| --- | --- | --- |
| 编译器入口 | `sass.render()` / 新版 `compileStringAsync()` | `less.render()` |
| 扩展点 | `importer` 回调函数 | 插件 + `FileManager` 子类 |
| 解析优先级 | webpack 优先，兜底给 sass | less 优先，兜底给 webpack |
| resolver 数量 | 4 个（module/import × sass/webpack 语义） | 1 个 |
| 候选路径 | 要展开 `_partial`、`.import.scss` | 只处理 `~` 前缀 |
| 依赖来源 | `result.stats.includedFiles` | `result.imports` |
| 内容注入 | `sassOptions.data` | `render()` 第一个参数 |
| 同步解析 | 不支持 | `supportsSync()` 返回 false 显式降级 |

### 几个实践上的坑

**`outputStyle: 'compressed'` 默认开启。** sass-loader 在 `mode` 为 production **或未设置**时自动压缩。如果后面还挂了 cssnano，等于压两次，白烧时间；更麻烦的是压缩后的 CSS 会让 sourcemap 精度变差。显式写 `sassOptions: { outputStyle: 'expanded' }` 关掉它。

**`additionalData` 注入的变量会让每个文件重新编译一遍。** 每个 `.scss` 入口都是独立的编译单元，共享的 variables 文件被 N 个组件各解析 N 次。组件级 CSS 文件多的项目，这是构建耗时的主要来源，不是 loader 本身慢。

**`~` 前缀已废弃。** webpack 5 的 resolver 加上 `preferRelative: true` 后，`@import "bootstrap/scss/mixins"` 能直接解析到 node_modules。代码里保留 `MODULE_REQUEST_REGEX` 只是向后兼容。

**别在 `sassOptions.paths` / `lessOptions.paths` 里塞路径。** less-loader 检测到用户手动配了 `paths`，会认为你选择了 Less 原生解析；Sass 侧配了 `includePaths` 则会触发上面那段优先级重放逻辑。能用 webpack `resolve.alias` 解决的就别用它们。

### 版本演进

本文摘录的 sass-loader 12.x 只有 legacy API。新版本变化：

- **13+** 支持 `api: 'modern'`：改用 `compileStringAsync()`，importer 从单个回调变成 `{ canonicalize, load }` 两阶段接口，配 `importers` 数组。
- **14+** 支持 `api: 'modern-compiler'`：用 `initAsyncCompiler()` 持有一个常驻编译器实例，按 webpack compiler 缓存，避免每个文件都重启一次 Dart VM。配合 `sass-embedded` 包，大项目提速明显。
- 12.x 里 `getRenderFunctionFromSassImplementation` 那个 `neoAsync.queue(..., UV_THREADPOOL_SIZE - 1)` 是 node-sass 时代的历史包袱：node-sass 用异步 importer 会死锁，必须留一个线程给 libuv。dart-sass 走的是 `implementation.render.bind()` 直连。

### 面试怎么答

切入角度选**「loader 的职责边界」**，比逐行讲 API 更能拿分：

sass-loader 主流程只有 77 行，剩下 500 行全在处理「两套解析算法的优先级怎么对齐」。这恰好说明 loader 的价值不在转换代码，而在**把外部工具接入 webpack 的依赖图和 watch 机制**。

同一个结论可以横向套到 [babel-loader](babel原理.md#L17)：它同样只是把字符串交给 `@babel/core`，自己不 parse。两个 loader 的共同点是「适配 + 依赖登记」，差异只在被适配的编译器暴露了什么扩展点（Babel 无需解析桥接，因为 webpack 自己会再 parse 一遍找依赖；Sass / Less 的 `@import` webpack 看不懂，所以必须桥接）。

顺带能接住的追问：

- loader 和 plugin 的区别 → [webpack原理.md](webpack原理.md#L55)
- 为什么 loader 从右到左 → 本质是 `a(b(c(source)))`
- 预处理器变量和 CSS 变量的区别 → 编译期求值 vs 运行时求值

