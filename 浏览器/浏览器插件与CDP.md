---
title: "浏览器插件与 CDP：两种「操纵浏览器」的方式"
tags: [浏览器]
prereq:
  - 浏览器/浏览器.md
related: []
deep: []
dup: []
---

# 浏览器插件与 CDP：两种「操纵浏览器」的方式

### 先把两者的定位分清
| | 浏览器插件（Extension） | CDP（Chrome DevTools Protocol） |
| --- | --- | --- |
| 位置 | **在浏览器内部**，作为一个特殊 origin 的站点被加载 | **在浏览器外部**，通过调试通道远程驱动 |
| 拿到能力的方式 | manifest 声明权限 → 浏览器开放 `chrome.*` API | 浏览器开一个调试端口，谁连上谁就是「上帝」 |
| 权限粒度 | 细，按 host / API 声明，用户可见可撤 | 无粒度，**连上即全权**，也没有认证 |
| 分发 | 应用商店，用户主动安装 | 自己启动浏览器进程 / 自己连 |
| 典型用途 | 广告拦截、油猴脚本、密码管理、划词翻译 | 自动化测试、爬虫、性能采集、DevTools 自身 |
| 交汇点 | `chrome.debugger` —— **在插件里发 CDP 命令** | |

一句话：**插件是「被浏览器邀请进来的客人」，CDP 是「拿到了浏览器后门钥匙的人」。**

---

## 一、浏览器插件（Chrome Extension MV3）运行原理

### 1. 它本质上是什么
一个带 `manifest.json` 的网页压缩包。浏览器把它当成 origin 为 `chrome-extension://<32位id>` 的站点加载，然后按 manifest 里声明的权限，向它开放一批 `chrome.*` 特权 API。

所以插件开发用的就是 Web 技术（HTML/CSS/JS），特殊的只有两点：**独立的 origin** 和 **额外的特权 API**。

### 2. 它由哪些执行环境拼起来（核心考点）
插件不是一个进程里的一段代码，而是散落在**不同进程、不同 JS 世界**里的若干片段：

| 组成 | 跑在哪 | JS 世界 | 能用的 API | 生命周期 |
| --- | --- | --- | --- | --- |
| **Service Worker**（background） | 扩展自己的渲染进程 | `chrome-extension://id` | 几乎全部 `chrome.*` | **事件驱动，30s 空闲就被杀** |
| **Content Script** | **目标网页的渲染进程** | isolated world（独立 V8 上下文） | 只有 `dom`/`i18n`/`storage` + 部分 `runtime` | 跟随页面 |
| **MAIN world 注入脚本** | 目标网页的渲染进程 | 页面自己的世界 | **没有任何 `chrome.*`**，受页面 CSP | 跟随页面 |
| **popup / options / side panel** | 扩展渲染进程 | `chrome-extension://id` | 全部 `chrome.*` | 打开才存在，关闭即销毁 |
| **devtools page** | DevTools 前端上下文 | `chrome-extension://id` | `chrome.devtools.*` | 跟随 DevTools 窗口 |
| **offscreen document** | 扩展渲染进程 | `chrome-extension://id` | 需要 DOM 的 API（剪贴板、audio） | 手动创建/销毁 |

面试高频：**「content script 和 background 为什么要分开？」** 因为它们的位置和能力天然相反 —— content script 能碰 DOM 但没有特权，background 有特权但碰不到任何页面。两者必须靠消息通道配合。

### 3. 进程与权限模型：`chrome.*` 到底在哪执行
这是「运行原理」最本质的一层：**渲染进程里的 `chrome.*` 只是一层空壳 binding，真正的实现在 browser 进程。**

```
                   Browser 进程（唯一特权方：文件、网络栈、Cookie、tab、下载）
                        ▲                    ▲                  ▲
                        │ Mojo IPC           │ Mojo IPC         │ Mojo IPC
        ┌───────────────┘         ┌──────────┘        ┌─────────┘
   扩展渲染进程（沙箱）        页面渲染进程（沙箱）        GPU / Network 进程
   ├ Service Worker            ├ 页面 main world
   │   chrome.tabs.query() ────┤    （无任何 chrome.*）
   ├ popup / options           └ content script（isolated world）
   └ devtools page                  共享 DOM ＋ chrome.* 子集
```

一次 `chrome.tabs.query()` 的完整链路：
1. 渲染进程里的 JS 调用 binding，参数序列化成 IPC 消息；
2. 消息发到 browser 进程的 `ExtensionFunction` 实现；
3. **browser 进程校验该扩展 manifest 里有没有 `tabs` 权限**；
4. 通过则真正读取 tab 列表，结果 IPC 回传，resolve 那个 Promise。

推论（也是安全模型的关键）：**渲染进程即使被攻破，也拿不到超出 manifest 声明的能力**，因为校验发生在进程边界的另一侧。这和「渲染进程沙箱 + browser 进程守门」是同一套设计。

### 4. Isolated World：共享 DOM，不共享 JS
content script 和页面脚本跑在**同一个渲染进程、同一个 DOM 树，但两个互相隔离的 V8 上下文**里。

```js
// 页面自己的脚本
window.token = 'page-secret';
Element.prototype.foo = 1;

// content script（isolated world）
console.log(window.token);   // undefined —— 变量不共享
document.body.style.background = 'red';  // ✅ DOM 完全共享
document.querySelector('#btn').dataset.tag = 'x';  // ✅ DOM 属性跨世界可见
```

隔离带来两个后果：
- **好处**：页面改不了你的 `Array.prototype`，也偷不到你的逻辑；插件之间也互相隔离。
- **代价**：想读页面的 JS 变量（比如页面上的 `window.__INITIAL_STATE__`）必须绕路。

三种绕路方式：

```jsonc
// 方案 1：声明式注入到 MAIN world（较新版本 Chrome 支持，最省事）
// manifest.json
{
  "content_scripts": [
    { "matches": ["https://*/*"], "js": ["bridge.js"], "world": "MAIN" }
  ]
}
```
> ⚠️ MAIN world 里没有 `chrome.*`，受页面 CSP 限制，且**页面能读到、能干扰你的脚本**，所以只能当「探针」用，敏感逻辑必须留在 isolated world。

```js
// 方案 2：动态注入（需要 scripting 权限）
chrome.scripting.executeScript({
  target: { tabId },
  world: 'MAIN',
  func: () => window.__INITIAL_STATE__,   // 在页面世界里执行
}).then(([{ result }]) => console.log(result));

// 方案 3：postMessage 桥（兼容性最好，油猴脚本的经典做法）
// main-world.js（跑在页面世界）
window.postMessage({ from: 'probe', state: window.__INITIAL_STATE__ }, '*');

// content.js（isolated world）
window.addEventListener('message', e => {
  if (e.source !== window || e.data?.from !== 'probe') return;  // 必须校验来源
  chrome.runtime.sendMessage({ type: 'STATE', payload: e.data.state });
});
```

> `postMessage` 桥的数据来自页面，**页面是攻击者可控的**：只用 `JSON.parse` 不用 `eval`，只用闭包不用字符串形式的 `setTimeout`（MV3 的 CSP 本来也禁掉了后者）。

### 5. 消息通道
| 方向 | API |
| --- | --- |
| content script → SW | `chrome.runtime.sendMessage()` |
| SW → content script | `chrome.tabs.sendMessage(tabId, msg)` |
| popup ↔ SW | `chrome.runtime.sendMessage()`（同 origin，也可直接 `chrome.extension.getViews()`） |
| 页面 ↔ content script | `window.postMessage` / 自定义 DOM 事件（唯一通道） |
| 高频/流式 | `chrome.runtime.connect()` 长连接 Port |

```js
// sw.js —— 一次性消息：异步回复必须 return true
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'FETCH') return;
  fetch(msg.url).then(r => r.json()).then(sendResponse);
  return true;          // ← 忘了这行，sendResponse 会因通道提前关闭而失效（最经典的坑）
});

// content.js —— 长连接：适合高频事件，省掉每次建连的开销
const port = chrome.runtime.connect({ name: 'dom-events' });
port.postMessage({ type: 'scroll', y: scrollY });
port.onDisconnect.addListener(() => {
  // SW 被回收会导致断连，需要重连（见下一节）
});
```

### 6. MV3 Service Worker 生命周期（MV3 最大的坑）
MV2 的 background page 是**常驻**的，MV3 换成 Service Worker 后变成**事件驱动、随时被回收**。官方给出的三条销毁规则：

| 触发条件 | 说明 |
| --- | --- |
| **空闲 30 秒** | 收到事件或调用扩展 API 会重置计时器（Chrome 110 起「调用 API」也算） |
| 单个事件/API 调用处理超过 **5 分钟** | 直接杀 |
| 一次 `fetch()` 超过 **30 秒**还没响应 | 直接杀 |

额外保活的情况：`chrome.debugger` 会话（Chrome 118+）、WebSocket 收发（116+）、长连接 Port 上**发消息**（114+，注意「仅打开 Port 不再重置计时器」）、`connectNative()`（105+）。

两条铁律：

```js
// ❌ 错：监听器在异步回调里注册。SW 被唤醒时，事件早已派发完毕，这个监听器永远收不到
chrome.storage.local.get('cfg', cfg => {
  chrome.runtime.onMessage.addListener(handler);
});

// ✅ 对：监听器必须在顶层同步注册，异步逻辑放到 handler 内部
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  chrome.storage.local.get('cfg').then(cfg => sendResponse(handle(msg, cfg)));
  return true;
});
```

```js
// ❌ 错：全局变量随 SW 销毁而丢失
let counter = 0;
chrome.action.onClicked.addListener(() => { counter++; });   // 重启后归零

// ✅ 对：状态一律外置。session 区随浏览器会话结束清空，local 区持久化
chrome.action.onClicked.addListener(async () => {
  const { counter = 0 } = await chrome.storage.session.get('counter');
  await chrome.storage.session.set({ counter: counter + 1 });
});
```

其他配套：
- **定时任务**用 `chrome.alarms`，不要用 `setInterval`（SW 一睡就没了；alarms 最小周期 30s，Chrome 120 起与生命周期对齐）
- **不要试图强行保活**（早年靠 `setInterval` + 空 port 续命），官方明确要求「设计成能容忍随时被销毁」
- Web Storage API（`localStorage`）在扩展 SW 里**不可用**，只能用 `chrome.storage` / IndexedDB / CacheStorage

### 7. MV2 → MV3 的实质变化
| 维度 | MV2 | MV3 | 为什么改 |
| --- | --- | --- | --- |
| 后台 | 常驻 background page | 事件驱动 Service Worker | 省内存（几十个常驻插件很吃资源） |
| 远程代码 | 可 `eval` / 加载远程 JS | **禁止**，代码必须全部打包在内 | 商店审核过的代码不能被上线后偷换 |
| 网络拦截 | `webRequest` 阻塞式回调 | `declarativeNetRequest` 声明式规则 | 规则由浏览器执行，不必把每个请求都同步等插件 JS |
| 脚本注入 | `tabs.executeScript` | `chrome.scripting.executeScript` | 收敛到独立权限，并支持 `world` |
| 权限 | `permissions` 混装 | `permissions` / `host_permissions` 拆分 | 域名权限单独呈现给用户 |
| API 风格 | callback | Promise（callback 仍兼容） | — |

争议点值得知道：`declarativeNetRequest` 的规则数有上限、且无法基于响应内容做决策，这是 uBlock Origin 等拦截类插件反对 MV3 的核心原因。

### 8. 一个最小可运行的插件
```jsonc
// manifest.json —— 功能：点图标，统计当前页图片数量并高亮
{
  "manifest_version": 3,
  "name": "Image Counter",
  "version": "1.0",
  "permissions": ["scripting", "storage"],
  "host_permissions": ["https://*/*"],
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "sw.js", "type": "module" },
  "content_scripts": [
    { "matches": ["https://*/*"], "js": ["content.js"], "run_at": "document_idle" }
  ]
}
```

```js
// content.js —— 在页面渲染进程，能碰 DOM，没有特权
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'COUNT_IMG') return;
  const imgs = [...document.images];
  imgs.forEach(img => (img.style.outline = '2px solid red'));
  sendResponse({ count: imgs.length });   // 同步 sendResponse 不需要 return true
});
```

```js
// sw.js —— 在扩展渲染进程，有特权，碰不到 DOM
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'SCAN') return;
  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // 转发给 content script（SW 自己没有 document.images）
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'COUNT_IMG' });
    await chrome.storage.local.set({ [`count:${tab.id}`]: res.count });
    sendResponse(res);
  })();
  return true;      // 异步回复
});
```

```html
<!-- popup.html -->
<body>
  <button id="go">扫描图片</button><span id="out"></span>
  <script src="popup.js"></script>   <!-- MV3 禁止内联 script，必须外链 -->
</body>
```

```js
// popup.js
document.getElementById('go').onclick = async () => {
  const res = await chrome.runtime.sendMessage({ type: 'SCAN' });
  document.getElementById('out').textContent = ` ${res.count} 张`;
};
```
数据流：`popup → SW（有特权，查 tab）→ content script（有 DOM）→ 回传`。这条链路把上面所有概念串起来了。

---

## 二、CDP（Chrome DevTools Protocol）运行原理

### 1. 一句话定位
CDP 是 Chromium 暴露出来的一套 **JSON-RPC over WebSocket** 远程控制协议。你在 DevTools 面板里的每一次点击，底层都是一条 CDP 命令。

**关键认知：DevTools 不特殊。** 它自己就是一个网页（`devtools://devtools/bundled/devtools_app.html`），对被调试页面的全部了解都来自 CDP。所以：**DevTools 能做的事，你用 CDP 都能做**——改 DOM、拿覆盖率、抓 trace、断点调试、模拟设备与弱网、拦改请求。

### 2. 传输层
```bash
# 启动一个开着调试端口的 Chrome（务必用独立 profile，避免污染日常配置）
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/cdp-profile \
  --headless=new                     # 可选

# 端口写 0 表示让 Chrome 自选，端口号会写进 profile 下的 DevToolsActivePort 文件
```

发现端点（普通 HTTP GET，端口上直接可访问）：

| 端点 | 作用 |
| --- | --- |
| `/json/version` | 浏览器版本 + **browser 级** `webSocketDebuggerUrl` |
| `/json` 或 `/json/list` | 所有可连的 target 列表（`id`/`type`/`title`/`url`/`webSocketDebuggerUrl`） |
| `/json/protocol` | 当前版本**完整协议定义**（所有 domain / 命令 / 事件），比文档更权威 |
| `PUT /json/new?{url}` | 新建标签页 |
| `/json/activate/{id}`、`/json/close/{id}` | 激活 / 关闭标签页 |

两级连接的区别，很多人栽在这里：
- **page 级** `ws://.../devtools/page/<targetId>`：只能操作这一个页面
- **browser 级** `ws://.../devtools/browser/<uuid>`：能用 `Target.*` 管理所有页面、能开新标签页 —— **自动化应该连这个**

WebSocket 上的报文只有三种形状：
```jsonc
// 命令：id 由客户端自增，用来关联响应
{ "id": 1, "method": "Page.navigate", "params": { "url": "https://example.com" }, "sessionId": "..." }
// 响应：id 与命令对应，二选一
{ "id": 1, "result": { "frameId": "..." }, "sessionId": "..." }
{ "id": 1, "error":  { "code": -32000, "message": "..." } }
// 事件：没有 id，靠 method 分发
{ "method": "Network.responseReceived", "params": { ... }, "sessionId": "..." }
```
裸 socket 需要自己做 `id → Promise` 的关联，这就是 Puppeteer 之类客户端库主要在替你做的事。

### 3. 手写一个 CDP 客户端：Puppeteer 的核心就这 35 行
```js
// mini-cdp.js
// Node 22+ 有全局 WebSocket；Node 20 加 --experimental-websocket，或 npm i ws
const { EventEmitter } = require('node:events');

class CDP extends EventEmitter {
  #ws; #seq = 0; #pending = new Map();

  static async connect(port = 9222) {
    // 连 browser 级端点，这样才能用 Target.* 管理页面
    const { webSocketDebuggerUrl } =
      await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json());
    const ws = new WebSocket(webSocketDebuggerUrl);
    await new Promise((ok, err) => { ws.onopen = ok; ws.onerror = err; });
    return new CDP(ws);
  }

  constructor(ws) {
    super();
    this.#ws = ws;
    ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.id === undefined) {
        // 没有 id 就是事件。sessionId 一起抛出，多 target 场景靠它区分来源
        return this.emit(msg.method, msg.params, msg.sessionId);
      }
      const p = this.#pending.get(msg.id);           // 有 id 就是响应，回填对应的 Promise
      this.#pending.delete(msg.id);
      msg.error
        ? p.reject(new Error(`${msg.error.message} (${msg.error.code})`))
        : p.resolve(msg.result);
    };
  }

  send(method, params = {}, sessionId) {
    const id = ++this.#seq;
    const p = new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject }));
    this.#ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
    return p;
  }
}
```

用它跑一遍「打开页面 → 抓请求 → 执行 JS → 截图」：

```js
const cdp = await CDP.connect();

// 1) 开新标签页并 attach，拿到 sessionId
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => cdp.send(m, p, sessionId);      // 页面级命令都要带 sessionId

// 2) 想收事件，必须先 enable —— 绝大多数 domain 都是这个规矩
await S('Network.enable');
await S('Page.enable');
cdp.on('Network.responseReceived', ({ response }) => console.log(response.status, response.url));

// 3) 导航 + 等 load（Page.loadEventFired 需要 Page.enable 才会发）
const loaded = new Promise(r => cdp.once('Page.loadEventFired', r));
await S('Page.navigate', { url: 'https://example.com' });
await loaded;

// 4) 在页面里执行 JS —— 这就是 puppeteer 的 page.evaluate
const { result } = await S('Runtime.evaluate', {
  expression: 'document.title',
  returnByValue: true,          // 不加这个只会返回一个 RemoteObject 句柄
});
console.log(result.value);      // Example Domain

// 5) 截图，返回 base64
const { data } = await S('Page.captureScreenshot', { format: 'png' });
require('node:fs').writeFileSync('shot.png', Buffer.from(data, 'base64'));
```

看清楚了就会明白：**Puppeteer / Playwright 并没有什么魔法**，它们主要在做三件事 —— 关联 id 与响应、把 CDP 的原始命令包装成 `page.click()` 这样的语义 API、以及处理各种时序等待。

### 4. Target 与 Session：多页面 / 多 iframe 怎么管
**Target** = 一个可被调试的东西。类型有 `page`、`iframe`（仅跨进程 iframe）、`worker`、`service_worker`、`browser`、`other`。

重要细节：**同进程的 iframe 和主文档共享一个 target**，只是各有自己的 `executionContextId`；而**跨站的 out-of-process iframe（OOPIF）会成为独立 target**，必须单独 attach 才能操作。爬虫抓不到跨域 iframe 内容，十次有九次是这个原因。

```js
// flatten 模式：所有 target 的消息复用同一条 WebSocket，靠 sessionId 区分
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

// 自动 attach 新出现的子 target（新开的窗口、OOPIF、worker）
await cdp.send('Target.setAutoAttach', {
  autoAttach: true,
  waitForDebuggerOnStart: true,   // 让子 target 停在第一行，给你机会先下断点/开 domain
  flatten: true,
}, sessionId);

cdp.on('Target.attachedToTarget', async ({ sessionId: child, targetInfo }) => {
  console.log('新 target:', targetInfo.type, targetInfo.url);
  await cdp.send('Network.enable', {}, child);
  await cdp.send('Runtime.runIfWaitingForDebugger', {}, child);   // 放它继续跑
});
```
坑：**`setAutoAttach` 只覆盖直接子 target，不递归**。A → B → C 的话，拿到 B 的 session 后要在 B 上再调一次。

历史包袱：老代码里 `flatten: false` 会把子 target 的消息包在 `Target.receivedMessageFromTarget` 事件里，需要手动套一层 JSON。**新代码一律用 `flatten: true`。**

### 5. 内部架构：一条命令最终在哪里执行
```
你的脚本 / DevTools 前端（devtools://）
      │  CDP over WebSocket
      ▼
┌─────────────────────────── Browser 进程 ────────────────────────────┐
│  DevToolsAgentHost —— 协议入口、路由、Target/Session 管理            │
│  就地实现的 domain：Target、Browser、Fetch 拦截、Network 的大部分     │
│  （因为网络栈、tab 管理本来就在 browser / network 进程）              │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ Mojo IPC
                               ▼
┌────────────────────── 渲染进程（Blink）─────────────────────────────┐
│  InspectorDOMAgent / InspectorCSSAgent / InspectorPageAgent ...     │
│  实现 DOM、CSS、Page、Overlay、DOMSnapshot 等「跟渲染有关」的 domain  │
│                               │                                    │
│                               ▼                                    │
│      V8 Inspector（v8-inspector.h）                                │
│      实现 Runtime / Debugger / Profiler / HeapProfiler / Console     │
└────────────────────────────────────────────────────────────────────┘
```

这个分层能解释三件平时想不通的事：

**（1）为什么 Node.js 也能用 CDP？** 因为 `Debugger`/`Runtime`/`Profiler`/`HeapProfiler` 来自 **V8 自带的 inspector**，跟浏览器无关。所以 Chrome DevTools 能直接调试 Node —— 但只有 V8 那部分。实测对比：

```bash
$ node --inspect=9333 app.js
$ curl -s localhost:9333/json/protocol | jq -r '.domains[].domain' | sort | tr '\n' ' '
Console Debugger HeapProfiler NodeRuntime NodeTracing NodeWorker Profiler Runtime Schema   # 9 个

$ curl -s localhost:9222/json/protocol | jq '.domains | length'
58   # Chrome：多出来的全是 DOM / CSS / Page / Network / Input / Emulation 这类浏览器专属能力
```

**（2）为什么有些命令必须连 browser 级端点？** `Target.createTarget`（开标签页）、`Browser.getVersion` 这些的实现就在 browser 进程，page 级 session 根本路由不到。

**（3）为什么 CDP 能看到页面 JS 看不到的东西？** `Network` 域实现在渲染进程**下面**（browser / network 进程），位置比页面 JS 更低，所以它能拿到被 CORS 拦掉的响应、重定向链、真实的请求头、以及走了缓存的请求 —— 这些在页面里用 `fetch` 或 `PerformanceObserver` 都是拿不到的。同理，`Fetch` 域能在请求真正发出前改写它，`Input` 域派发的是**浏览器层面的真实输入事件**，页面无法通过 `event.isTrusted` 区分出来。

### 6. Domain 速查与 `enable` 语义
| Domain | 干什么 | DevTools 里对应 |
| --- | --- | --- |
| `Target` / `Browser` | 管理页面、窗口、版本（**browser 级**） | — |
| `Page` | 导航、生命周期事件、截图、打印 PDF | — |
| `DOM` / `CSS` | 查改节点、盒模型、样式来源 | Elements |
| `Runtime` | 执行表达式、管理 executionContext | Console |
| `Debugger` | 断点、单步、调用栈、Source Map | Sources |
| `Network` | 请求事件、响应体、改 UA / 禁缓存 | Network |
| `Fetch` | **拦截并改写**请求/响应（`webRequest` 的强化版） | — |
| `Emulation` | 设备尺寸、DPR、地理位置、时区、CPU / 网络限速 | Device Toolbar |
| `Performance` / `Tracing` | 指标与完整 trace（Lighthouse 的数据来源） | Performance |
| `Profiler` / `HeapProfiler` | CPU profile、堆快照、代码覆盖率 | Memory / Coverage |
| `Input` | 派发**可信**的鼠标 / 键盘 / 触摸事件 | — |
| `Accessibility` | 无障碍树 | Accessibility |

两条实践规则：
- **`Domain.enable` 是收事件的前置条件**。忘了 enable 而干等事件，是新手最常见的 bug。
- **enable 有成本，别无脑全开**。`Network.enable` 会让每个请求都产生若干条 IPC + 事件；`Debugger.enable` 影响 V8 的优化行为；`Tracing.start` 的数据量以 MB/秒 计。做性能采集时，被打开的 domain 本身就会污染你要测的数字。

### 7. 多客户端与被抢占
Chrome 63 起支持**多个 CDP 客户端同时连同一个 target**。但优先级不对等：**用户手动打开 DevTools 会把你的会话踢掉**，你会收到

```json
{ "method": "Inspector.detached", "params": { "reason": "replaced_with_devtools" } }
```

所以健壮的自动化程序必须监听 `Inspector.detached` 并处理重连，而不是假设连接永远在。

### 8. 安全性：这是一个后门，不是一个 API
**调试端口 = 无认证的完全控制权。** 连上就能读任意站点的 Cookie、劫持任意页面、执行任意 JS、把浏览器当代理。所以：

- 只监听 **127.0.0.1**，永远不要 `--remote-debugging-address=0.0.0.0`，也不要把端口映射出容器
- 用**独立 `--user-data-dir`**，不要拿日常 profile 开调试端口（否则等于把你所有登录态拱手让人）
- Chrome 111 起补上了一道防线：**WebSocket 握手带 `Origin` 头就直接拒绝**，除非显式放行。实测：

```bash
# 不带 Origin（正常客户端库的行为）→ 通过
$ curl -si -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
       -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
       "http://127.0.0.1:9222/devtools/browser/<uuid>" | head -1
HTTP/1.1 101 WebSocket Protocol Handshake

# 带 Origin（网页里的 JS 发起的连接一定会带）→ 403
$ curl ... -H "Origin: http://evil.com" ... | head -1
HTTP/1.1 403 Forbidden
Rejected an incoming WebSocket connection from the http://evil.com origin.
Use the command line flag --remote-allow-origins=http://evil.com ...
```
这道防线堵的正是「你在本机开着调试端口，随便访问一个恶意网页，它的 JS 就连上你的浏览器全盘接管」的攻击。**所以 `--remote-allow-origins=*` 千万不要图省事加上。**

---

## 三、两者的交汇：`chrome.debugger`

插件里也能发 CDP 命令，官方定义它是「Chrome 远程调试协议的另一种传输方式」—— 不用开调试端口，直接在插件里 attach。

```js
// manifest.json: { "permissions": ["debugger"] }
const target = { tabId };

await chrome.debugger.attach(target, '1.3');       // requiredVersion，主版本必须匹配
await chrome.debugger.sendCommand(target, 'Network.enable');

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === 'Network.responseReceived') {
    console.log(params.response.status, params.response.url);
  }
});

// 拿响应体 —— 这是 declarativeNetRequest 做不到的事
const { body, base64Encoded } =
  await chrome.debugger.sendCommand(target, 'Network.getResponseBody', { requestId });

chrome.debugger.onDetach.addListener((source, reason) => {
  // reason: 'target_closed' | 'canceled_by_user'
  // 用户打开 DevTools 也会导致你被踢掉
});
```

用它的代价，也是面试可以加分的细节：
- **会在页面顶部弹一条黄条**「XX 正在调试此浏览器」，用户可以一键关掉你的会话
- **只开放约 28 个 domain**（DOM、CSS、Network、Fetch、Page、Runtime、Debugger、Input、Emulation、Target、Tracing、Profiler 等），browser 级的敏感能力拿不到
- **DevTools 优先**：用户一开 DevTools，你就 detach
- Chrome 125+ 支持 flat session（`DebuggerSession` 多了 `sessionId` 字段），才能优雅地处理 OOPIF 和子 target
- Chrome 118 起，attach 中的 debugger 会话会**保活 Service Worker**，不然 30 秒一到会话就断了

什么时候必须动用它？**当声明式 API 表达不了你的需求时** —— 典型是要读写请求/响应体、要注入可信输入事件、要做覆盖率或性能采集。否则优先用 `declarativeNetRequest` / `scripting`，代价小得多。

反过来，纯 CDP 也能加载插件：`--load-extension=/path/to/ext`（headless 下需要 `--headless=new`），自动化测试插件本身就靠这个。

---

## 四、面试怎么答

**「浏览器插件的运行原理」**，按这四层讲：
1. **是什么**：带 manifest 的网页包，跑在 `chrome-extension://` 这个独立 origin 下。
2. **在哪跑**：SW / popup 在扩展渲染进程，content script 在**目标页渲染进程的 isolated world**——共享 DOM 不共享 JS。
3. **特权怎么来**：渲染进程里的 `chrome.*` 只是 binding，实现在 **browser 进程**；跨进程 IPC 时按 manifest 校验权限。渲染进程被攻破也越不了权。
4. **MV3 的坑**：SW 30 秒空闲即回收 → 监听器顶层同步注册、状态外置 `chrome.storage`、定时用 `alarms`。

**「CDP 的运行原理」**，按这四层讲：
1. **是什么**：JSON-RPC over WebSocket，`{id, method, params}` ↔ `{id, result}` + 无 id 的事件。**DevTools 自己就是它的客户端**，没有额外特权。
2. **怎么连**：`--remote-debugging-port` → `/json/version` 拿 browser 级 ws → `Target.attachToTarget({flatten:true})` 拿 sessionId → 一条连接多路复用所有 target。
3. **谁在执行**：Target/Browser/Network 在 browser 进程，DOM/CSS/Page 在渲染进程的 Blink inspector agent，Runtime/Debugger/Profiler 在 **V8 inspector**（所以 Node 能复用同一套协议，只是少了浏览器专属的那 40 多个 domain）。
4. **注意什么**：`enable` 才有事件且有性能成本；多客户端会被 DevTools 抢占；**端口无认证 = 完全控制权**，只绑 localhost + 独立 profile。

### 一句话总结
> **插件是浏览器从内部开放的一组「有权限校验的特权 API」；CDP 是浏览器从外部开放的一条「无认证的全权控制通道」。DevTools 用的是后者，`chrome.debugger` 则是前者对后者的一层受限转发。**

### 延伸阅读
- [浏览器调试技巧](./浏览器调试.md)
- [浏览器](./浏览器.md)
- [CDP 官方协议文档](https://chromedevtools.github.io/devtools-protocol/)
- 本机随时可查的权威协议定义：`curl localhost:9222/json/protocol`

<!-- KG:AUTO-START 由 scripts/kg.mjs build 生成，请勿手改；关系维护在 frontmatter -->
### 相关内容
- **前置**：[浏览器引擎与渲染原理](./浏览器.md)
- **被引用**：[高级前后端能力地图（AI 时代）](../成长路线/高级前后端能力地图.md)
<!-- KG:AUTO-END -->
