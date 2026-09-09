# 知识图谱

> 本文件由 `node scripts/kg.mjs build` 生成，请勿手改。关系维护在各文件的 frontmatter 里。

- 文件：107 篇
- 关联：154 对
- 已接入图谱：98 篇；孤立：9 篇
- 标签：24 个

## 关系图

只画有关联的节点（孤立节点见文末清单），按目录分组。`前置`/`深入` 有向，`相关`/`重叠` 无向。

```mermaid
graph LR
  subgraph D0["CSS"]
    N0["BFC"]
    N1["CSS3"]
    N2["DOM 树是如何生成的"]
    N3["flex 布局"]
    N4["CSS 画三角形"]
    N5["CSS 基础"]
    N6["CSS 布局"]
    N7["CSS 兼容性检测"]
    N8["水平垂直居中"]
    N9["清除浮动"]
    N10["重排重绘"]
  end
  subgraph D1["ES6"]
    N11["Class 与 Function 的区别"]
    N12["Promise"]
    N13["ES6 方法汇总"]
  end
  subgraph D2["HTTP"]
    N16["HTTP"]
    N17["HTTP2"]
    N18["HTTP头部"]
    N19["TCP＆UDP"]
    N20["三次握手四次挥手"]
    N21["前端缓存"]
    N22["网络安全"]
    N23["页面渲染过程"]
  end
  subgraph D3["Javascript"]
    N24["EventLoop"]
    N25["call,bind,apply"]
    N26["for＆forEach＆forIn＆forOf"]
    N27["let,const,var区别"]
    N28["事件代理"]
    N29["作用域、执行上下文"]
    N30["数组扁平化"]
    N31["深浅拷贝"]
    N32["手写源码实现合集"]
    N33["继承"]
    N34["缓存对比"]
    N35["表单"]
    N37["设计模式"]
    N38["跨域"]
    N39["防抖节流"]
    N40["面向对象"]
  end
  subgraph D4["React"]
    N43["Class-VS-Function-component"]
    N44["ConcurrentMode"]
    N45["Diff"]
    N46["Fiber"]
    N47["Hooks"]
    N48["Redux"]
    N49["VirtualDOM"]
    N50["React key"]
    N51["React 原理：Hooks 与 HOC"]
    N52["React render 阶段（beforeMutation / mutation）"]
    N53["setState"]
    N54["React 中的 this"]
    N55["React 事件机制"]
    N56["React 单页路由"]
    N57["React 原理：render 与 diff"]
    N58["React 性能优化"]
    N59["React 服务端渲染"]
    N60["React 生命周期"]
    N61["React 组件通信"]
    N62["React 调度"]
    N63["React 高阶组件（HOC）"]
  end
  subgraph D5["React-imvc"]
    N41["react-imvc 原理"]
    N42["react-imvc vs Next.js"]
  end
  subgraph D6["Regex"]
    N64["正则"]
  end
  subgraph D7["Typescript"]
    N65["TypeScript 常用语法速查"]
    N66["TypeScript 类型守卫 / 抽象类 / 泛型"]
  end
  subgraph D8["iframe"]
    N67["iframe跨端通信"]
  end
  subgraph D9["java"]
    N68["MySQL / Redis / MongoDB 对比"]
  end
  subgraph D10["webpack"]
    N69["CSS 预处理器与 loader 原理"]
    N70["TreeShaking"]
    N71["Babel 原理"]
    N72["imvc的webpack配置"]
    N73["Webpack 原理"]
    N74["打包工具对比（webpack / Rollup / esbuild / Vite / Rspack / Rolldown / Turbopack）"]
    N75["项目webpack"]
  end
  subgraph D11["微前端"]
    N76["SPA 与路由切换原理"]
    N77["微前端 原理"]
  end
  subgraph D12["性能"]
    N78["性能指标与 Performance Timing"]
    N79["浏览器的进程、线程与事件循环全景"]
    N80["项目介绍"]
    N81["项目性能优化"]
    N82["高并发：Node.js 与 Java 的两条路"]
  end
  subgraph D13["成长路线"]
    N83["高级前后端能力地图（AI 时代）"]
  end
  subgraph D14["操作系统"]
    N85["进程、线程、纤程"]
  end
  subgraph D15["数据结构"]
    N86["ArrayList＆LinkList"]
    N87["数据结构：前缀树 Trie"]
  end
  subgraph D16["模块化"]
    N88["JS 模块化"]
    N89["运行时动态执行 JS 代码"]
  end
  subgraph D17["浏览器"]
    N90["浏览器引擎与渲染原理"]
    N91["浏览器插件与 CDP：两种「操纵浏览器」的方式"]
    N92["浏览器调试"]
  end
  subgraph D18["算法"]
    N93["堆"]
    N94["算法题合集（左程云）"]
    N95["排序算法"]
    N96["深度广度优先"]
  end
  subgraph D19["编程范式"]
    N97["函数式编程"]
  end
  subgraph D20["面试题"]
    N99["h5与APP通信"]
    N102["批量插入 DOM"]
    N105["计时器"]
    N106["计算服务器的时间戳对应中国时区的今天、明天还是其他"]
  end
  N0 ---|相关| N9
  N1 ---|相关| N4
  N1 ---|相关| N7
  N5 ---|相关| N1
  N5 ---|相关| N6
  N6 ---|相关| N3
  N6 ---|相关| N8
  N6 ---|相关| N0
  N8 -->|前置| N3
  N10 -->|前置| N2
  N10 ---|相关| N81
  N12 ---|相关| N32
  N12 ---|相关| N13
  N16 -->|前置| N19
  N16 ---|相关| N22
  N16 -->|深入| N17
  N16 -->|深入| N18
  N19 -->|深入| N20
  N21 -->|前置| N18
  N21 ---|相关| N34
  N21 ---|相关| N81
  N22 ---|相关| N38
  N23 ---|相关| N16
  N24 -->|前置| N29
  N24 -->|前置| N85
  N24 ---|相关| N12
  N24 ---|相关| N105
  N24 -->|深入| N79
  N28 ---|相关| N2
  N29 ---|相关| N27
  N29 ---|相关| N25
  N30 ---|相关| N26
  N30 ---|相关| N13
  N31 ---|相关| N32
  N33 ---|相关| N32
  N35 ---|相关| N64
  N38 -->|前置| N16
  N38 ---|相关| N67
  N38 ---|相关| N99
  N39 ---|相关| N32
  N39 ---|相关| N81
  N40 ---|相关| N11
  N40 -->|深入| N33
  N41 ---|相关| N42
  N41 --> N42
  N41 --> N59
  N41 --> N56
  N42 --> N59
  N42 --> N56
  N43 ---|相关| N54
  N43 ---|相关| N11
  N43 ---|相关| N60
  N45 ---|相关| N50
  N46 -->|前置| N49
  N46 -->|深入| N44
  N46 -->|深入| N62
  N46 -->|深入| N52
  N47 -->|前置| N43
  N47 ---|相关| N60
  N47 ---|相关| N63
  N47 ---|相关| N51
  N49 ---|相关| N50
  N49 -->|深入| N45
  N53 -->|前置| N60
  N53 ---|相关| N62
  N53 ---|相关| N52
  N54 -->|前置| N25
  N55 -->|前置| N28
  N56 ---|相关| N76
  N57 ---|相关| N49
  N57 -.-|重叠| N51
  N58 ---|相关| N45
  N58 ---|相关| N50
  N58 ---|相关| N81
  N59 ---|相关| N41
  N59 ---|相关| N23
  N61 ---|相关| N48
  N61 ---|相关| N63
  N62 -->|前置| N24
  N66 ---|相关| N65
  N67 ---|相关| N77
  N69 ---|相关| N5
  N69 --> N71
  N69 --> N73
  N70 -->|前置| N88
  N71 --> N73
  N71 --> N70
  N72 -->|前置| N73
  N72 ---|相关| N41
  N73 -->|前置| N88
  N73 ---|相关| N74
  N73 ---|相关| N75
  N73 -->|深入| N71
  N73 -->|深入| N70
  N73 -->|深入| N69
  N73 --> N74
  N73 --> N70
  N74 --> N71
  N74 --> N70
  N74 --> N69
  N75 ---|相关| N72
  N76 --> N77
  N77 -->|前置| N76
  N77 ---|相关| N89
  N77 --> N89
  N79 -.-|重叠| N23
  N79 --> N82
  N79 --> N92
  N79 --> N90
  N81 -->|前置| N78
  N81 ---|相关| N70
  N81 ---|相关| N80
  N82 -->|前置| N24
  N82 ---|相关| N68
  N82 --> N85
  N83 ---|相关| N90
  N83 ---|相关| N46
  N83 ---|相关| N82
  N83 ---|相关| N68
  N83 ---|相关| N73
  N83 --> N24
  N83 --> N29
  N83 --> N12
  N83 --> N66
  N83 --> N90
  N83 --> N23
  N83 --> N10
  N83 --> N105
  N83 --> N46
  N83 --> N62
  N83 --> N51
  N83 --> N58
  N83 --> N73
  N83 --> N70
  N83 --> N74
  N83 --> N88
  N83 --> N78
  N83 --> N79
  N83 --> N81
  N83 --> N91
  N83 --> N16
  N83 --> N22
  N83 --> N21
  N83 --> N19
  N83 --> N77
  N83 --> N37
  N83 --> N89
  N83 --> N82
  N83 --> N68
  N83 --> N34
  N85 ---|相关| N79
  N87 ---|相关| N86
  N87 ---|相关| N96
  N88 -->|深入| N89
  N88 --> N89
  N88 --> N77
  N90 ---|相关| N23
  N90 ---|相关| N2
  N90 -->|深入| N79
  N91 -->|前置| N90
  N91 --> N92
  N91 --> N90
  N92 ---|相关| N78
  N95 ---|相关| N93
  N95 ---|相关| N94
  N96 ---|相关| N94
  N97 ---|相关| N37
  N97 ---|相关| N32
  N102 -->|前置| N10
  N106 ---|相关| N105
```

## 按标签检索

### React（23）

[react-imvc 原理](React-imvc/原理.md) · [react-imvc vs Next.js](React-imvc/对比-Next.js.md) · [Class-VS-Function-component](React/Class-VS-Function-component.md) · [ConcurrentMode](React/ConcurrentMode.md) · [Diff](React/Diff.md) · [Fiber](React/Fiber.md) · [Hooks](React/Hooks.md) · [React key](React/key.md) · [React 原理：Hooks 与 HOC](React/react原理.md) · [Redux](React/Redux.md) · [React render 阶段（beforeMutation / mutation）](React/render.md) · [setState](React/setState.md) · [React 中的 this](React/this.md) · [VirtualDOM](React/VirtualDOM.md) · [React 事件机制](React/事件机制.md) · [React 单页路由](React/单页路由.md) · [React 原理：render 与 diff](React/原理.md) · [React 性能优化](React/性能优化.md) · [React 服务端渲染](React/服务端渲染.md) · [React 生命周期](React/生命周期.md) · [React 组件通信](React/组件通信.md) · [React 调度](React/调度.md) · [React 高阶组件（HOC）](React/高阶组件.md)

### JavaScript（21）

[Class 与 Function 的区别](ES6/Class-Function.md) · [Promise](ES6/Promise.md) · [ES6 方法汇总](ES6/方法汇总.md) · [call,bind,apply](Javascript/call,bind,apply.md) · [EventLoop](Javascript/EventLoop.md) · [for&forEach&forIn&forOf](Javascript/for&forEach&forIn&forOf.md) · [let,const,var区别](Javascript/let,const,var区别.md) · [事件代理](Javascript/事件代理.md) · [作用域、执行上下文](Javascript/作用域、执行上下文.md) · [数组扁平化](Javascript/数组扁平化.md) · [深浅拷贝](Javascript/深浅拷贝.md) · [手写源码实现合集](Javascript/源码实现.md) · [视区](Javascript/视区.md) · [继承](Javascript/继承.md) · [缓存对比](Javascript/缓存对比.md) · [表单](Javascript/表单.md) · [设计模式](Javascript/设计模式.md) · [跨域](Javascript/跨域.md) · [防抖节流](Javascript/防抖节流.md) · [面向对象](Javascript/面向对象.md) · [正则](Regex/正则.md)

### CSS（11）

[BFC](CSS/BFC.md) · [CSS3](CSS/CSS3.md) · [DOM 树是如何生成的](CSS/DOM.md) · [flex 布局](CSS/flex.md) · [CSS 画三角形](CSS/三角形.md) · [CSS 基础](CSS/基础.md) · [CSS 布局](CSS/布局.md) · [CSS 兼容性检测](CSS/检测兼容性.md) · [水平垂直居中](CSS/水平垂直居中.md) · [清除浮动](CSS/清除浮动.md) · [重排重绘](CSS/重排重绘.md)

### 工程化（11）

[Git](Git/Git.md) · [VSCode 使用与配置](Git/vscode.md) · [Babel 原理](webpack/babel原理.md) · [CSS 预处理器与 loader 原理](webpack/CSS预处理器与loader原理.md) · [imvc的webpack配置](webpack/imvc的webpack配置.md) · [TreeShaking](webpack/TreeShaking.md) · [Webpack 原理](webpack/webpack原理.md) · [打包工具对比（webpack / Rollup / esbuild / Vite / Rspack / Rolldown / Turbopack）](webpack/打包工具对比.md) · [项目webpack](webpack/项目webpack.md) · [JS 模块化](模块化/模块化.md) · [运行时动态执行 JS 代码](模块化/运行时动态执行代码.md)

### 面试题（9）

[baidu](面试题/baidu.md) · [h5与APP通信](面试题/h5与APP通信.md) · [头条](面试题/头条.md) · [小红书](面试题/小红书.md) · [批量插入 DOM](面试题/批量插入DOM.md) · [网易](面试题/网易.md) · [腾讯](面试题/腾讯.md) · [计时器](面试题/计时器.md) · [计算服务器的时间戳对应中国时区的今天、明天还是其他](面试题/计算服务器的时间戳对应中国时区的今天、明天还是其他.md)

### 网络（8）

[HTTP](HTTP/HTTP.md) · [HTTP2](HTTP/HTTP2.md) · [HTTP头部](HTTP/HTTP头部.md) · [TCP&UDP](HTTP/TCP&UDP.md) · [三次握手四次挥手](HTTP/三次握手四次挥手.md) · [前端缓存](HTTP/前端缓存.md) · [网络安全](HTTP/网络安全.md) · [页面渲染过程](HTTP/页面渲染过程.md)

### 构建（7）

[Babel 原理](webpack/babel原理.md) · [CSS 预处理器与 loader 原理](webpack/CSS预处理器与loader原理.md) · [imvc的webpack配置](webpack/imvc的webpack配置.md) · [TreeShaking](webpack/TreeShaking.md) · [Webpack 原理](webpack/webpack原理.md) · [打包工具对比（webpack / Rollup / esbuild / Vite / Rspack / Rolldown / Turbopack）](webpack/打包工具对比.md) · [项目webpack](webpack/项目webpack.md)

### 性能（5）

[性能指标与 Performance Timing](性能/性能时间.md) · [浏览器的进程、线程与事件循环全景](性能/浏览器.md) · [项目介绍](性能/项目介绍.md) · [项目性能优化](性能/项目性能优化.md) · [高并发：Node.js 与 Java 的两条路](性能/高并发.md)

### 浏览器（4）

[iframe跨端通信](iframe/iframe跨端通信.md) · [浏览器引擎与渲染原理](浏览器/浏览器.md) · [浏览器插件与 CDP：两种「操纵浏览器」的方式](浏览器/浏览器插件与CDP.md) · [浏览器调试](浏览器/浏览器调试.md)

### 算法（4）

[堆](算法/堆.md) · [算法题合集（左程云）](算法/左程云.md) · [排序算法](算法/排序.md) · [深度广度优先](算法/深度广度优先.md)

### ES6（3）

[Class 与 Function 的区别](ES6/Class-Function.md) · [Promise](ES6/Promise.md) · [ES6 方法汇总](ES6/方法汇总.md)

### 架构（3）

[SPA 与路由切换原理](微前端/SPA路由原理.md) · [微前端 原理](微前端/原理.md) · [高级前后端能力地图（AI 时代）](成长路线/高级前后端能力地图.md)

### Git（2）

[Git](Git/Git.md) · [VSCode 使用与配置](Git/vscode.md)

### 同构（2）

[react-imvc 原理](React-imvc/原理.md) · [react-imvc vs Next.js](React-imvc/对比-Next.js.md)

### TypeScript（2）

[TypeScript 类型守卫 / 抽象类 / 泛型](Typescript/index.md) · [TypeScript 常用语法速查](Typescript/InterfaceVStype.md)

### 微前端（2）

[SPA 与路由切换原理](微前端/SPA路由原理.md) · [微前端 原理](微前端/原理.md)

### 操作系统（2）

[Docker](操作系统/Docker.md) · [进程、线程、纤程](操作系统/纤程.md)

### 数据结构（2）

[ArrayList&LinkList](数据结构/ArrayList&LinkList.md) · [数据结构：前缀树 Trie](数据结构/数据结构.md)

### 模块化（2）

[JS 模块化](模块化/模块化.md) · [运行时动态执行 JS 代码](模块化/运行时动态执行代码.md)

### 正则（1）

[正则](Regex/正则.md)

### 后端（1）

[MySQL / Redis / MongoDB 对比](java/数据库.md)

### 成长路线（1）

[高级前后端能力地图（AI 时代）](成长路线/高级前后端能力地图.md)

### AI（1）

[高级前后端能力地图（AI 时代）](成长路线/高级前后端能力地图.md)

### 编程范式（1）

[函数式编程](编程范式/函数式编程.md)

## 内容重叠，待合并

- React 原理：Hooks 与 HOC（`React/react原理.md`） ⇄ React 原理：render 与 diff（`React/原理.md`）
- 页面渲染过程（`HTTP/页面渲染过程.md`） ⇄ 浏览器的进程、线程与事件循环全景（`性能/浏览器.md`）

## 待连接（还没有任何关联）

9 篇。每次挑几篇，在 frontmatter 里补 `related` / `prereq` / `deep`，再跑一次 build。

- **Git**：[Git](Git/Git.md)、[VSCode 使用与配置](Git/vscode.md)
- **Javascript**：[视区](Javascript/视区.md)
- **操作系统**：[Docker](操作系统/Docker.md)
- **面试题**：[baidu](面试题/baidu.md)、[头条](面试题/头条.md)、[小红书](面试题/小红书.md)、[网易](面试题/网易.md)、[腾讯](面试题/腾讯.md)
