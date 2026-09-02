# react-imvc vs Next.js

两者都在解决「首屏由服务端出 HTML，之后由浏览器接管成单页应用」。但它们对**同构**这个词的理解完全不同，这一点决定了后面所有的流程差异：

> - **imvc 的同构 = 同一份逻辑在两端各跑一遍。**
> - **Next.js 的同构 = 把代码切成「只在服务端跑」和「两端都跑」两部分，编译期就分开。**

imvc 是「运行时用 `context.isServer` 分叉」，Next.js 是「构建期用模块边界分叉」。记住这一句，后面每一条差异都是它的推论。

版本基准：react-imvc 3.5.5（webpack 4、`ReactDOM.hydrate`）对 Next.js 16.x（React 19、Turbopack、App Router 为主）。

---

## 一、代码在哪一端跑（最本质的差异）

```
【imvc】整个页面的逻辑跑两遍
  Node      : new Controller → getInitialState() → View 渲染 ─┐
  Browser   : new Controller → （hydrate 时跳过）  → View hydrate ─┘
              ↑ Controller.js / Model.js / View.js 全部同时存在于客户端 bundle

【Next.js Pages Router】取数只跑服务端，渲染跑两遍
  Node      : getServerSideProps() ──props──▶ <Page/> 渲染
  Browser   :                                <Page/> hydrate
              ↑ getServerSideProps 及其 import 被编译期剥离，不进客户端 bundle

【Next.js App Router / RSC】服务端组件只跑服务端，客户端组件跑两遍
  Node      : <Page/> async Server Component（可直连 DB）
                        │ 产出 Flight（RSC payload，是"已渲染好的 UI 描述"）
                        ▼
                      <Client/> 预渲染成 HTML
  Browser   :           <Client/> hydrate
              ↑ Server Component 及其依赖永不进客户端 bundle；'use client' 是切点
```

三个推论，面试常问：

- **imvc 的 `getInitialState` 会在浏览器里执行**（单页跳转时），所以里面不能碰 `window`，也不能放数据库连接、密钥。Next.js 的 `getServerSideProps` / Server Component **物理上不可能**在浏览器执行，可以放任何服务端资源。
- **包体积**：imvc 的取数逻辑、SQL 拼装、服务端才用的库，只要写在 Controller 里就会被打进客户端。Next.js 的 RSC 天然做到「依赖不下发」（如 markdown 解析器、ORM）。
- **数据 vs UI**：imvc 和 Pages Router 传的是**数据**（`state` / `props`，客户端再渲染），App Router 传的是**渲染结果**（Flight 里已经是元素树）。

---

## 二、首屏一个请求的完整链路

```
        【imvc】                                【Next.js App Router】
GET /detail/123                          GET /detail/123
   │                                        │
   ▼ express 中间件                          ▼ Next server（自带，不暴露 express）
router.all('*')                          编译期生成的路由表 → 命中 app/detail/[id]/page.tsx
   │  组装 context{req,res,restapi,...}      │  匹配是「按段」的：layout → template → page
   ▼                                        ▼
matcher(url) 线性扫路由表                   渲染 Server Component 树
   │  第一个命中即返回                        │  await fetch / await db（每个组件自己取数）
   ▼                                        │  遇到 <Suspense> 边界 → 先吐 fallback，不阻塞
loader() → 拿到 Controller 构造函数          ▼
   ▼                                     renderToReadableStream（真流式）
new Ctrl(location, context)                 │  HTML 分段下发 + Flight 内联在
   ▼                                        │  <script>self.__next_f.push(...)</script>
await controller.init()                     │
   │  getInitialState() 取数（整页一次）      ▼
   │  fetchPreload() 拉 CSS                浏览器边收边显示；数据好了再补吐后半段
   ▼                                        │
renderToNodeStream / renderToString         ▼
   │  ⚠️ 流被 on('data') 收集成完整 Buffer   React 用 Flight 补齐 Suspense 洞
   │     再塞进 LayoutView → 并非真流式
   ▼
renderToStaticMarkup(<LayoutView content initialState/>)
   │  注入 window.__INITIAL_STATE__ / __APP_SETTINGS__ / __PUBLIC_PATH__
   ▼
res.end('<!DOCTYPE html>' + html)
```

两条链路的关键区别：

| | imvc | Next.js |
| --- | --- | --- |
| 取数粒度 | **整页一次**，`getInitialState` 里串/并行自己写 | **每个组件自己取**，框架去重 + 缓存 |
| 阻塞模型 | 全部数据 `await` 完才开始渲染，全或全无 | Suspense 边界之外的先出，慢的部分后补 |
| 流式 | 名义上有（`renderMode`），实际被收集成整块，**TTFB 不会变快** | 真流式，TTFB ≈ 静态外壳的时间 |
| 服务端形态 | 你自己的 express，中间件、自定义接口都写在 `config.routes` | Next 自己的 server，要加中间件只能用 `middleware.ts` 或前面套一层网关 |
| 降级 | `SSR = false` → 整页退化成 CSR | 按段选择：静态 / 动态 / 客户端组件 / PPR |

---

## 三、服务端状态怎么过桥到客户端

```
【imvc】
  server: controller.store.getState()
            │ JSON.stringify
            ▼
  HTML  : <script>window.__INITIAL_STATE__ = {...}</script>
            │
  client: initialize() 读到它 →  ① 跳过 getInitialState()
                                ② 触发 stateDidReuse()
                                ③ viewEngine 走 ReactDOM.hydrate
          CSS 也过桥：<style data-preload="main"> 被读回 context.preload，避免重复 fetch

【Next.js Pages Router】
  server: getServerSideProps() 的返回值
            ▼
  HTML  : <script id="__NEXT_DATA__" type="application/json">
            { props, page, query, buildId, ... }
          </script>
            ▼
  client: next/client 读 __NEXT_DATA__ → hydrateRoot(<App pageProps={...}/>)

【Next.js App Router】
  server: Server Component 的渲染结果本身
            ▼
  HTML  : 多个 <script>self.__next_f.push([1,"..."])</script>  ← 随 HTML 流分批注入
            ▼
  client: React 把 Flight 反序列化成元素树，与 HTML 对齐后 hydrate
          注意：这里过桥的不是"数据"，是"UI"。Server Component 的原始数据
          如果没被当作 props 传给 Client Component，就根本不会出现在浏览器里
```

- imvc 的桥是**一个全局对象 + 一个全局 store**：整页共享，任何组件都能读到全量 state，代价是所有首屏数据必须可 JSON 序列化，且全部暴露给浏览器。
- App Router 的桥是**按组件的**：只有跨过 `'use client'` 边界的 props 才需要序列化（且不能传函数、Date 之外的复杂实例）。敏感字段留在服务端天然安全。
- imvc 特意把 `location.key` 搬到 `meta.key`，就是因为它每次都变会让 `__INITIAL_STATE__` 的字节不稳定，破坏 Etag / 304 —— Next.js 里 `buildId` 是稳定的，没有这个问题。

---

## 四、单页跳转：行为差异最大的一块

### imvc：浏览器自己重跑一遍页面逻辑

```
点 <Link> / history.push('/detail/123')
   │
   ▼ destroyController()  上一个页面：KeepAlive=false → destroy；true → 留在缓存池
   ▼ getControllerFromCache(location.raw)      key = pathname + search（不含 hash）
   │
   ├── 命中 ──▶ controller.restore()
   │             dispatch __PAGE_DID_BACK__ → pageDidBack() → 重新 bindStoreWithView()
   │             DOM 没动过，display 从 none 改回来，window.scroll 到 scrollMap 记录位置
   │
   └── 未命中 ─▶ loader 拉 chunk → new Ctrl → init()
                   └─ getInitialState() **在浏览器里跑**
                        └─ this.fetch('/api/...') 浏览器直连 API
   ▼
ViewManager 增加一个 <ViewItem>，旧的 style.display = 'none'（DOM 全部留着）
   ▼
ReactDOM.render（只有首屏那次是 hydrate）

数据路径： 浏览器 ──▶ API 服务          （1 跳，Node 完全不参与）
```

### Next.js Pages Router：回服务端要 props

```
点 <Link>（视口内时已自动 prefetch chunk）
   │
   ├─ 拉 route 的 JS chunk
   └─ 拉 /_next/data/<buildId>/detail/123.json
        │  getServerSideProps 在 Node 上执行；getStaticProps 页面则是构建期产物，命中 CDN
   ▼
router 用新 props 换掉页面组件 → 旧页面组件 unmount（state、DOM、滚动全丢）
   ▼
_app 之下重新渲染

数据路径： 浏览器 ──▶ Next 服务 ──▶ API 服务   （2 跳，SSR 页每次跳转都打 Node）
```

### Next.js App Router：回服务端要「渲染好的子树」

```
点 <Link>（默认 prefetch：静态段 / App Shell 提前拉好）
   │
   ▼ GET /detail/123?_rsc=xxxx   （带 RSC: 1 头）
   │    Node 只重新渲染**发生变化的路由段**；共享 layout 不重渲染
   │    响应是 Flight 流，不是 JSON 数据
   ▼
客户端把新 Flight 合并进现有 React 树（不是替换整棵树）
   │  未变化层级里的 Client Component state 被保留
   │  Router Cache 缓存这份 payload，前进后退可直接复用
   ▼
React 局部 re-render

数据路径： 浏览器 ──▶ Next 服务 ──▶（组件内 fetch / DB，带请求去重与缓存）
```

三句话总结这段差异：

- **谁承担取数**：imvc 跳转后取数在浏览器，Next.js 永远在服务端。所以 imvc 的 API 必须对公网可见、必须处理跨域和鉴权；Next.js 可以把内网地址、密钥全留在 Node 侧。反过来，imvc 少一跳，Next.js 的 SSR 页面在弱网下跳转会更慢，且 Node 是每次跳转的必经路径（容量成本）。
- **旧页面怎么处理**：imvc 保留 DOM（`display:none`），Next.js 卸载/替换。这是 imvc 能白送「返回如初」的原因，也是它内存占用高、易泄漏的原因。
- **传输的是什么**：数据（imvc / Pages）vs UI 描述（App Router）。后者意味着渲染逻辑的改动不需要客户端跟着更新，也意味着一次跳转的响应体通常比纯 JSON 大。

---

## 五、路由系统

```
【imvc】显式路由表 + path-to-regexp v1 + 线性扫描
  src/index.ts
  export default [
    { path: '/user/:id',  controller: () => import('./user/Controller') },  ← thunk 才是分割点
    { path: '/user/new',  controller: () => import('./new/Controller') },   ← 永远匹配不到！
  ]
  匹配：for 循环，第一个命中即 return  →  顺序 = 优先级，写错就被前面吃掉
  结构：扁平。没有嵌套路由、没有共享 layout（layout 是 express 视图，整站一份）

【Next.js】文件系统路由，编译期生成清单
  app/
    layout.tsx              ← 根 layout，跳转时不重渲染
    user/
      layout.tsx            ← 段级 layout，可嵌套任意层
      new/page.tsx          ← 静态段
      [id]/page.tsx         ← 动态段
      [...rest]/page.tsx    ← catch-all
      loading.tsx / error.tsx / not-found.tsx   ← 约定式 Suspense / ErrorBoundary
  匹配：静态段 > 动态段 > catch-all，与文件书写顺序无关
  结构：嵌套。另有 @parallel 并行路由、(.)intercepting 拦截路由、(group) 分组
```

| | imvc | Next.js |
| --- | --- | --- |
| 路由声明 | 手写数组，可拆文件后 `getFlatList` 拍平 | 文件系统，零声明 |
| 优先级 | **书写顺序**，`/user/:id` 在前会吃掉 `/user/new` | 特异性排序，与顺序无关 |
| 嵌套 layout | 没有 | 核心特性，且跳转时保持挂载 |
| 代码分割 | 只有 `controller: () => import()` 这种写法才分割 | 每个 route 自动分割 |
| 页面身份 | `location.raw = pathname + search`，**query 不同算两个页面，hash 不同算同一个** | URL（含 searchParams）由框架整体处理 |
| 404 | matcher 未命中 → `ReqError(404)` → express 错误中间件 | `not-found.tsx` / `notFound()` |

---

## 六、页面保活与滚动恢复

imvc 把「返回列表页如初」当成框架级能力，Next.js 至今没有对应物。

| | imvc | Next.js Pages | Next.js App |
| --- | --- | --- | --- |
| 旧页面 DOM | **保留**，`display:none` | 卸载 | 卸载（未变化的 layout 保持挂载） |
| 组件 state | 随 DOM 一起保住 | 丢失 | 变化段内丢失；未变段保留 |
| controller / 数据 | 缓存池，**默认只存 10 个**，LRU 淘汰 | 无 | Router Cache 缓存 **RSC payload**（不是组件 state） |
| 滚动位置 | `ViewManager.scrollMap` 手动记录/恢复 | 框架内置 scroll restoration | 同 |
| 开关 | `KeepAlive` 永久保活；`KeepAliveOnPush` 只在 `PUSH` 保活、`POP`/`REPLACE` 销毁 | — | `staleTimes` 配 payload 复用时长 |

差别的本质：**imvc 缓存的是「活的页面实例」，Next.js 缓存的是「服务端响应」。** 前者返回时零请求、零重渲染，代价是内存和跨页副作用（多个页面的定时器/监听同时活着）；后者返回时要重新执行组件，但内存干净、行为可预测。

在 Next.js 里想要 imvc 那种效果，只能自己把状态提到 URL、`sessionStorage` 或提到共享 layout 里的 store。

---

## 七、渲染模式矩阵

imvc 只有一个开关（`SSR: true | false`），Next.js 是一个连续谱。

| 模式 | imvc | Next.js |
| --- | --- | --- |
| CSR | ✅ `SSR: false`（整页降级，不注入 `__INITIAL_STATE__`） | ✅ `'use client'` / `dynamic(..., { ssr: false })` |
| 每请求 SSR | ✅ 唯一主路径 | ✅ 读了 `cookies()` / `headers()` / 动态 API 即转为动态 |
| SSG 预渲染 | ❌ | ✅ 默认行为（无动态依赖即静态） |
| ISR 增量再生 | ❌ | ✅ `revalidate` / `revalidateTag` |
| 流式 SSR | ⚠️ 名义上有，实际被收集成整块 | ✅ Suspense 边界即分块点 |
| 局部预渲染 PPR | ❌ | ✅ Next 16 `cacheComponents` + `use cache`：静态外壳走 CDN，动态洞流式补 |
| 多 runtime | ❌ 只有 Node | ✅ Node / Edge |
| 数据缓存 | ❌ 自己实现 | ✅ 请求去重 + Data Cache + Full Route Cache + Router Cache 四层 |

一句话：**imvc 的「性能」只能靠业务自己做（页面级降级、`prefetch` 预拉 chunk、CSS 内联）；Next.js 把缓存和分块做成了框架能力。** 这也是 imvc 项目常见的困境 —— 千人千面业务下页面级缓存失效，而框架不提供片段级缓存，只能退回数据层缓存。

---

## 八、状态管理与副作用

```
【imvc】框架自带一整套
  Model  = { initialState, ...actions }      relite：action 本身就是 reducer
           actions 是纯同步函数 (state, payload) => newState
  异步   → 全写在 Controller 方法里：await this.fetch() → this.store.actions.UPDATE_STATE()
           不需要 thunk / saga，Controller 就是那一层
  副作用 → 集中在 bindStoreWithView()：store.subscribe、history.listenBefore、
           listenBeforeUnload，反注册函数统一 push 进 meta.unsubscribeList，destroy 时清空
  生命周期 → 13 个钩子（getInitialState / shouldComponentCreate / pageWillLeave / pageDidBack ...）

【Next.js】框架什么都不给，交给 React
  服务端状态 → Server Component 直接 await，"状态"就是函数返回值，不需要 store
  客户端状态 → useState / useReducer / Context，或 zustand / jotai 等外部库
  写操作     → Server Action（'use server'）：表单/事件直接调服务端函数，
               返回后 revalidate 并推一份新 Flight，无需手写 API 路由
  副作用     → useEffect，卸载函数由 React 负责，没有框架级的统一注册表
```

| | imvc | Next.js |
| --- | --- | --- |
| 状态容器 | 内置 relite，整页一个 store | 无内置；服务端不需要，客户端自选 |
| 异步归属 | Controller 方法 | Server Component / Server Action / `useEffect` |
| 生命周期心智 | 类 + 13 个钩子，需要背 | 函数组件 + `async/await` + Suspense |
| 「离开页面前」 | `pageWillLeave`（依赖 history v3 的 `listenBefore`） | 无对应能力，只能用 `beforeunload` 或自己拦 |
| 数据依赖 | `create-history`（history v3 的 fork），**不能换成官方 v4/v5**，否则 `listenBefore` 和 `location.raw` 全没 | React 19 官方能力 |

---

## 九、错误边界

```
【imvc】劫持 React.createElement（很激进）
  Controller 定义了 errorDidCatch / getComponentFallback
        ▼
  init() 里把全局 React.createElement 换掉
        ▼
  每个函数/类组件在创建时自动套一层 ErrorBoundary
        ▼
  三种错误来源统一进 errorDidCatch(err, type)
     'controller' init/钩子里抛的  |  'model' action 里抛的  |  'view' 渲染时抛的
        ▼
  ⚠️ 全局副作用：服务端是长驻进程，必须在 finally / stream end 里还原，
     否则污染下一个请求 —— imvc 服务端最容易出诡异 bug 的地方

【Next.js】约定式文件，按路由段挂
  app/detail/[id]/
    error.tsx        ← 这一段的 ErrorBoundary（客户端组件，收到 reset()）
    not-found.tsx    ← notFound() 的落点
    loading.tsx      ← 这一段的 Suspense fallback
  global-error.tsx   ← 根 layout 也炸了时的兜底
  没有任何全局改写，边界位置 = 目录位置，粒度天然与路由对齐
```

---

## 十、构建与产物

| | imvc | Next.js |
| --- | --- | --- |
| 打包器 | **webpack 锁在 4.44.2** | Next 16 起 Turbopack 为 dev/build 默认，webpack 仍可用 |
| 配置 | 一份 `createWebpackConfig(options, isServer)`，靠 `isServer` 分叉 | 零配置，`next.config.js` 逃生舱 |
| 服务端产物 | 单个 `publish/server.bundle.js`（`commonjs2` + `nodeExternals`） | 按 route 的产物，含 server/client 两张模块图 |
| 模块图 | 一张（同一套源码打两次） | **两张**：`'use client'` 是切点，RSC 图与 client 图分别打 |
| 资源 hash | `webpack-manifest-plugin` → `assets.json`，Layout 里读 `props.assets.index` | 框架内部处理，业务无感 |
| CSS | 视为预加载的 ajax 数据，服务端拉成 `<style data-preload>` 内联，客户端读回避免重复请求（还要清 `\r`，否则 hydrate checksum 不一致） | CSS Modules / Tailwind / `next/font` 内置，按 route 自动内联临界 CSS |
| React 版本 | `peerDependencies` 写了 17/18/19，实际调 `ReactDOM.hydrate`（React 17 API），**吃不到并发特性** | React 19，`hydrateRoot` + 选择性 hydration |
| 逃生舱 | `webpackLoaders` / `webpackPlugins` / `webpack(result, isServer)` | `next.config.js` 的 `webpack()` / `turbopack` |

`ViewManager` 至今还在用 `UNSAFE_componentWillReceiveProps` —— 这不是风格问题，它意味着 imvc 项目无法开启 React 18+ 的并发渲染、`<Suspense>` 流式、`useTransition` 这一整条线。**imvc 的天花板卡在 React 17。**

---

## 十一、总对照表

| 维度 | react-imvc | Next.js |
| --- | --- | --- |
| 同构模型 | 运行时 `context.isServer` 分叉，同一份逻辑两端各跑 | 编译期模块边界分叉，服务端代码不下发 |
| 组织单位 | Controller 类（一个页面一个类，收全部逻辑） | 文件约定 + 函数组件 |
| 路由 | 显式数组 + 线性匹配，扁平 | 文件系统 + 特异性排序，可嵌套 |
| 首屏取数 | `getInitialState` 整页一次 | 组件各自 `await`，框架去重 |
| 跳转取数 | **浏览器直连 API** | **回 Node**（JSON 或 Flight） |
| 状态过桥 | `window.__INITIAL_STATE__` 全量 store | `__NEXT_DATA__`（Pages）/ Flight 流（App） |
| 页面保活 | ✅ 框架级（KeepAlive + DOM 常驻） | ❌ 只有响应缓存 |
| 流式 / SSG / ISR / PPR | ❌ | ✅ |
| 状态管理 | 内置 relite | 不提供 |
| 错误边界 | 全局劫持 `createElement` | 约定式 `error.tsx` |
| 服务端可控性 | ✅ 就是你的 express，中间件随便加 | ⚠️ 框架托管，只有 `middleware.ts` |
| 部署 | 任意 Node 环境 | 任意 Node，但 ISR/PPR/Image 等在 Vercel 外需自己搭 |
| 生态与维护 | 内部框架，社区文章少，React 17 天花板 | 社区最大，跟随 React 主线 |

---

## 十二、什么时候哪个更合适

imvc 真正强的地方只有两条，但在特定业务里很值钱：

- **移动端「列表 → 详情 → 返回」体验**：KeepAlive 让返回时滚动位置、筛选条件、已加载的分页数据全在，且零请求。用 Next.js 要自己造。
- **服务端完全可控**：它就是一个 express 应用，鉴权中间件、自定义接口、灰度、内网直连，都写在自己手里。Next.js 的 server 是框架托管的，复杂网关逻辑得往外挪。

Next.js 更合适的场景：

- 需要 SEO + 静态化（营销页、文档、内容站）—— imvc 连 SSG 都没有。
- 首屏由多个独立慢接口拼成 —— 流式 + Suspense 能让快的部分先出，imvc 只能全部 `await` 完。
- 想控包体积、想让服务端依赖不下发 —— RSC 的核心收益。
- 团队要招人、要跟 React 主线（并发、`use`、Server Actions）。

维持 imvc 的隐性成本，面试里说得出来才算真懂：webpack 4 + React 17 锁死；`create-history` 是 history v3 的私有 fork，不可替换；`React.createElement` 全局劫持在长驻进程里的污染风险；`initialState` 的模块单例跨请求串数据（靠 `deepCloneInitialState` 兜底）；Controller 既不返回内容也不重定向时请求会**永远挂着**。

---

## 面试速答

| 问题 | 答法 |
| --- | --- |
| imvc 和 Next.js 最本质的差异 | 同构的切分时机：imvc 运行时用 `isServer` 分叉、同一份逻辑两端各跑；Next.js 编译期用模块边界分叉，服务端代码物理上不进客户端 bundle |
| 为什么 imvc 的 `getInitialState` 不能碰 window，Next 的 `getServerSideProps` 却可以碰 fs | 前者在单页跳转时会在浏览器执行；后者被编译期剥离，只可能在 Node 执行 |
| 单页跳转时数据从哪来 | imvc：浏览器直连 API（1 跳）；Pages Router：回 Node 拉 `/_next/data/*.json`；App Router：回 Node 拉 RSC Flight（拿到的是渲染结果不是数据） |
| 服务端状态怎么过桥 | imvc `window.__INITIAL_STATE__` 全量 store；Pages `__NEXT_DATA__`；App Router 是随 HTML 流分批注入的 `self.__next_f.push()` Flight |
| imvc 为什么返回列表页能保住滚动和输入 | 旧页面 DOM 不卸载只 `display:none`，controller 在缓存池（默认 10 个），`ViewManager.scrollMap` 记滚动位置；Next.js 没有等价能力 |
| imvc 算不算流式 SSR | 不算。`renderToNodeStream` 的输出被 `on('data')` 收集成完整 Buffer 再塞进 LayoutView，TTFB 不会变快 |
| Next.js 的 RSC 解决了 imvc 的什么痛点 | 服务端依赖不下发（包体积）、按组件取数与去重、Suspense 分块流式、敏感数据不过桥 |
| imvc 的错误边界为什么危险 | 它劫持全局 `React.createElement`，服务端长驻进程里必须在 `finally` / stream `end` 还原，否则污染下一个请求 |
| imvc 的技术天花板在哪 | webpack 4.44.2 + `ReactDOM.hydrate` + `UNSAFE_componentWillReceiveProps`，没迁到 `hydrateRoot`，吃不到 React 18+ 并发特性 |
| 什么情况下仍该选 imvc | 移动端强依赖「返回如初」的列表/详情流转，以及需要完全掌控 express 服务端的场景 |

相关：[原理.md](原理.md)、[React/服务端渲染.md](../React/服务端渲染.md)、[React/单页路由.md](../React/单页路由.md)
