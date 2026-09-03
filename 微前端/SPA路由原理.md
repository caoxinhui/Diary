# SPA 与路由切换原理

### 什么叫 SPA

**Single Page Application**：整个站点只有**一份 HTML 文档**，首屏加载后由 JS 接管渲染和 URL 管理。之后所谓的"翻页"不再向服务器要新文档，只是**换掉页面里的一部分 DOM**，URL 由 JS 手动同步。

| 维度 | MPA（多页应用） | SPA |
| --- | --- | --- |
| 页面切换 | 浏览器发起 document 请求，**整页重建** | JS 换 DOM，document 不变 |
| JS 运行时 | 每次导航都销毁重建，全局变量清零 | 一直活着，内存状态、长连接、播放器都能保留 |
| 切换体验 | 白屏 + 闪烁，取决于网络 | 无刷新，可加过渡动画 |
| 首屏 | 服务端直出，快 | 要先下 JS 再渲染，慢（靠 SSR / 代码分割补） |
| SEO | 天然友好 | 需要 SSR / 预渲染 |
| 服务端 | 每个路由一个模板 | 所有路由 fallback 到同一个 index.html |
| 前进后退 / 刷新 / 滚动位置 | 浏览器白送 | **全部得自己实现** |

最后一行就是路由库存在的全部理由：**SPA 绕开了浏览器的导航机制，就必须把浏览器顺手做的事自己补回来** —— URL 同步、历史栈、前进后退、滚动恢复、页面标题、PV 埋点。

怎么判断一个站是不是 SPA：切页面时打开 Network，**看有没有新的 `document` 类型请求**。只有 fetch/xhr 和 js chunk 就是 SPA；出现新 document 就是 MPA。

### 一次页面切换到底发生了什么

以 `<Link to="/detail/1">` 为例：

```
用户点击 <a href="/detail/1">
   │
   ├─① e.preventDefault()  ← 阻止 a 标签的默认导航，否则整页刷新，一切白做
   │
   ├─② history.pushState(state, '', '/detail/1')
   │      改地址栏 + 往历史栈压一条记录；不发请求、不校验 URL 是否存在
   │
   ├─③ 手动通知订阅者   ← pushState 不派发任何事件，router 只能自己 notify
   │      history.listen(...) / useSyncExternalStore / setState
   │
   ├─④ 匹配路由表：'/detail/:id' → { Component, params: { id: '1' } }
   │      命中 lazy 路由 → 动态 import() 拉 chunk → 期间显示 Suspense fallback
   │
   ├─⑤ 取数据：loader / useEffect / RSC（可与 ④ 并行，避免请求瀑布）
   │
   ├─⑥ 重新渲染：卸载旧页面组件（清定时器、取消请求）→ 挂载新组件 → DOM diff
   │
   └─⑦ 收尾：滚动位置恢复、document.title、PV 埋点
```

**②③ 是全部关键**：改 URL 和渲染 UI 是两件完全独立的事，路由库的工作就是把它们绑在一起。

### 两种实现：hash 与 history

| | hash 模式 | history 模式 |
| --- | --- | --- |
| URL | `example.com/#/detail/1` | `example.com/detail/1` |
| 为什么不刷新 | `#` 后面是 **fragment，根本不会发给服务器**，改它只滚动锚点 | `pushState` 被规范定义为"只改历史条目，不导航" |
| 改 URL | `location.hash = '/detail/1'` | `history.pushState(state, '', '/detail/1')` |
| 有事件吗 | ✅ `hashchange` | ❌ 什么都没有，得自己包一层 |
| 服务端配置 | 不需要 | **必须**把所有路径 fallback 到 index.html |
| 能带结构化数据 | ❌ 只能塞字符串到 URL 里 | ✅ `state` 参数，可传对象（structured clone） |
| 缺点 | URL 丑；和页内锚点定位抢 `#`；SEO 差；微前端里主子应用抢同一个 hash | 需要服务端配合；本地 `file://` 打开直接废 |

history 模式的服务端 fallback（少了它，用户刷新非首页就是 404）：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### History API 的细节（高频追问点）

```js
history.pushState(state, '', url);     // 压一条新记录
history.replaceState(state, '', url);  // 替换当前记录，不新增
```

- **第二个参数 `title` 是废弃的**，规范里明确被忽略，传 `''` 就行
- **`url` 必须同源**，跨域直接抛 `SecurityError`
- **不发请求、不校验 URL 存在性**，所以刷新时才暴露服务端没配 fallback
- **`state` 走结构化克隆**：不能放函数、DOM 节点；有大小上限（Firefox 约 16MiB），别把整个列表数据塞进去
- **两者都不触发 `popstate`**，这是路由库必须劫持它们的根因
- `replaceState` 的典型用途：登录重定向、把筛选条件同步到 query（不想让后退键被一堆中间态塞满）、离开页面前记录滚动位置

`popstate` 只在**历史条目发生切换**时触发：

| 触发 | 不触发 |
| --- | --- |
| 用户点前进 / 后退 | `pushState` / `replaceState` |
| `history.go / back / forward` | 首次进入页面（`load` 时想渲染要自己调一次） |
| 后退跨过一次 hash 变化（`hashchange` 也会来，需去重） | 跳转到别的文档 |

滚动恢复：浏览器默认 `history.scrollRestoration === 'auto'`，会在后退时试着还原滚动位置，但 SPA 里 DOM 还没渲染完就还原，位置往往是错的。所以路由库通常设成 `'manual'`，自己在切换前把 `scrollY` 存进 `state`，渲染完再 `scrollTo`。

> 未来：**Navigation API**（`navigation.addEventListener('navigate', e => e.intercept({ handler }))`）能统一拦截 a 标签点击、`pushState`、前进后退，还自带 transition 和滚动恢复，Chromium 已支持，Safari / Firefox 仍在推进中。它就是为了干掉本文里所有的 hack 而设计的。

### 哪些 URL 操作不刷新页面

判据在规范里，浏览器把导航分成两类：

- **same-document navigation（同文档）**：`document`、JS 运行时、内存状态、定时器全部保留 → **不刷新**
- **cross-document navigation（跨文档）**：卸载当前 document，重新走一遍请求 + 解析 + 执行 → 刷新

而只有两种情况算同文档：

1. 新旧 URL **除 `#` 后面的 fragment 外完全相同**（fragment navigation）
2. 调用了 `pushState` / `replaceState` —— 规范把它定义成"更新 URL 和历史条目"，压根不是导航

| 操作 | 刷新？ | 派发的事件 |
| --- | --- | --- |
| `location.hash = '/detail/1'` | ❌ | `hashchange` |
| `location.href = '#foo'`（只有 hash 不同） | ❌ | `hashchange` |
| 点击 `<a href="#foo">` | ❌ | `hashchange` + 滚到锚点 |
| `history.pushState / replaceState`（同源） | ❌ | **无**（所以要劫持） |
| `history.back / forward / go`（在同文档条目之间） | ❌ | `popstate` |
| Navigation API 里 `e.intercept()` | ❌ | `navigate` |
| **`location.search = 'a=1'`** | ✅ | — |
| **`location.pathname = '/a'`** / `host` / `port` / `protocol` | ✅ | — |
| `location.href = '/a'`、`location.assign / replace` | ✅ | — |
| `location.reload()` | ✅（URL 相同也刷） | — |
| 点击普通 `<a href="/a">`、`<form>` 提交 | ✅ | — |
| `<meta http-equiv="refresh">` | ✅ | — |

一句话记：**给 `location` 的任何非 hash 字段赋值都会刷新，想改 path / query 又不刷新，只有 `pushState` / `replaceState` 一条路。**

```js
// 把筛选条件同步到地址栏，页面纹丝不动
const url = new URL(location.href);
url.searchParams.set('page', '2');
history.replaceState(null, '', url);
```

几个容易被追问的边角：

- **hash 赋成相同的值，什么都不会发生** —— 连 `hashchange` 都没有。所以同一个锚点链接点第二次没反应
- **`<a href="#">` 会把 hash 清空并把页面滚到顶部**，这是"点了个按钮页面莫名跳回顶部"的经典原因；该用 `<button>`，或 `preventDefault`
- `pushState` 到**完全相同的 URL 也会重复压栈**，后退时 URL 看着没变，`popstate` 照样触发
- `pushState` 到**跨域 URL 直接抛 `SecurityError`**，既不刷新也不成功
- 根本没发生导航所以也不刷新的：`target="_blank"`、`download`、`mailto:` / `tel:` / `javascript:void(0)`
- 后退**跨过文档边界**时属于跨文档导航，但可能命中 **bfcache**：document 整个从内存里恢复，不重新执行 JS，只触发 `pageshow(persisted: true)`

### 为什么 Link 用 `<a>` 而不是 `<div onClick>`

既要 `<a>` 的语义（键盘可达、右键"新标签页打开"、爬虫能抓到 href、鼠标悬浮显示地址），又不要它的默认导航。所以 `Link` 做的事就是：**渲染真 `<a href>` + 拦掉左键点击 + 走 pushState**。

关键是**该放行的必须放行**，这是很好的一道追问：

```js
function handleClick(e) {
  if (
    e.button !== 0 ||                                  // 不是鼠标左键（中键要新开标签）
    e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || // Cmd/Ctrl+点击 = 新标签页
    (target && target !== '_self') ||                  // target="_blank"
    isExternal(href)                                   // 跨域 / 协议不同，pushState 会抛错
  ) {
    return;               // 交给浏览器原生行为，绝对不要 preventDefault
  }
  e.preventDefault();
  navigate(href);
}
```

漏掉这段，用户 `Cmd + 点击` 就没法新开标签页 —— 一个非常常见的线上体验 bug。

### 手写一个 mini router

核心就是「劫持 URL 变化 → 通知订阅者 → 匹配后渲染」，40 行足够：

```js
// ---------- 1. 把所有 URL 变化归一成一个 notify ----------
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(location.pathname));

['pushState', 'replaceState'].forEach((key) => {
  const raw = history[key];
  history[key] = function (...args) {
    const r = raw.apply(this, args);
    notify();                      // 手动补上浏览器不给的通知
    return r;
  };
});
window.addEventListener('popstate', notify);   // 前进后退

export const navigate = (to) => history.pushState(null, '', to);

// ---------- 2. 路由匹配：把 :id 编译成命名捕获组 ----------
function matchPath(pattern, pathname) {
  const keys = [];
  const regexp = new RegExp(
    '^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$'
  );
  const m = pathname.match(regexp);
  if (!m) return null;
  return { params: Object.fromEntries(keys.map((k, i) => [k, m[i + 1]])) };
}
```

```jsx
// ---------- 3. React 侧：订阅 + 渲染 ----------
function useLocation() {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),   // subscribe
    () => location.pathname                                     // getSnapshot
  );
}

export function Route({ path, component: C }) {
  const pathname = useLocation();
  const match = matchPath(path, pathname);
  return match ? <C {...match.params} /> : null;
}

export function Link({ to, children }) {
  return (
    <a href={to} onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); navigate(to); } }}>
      {children}
    </a>
  );
}
```

真实的 react-router 在这之上多做的，主要是：`history` 库统一 hash/history/memory 三种实现、路由表编译与优先级排序（静态段 > 动态段 > 通配符）、嵌套路由与 `<Outlet />`、`loader` 数据预取、`Suspense` + 懒加载、以及滚动恢复。

### SPA 的代价与对策

| 代价 | 对策 |
| --- | --- |
| 首屏白屏（要下完 JS 才有内容） | 路由级代码分割 `React.lazy` + `import()`、SSR / 流式渲染、骨架屏 |
| SEO | SSR / SSG / 预渲染，或给爬虫单独出静态页 |
| 内存泄漏（运行时不重建，泄漏会累积） | `unmount` 里清定时器、事件监听、订阅、AbortController |
| PV 埋点丢失（没有 document 加载事件） | 在路由变化的回调里手动上报 |
| 一处报错整站白屏 | ErrorBoundary 按路由粒度兜底 |
| 刷新 404 | 服务端 `try_files ... /index.html` |
| 部署后旧页面拿不到新 chunk（`ChunkLoadError`） | 保留旧产物 + 动态 import 失败时降级为整页刷新 |

### 和微前端的关系

微前端的主应用路由，就是**把 SPA 路由的"URL → 组件"换成"URL → 子应用"**：同一套劫持 `pushState` 的手法，只是匹配结果从渲染一个组件变成 load / mount 一个应用，于是形成两级路由。详见 [原理.md](原理.md#一路由原理)。

### 面试速答版

- **什么是 SPA**：只有一份 HTML，首屏后由 JS 接管渲染和 URL；切页面不请求新文档，只换 DOM，JS 运行时一直存活。代价是首屏慢、SEO 差，且前进后退、刷新、滚动恢复这些浏览器白送的能力必须自己实现 —— 这就是路由库的职责。
- **切换原理**：`Link` 渲染真 `<a>` 但拦掉左键点击 `preventDefault` → `history.pushState` 改地址栏并压历史栈（不发请求）→ 因为 `pushState` **不派发任何事件**，路由库自己 notify 订阅者 → 用正则匹配路由表拿到组件和 params（懒加载则先 `import()` 拉 chunk）→ React 卸载旧组件、挂载新组件 → 最后补滚动恢复、title、埋点。
- **hash vs history**：hash 靠 `#` 后面不发给服务器 + 有原生 `hashchange`，零服务端配置但 URL 丑、抢锚点；history 靠 `pushState`，URL 干净能带 state，但没有事件（必须劫持）且服务端要 fallback 到 index.html，否则刷新 404。
- **`popstate` 的坑**：只有前进后退和 `history.go` 会触发，`pushState` / `replaceState` 不会，首次进入也不会。
- **哪些 URL 操作不刷新**：只有两类算同文档导航 —— 只改 `#` 后面的 fragment（`location.hash`、锚点 `<a>`），以及 `pushState` / `replaceState`（含随后的前进后退）。给 `location.pathname` / `search` / `href` 赋值、`assign` / `replace` / `reload`、点普通链接和表单提交都会跨文档重载。所以想改 path 或 query 又不刷新，只有 `pushState` / `replaceState` 一条路。



