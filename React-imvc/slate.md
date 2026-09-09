---
title: "Slate 原理"
tags: [React, 富文本]
prereq: []
related:
  - React/key.md
  - Javascript/EventLoop.md
deep: []
dup: []
---

# Slate 原理

> 以上游 `main`（slate 0.11x，DOM 层已拆出独立的 `slate-dom` 包）源码为准。注意：**immer 已经被完全移除**，老文章里「Slate 用 immer 的 `produce` 在 draft 上 apply」的说法已经过期。

富文本编辑器的根本矛盾是：`contenteditable` 是一个**你不完全控制的组件**。用户按一个键，浏览器就直接改 DOM，还会顺手做拼写纠正、IME 组词、自动大写；而 React 只认自己 render 出来的那棵树。谁是真相？

Slate 的答案：

> **唯一真相是 `editor.children`（一棵 JSON 树）。任何变化都必须先被翻译成 Operation 打进这棵树，DOM 只是它的投影。**
>
> 但为了不打断 IME 和输入法纠错，Slate 允许 DOM **暂时跑在数据前面**，事后对账——所以它是「半受控」而不是「受控」。

---

## 一、分层

```
┌─ slate ────────── 纯数据层，一行 DOM 代码都没有，可以在 Node 里跑
│    Node / Path / Point / Range / Operation
│    Transforms.*（命令 → 操作）、editor.apply（操作 → 新树）、normalize（不变式）
│
├─ slate-dom ────── DOM ↔ 数据的双向映射（原 slate-react 的一半）
│    DOMEditor.toSlateRange / toDOMRange / findPath / toDOMNode
│    一堆 WeakMap、剪贴板序列化、diff-text（DOM 实际改了什么 → 操作）
│
├─ slate-react ──── React 绑定
│    <Slate>（context + 订阅）、<Editable>（contenteditable + 全部事件）
│    Element / Text / Leaf / String 四层组件、chunking（大文档分块 memo）
│    android-input-manager、RestoreDOM（安卓 IME 专用脏活）
│
└─ slate-history ── 撤销栈：把一个 tick 内的 operations 攒成一个 batch
```

关键：**slate 核心不知道 DOM 存在**。所以同一份数据层可以配 React / Vue / 服务端，`Editable` 只是「一个会把 DOM 事件翻译成命令、再把数据画回 DOM 的组件」。

---

## 二、数据模型

`Editor` 对象上真正可变的状态只有四个字段（`packages/slate/src/interfaces/editor.ts`）：

```ts
{
  children: Descendant[]   // 文档树
  selection: Range | null  // 选区（数据形态，不是 DOM Selection）
  operations: Operation[]  // 本 tick 内已产生的操作，flush 后清空
  marks: EditorMarks | null// 光标上待生效的格式（还没落到文档里）
}
```

其余全是可覆盖的方法（`isInline` / `isVoid` / `normalizeNode` / `apply` / `onChange` / 各种查询），这就是插件机制的全部秘密（见第九节）。

节点是**鸭子类型**，没有 class：

| 类型 | 判据 | 说明 |
| --- | --- | --- |
| `Text` | 有 `text: string` | 叶子。除 `text` 外的所有属性都是 mark（`bold: true`） |
| `Element` | 有 `children: []` | 块或行内元素，其余属性自定义（`type: 'paragraph'`） |
| `Editor` | 有 `apply` 方法 | 树根本身也是一个 Ancestor |

坐标三件套：`Path = number[]`（`[0,1]` = 第 1 个块的第 2 个孩子）、`Point = { path, offset }`、`Range = { anchor, focus }`（带方向，`Range.edges()` 才归一成 start/end）。

**九种 Operation** 是整个系统的原子指令集（`interfaces/operation.ts`），任何编辑都是它们的组合：

| 操作 | 载荷 | 逆操作 |
| --- | --- | --- |
| `insert_text` | `path, offset, text` | `remove_text` |
| `remove_text` | `path, offset, text` | `insert_text` |
| `insert_node` | `path, node` | `remove_node` |
| `remove_node` | `path, node` | `insert_node` |
| `set_node` | `path, properties, newProperties` | 两者对调 |
| `split_node` | `path, position, properties` | `merge_node` at `Path.next(path)` |
| `merge_node` | `path, position, properties` | `split_node` at `Path.previous(path)` |
| `move_node` | `path, newPath` | 重算路径后反向 move |
| `set_selection` | `properties, newProperties` | 两者对调 |

`Operation.inverse` 是一张纯对称表，这是 undo 能白给的原因。用 Path 而不是 id 定位，代价是**任何一次操作都会让别处的路径失效**——于是有了 `Path.transform` 和 refs（第五节）。

---

## 三、主线：在段落中间敲一个 `a`

桌面 Chrome 下，一次按键的完整链路（`packages/slate-react/src/components/editable.tsx`）：

```
用户按键
  │
  ├─① keydown ──────────── 只处理快捷键 / undo，正常字符不管
  │
  ├─② beforeinput ───────── 原生监听（不是 React 合成事件）
  │      onDOMBeforeInput
  │        ├─ flush 掉挂起的 selectionchange（Grammarly / IME 会先改选区）
  │        ├─ 判断能不能走 native 快路径
  │        ├─ 校准 targetRange → 必要时 Transforms.select
  │        ├─ if (!native) event.preventDefault()      ← 唯一的拦截点
  │        └─ inputType → 命令：Editor.insertText('a')
  │
  ├─③ 命令层 ───────────── Editor.insertText → Transforms.insertText
  │                        （包在 Editor.withoutNormalizing 里）
  │                        产出：{ type:'insert_text', path:[0,0], offset:5, text:'a' }
  │
  ├─④ editor.apply(op) ──── 洋葱：withHistory.apply → withDOM.apply → 核心 apply
  │        ├─ 重定位所有 PathRef / PointRef / RangeRef
  │        ├─ 更新 DIRTY_PATHS
  │        ├─ Transforms.transform：真正生成新的 children（结构共享）
  │        ├─ editor.operations.push(op)
  │        ├─ Editor.normalize({ operation })   ← 在 withoutNormalizing 内是空转
  │        └─ 微任务：editor.onChange({ operation }); editor.operations = []
  │
  ├─⑤ normalize ────────── withoutNormalizing 退出时统一跑一遍不变式修复
  │
  ├─⑥ onChange ─────────── <Slate> 的订阅仓库通知 → useSlate 强制 Editable 重渲染
  │                        useChildren 重写 NODE_TO_INDEX / NODE_TO_PARENT
  │
  ├─⑦ 提交 DOM ─────────── React diff。TextString 的 layout effect 比对
  │                        span.textContent，**一致就什么都不写**
  │
  └─⑧ 回写选区 ─────────── Editable 的 layout effect：editor.selection → toDOMRange
                           → setBaseAndExtent；已经一致则直接短路返回
```

`⑦⑧` 两步「什么都不做」正是重点：如果字符是浏览器自己敲进去的（native 路径），DOM 早就对了，Slate 只需要把数据补齐，**绝不重写那个文本节点**——一旦 React 换掉文本节点，原生拼写检查、自动纠错、IME 组词全部失效。

### ② 为什么 `beforeinput` 是原生监听

React 的 `onBeforeInput` 是个 polyfill，拿不到 `inputType` / `getTargetRanges()`，所以 `Editable` 在 `callbackRef` 里手动 `addEventListener('beforeinput')`。React 版的 `onBeforeInput` 只在不支持原生 beforeinput 的浏览器上兜底，且只处理 `insertText`。

`beforeinput` 的价值：它在**浏览器动手之前**触发，且带着 `inputType`（这次到底是插入、删词、还是删整行）和 `getTargetRanges()`（要动的范围）。整个 Slate 的输入拦截就建立在这一个事件上。

`inputType → 命令` 的映射（桌面路径）：

| inputType | 命令 |
| --- | --- |
| `insertText` | `Editor.insertText`（可能走 native 快路径） |
| `insertParagraph` | `Editor.insertBreak` |
| `insertLineBreak` | `Editor.insertSoftBreak` |
| `insertFromPaste` / `Drop` / `Yank` / `insertReplacementText` | `data` 是 `DataTransfer` → `insertData`，是字符串 → `insertText` |
| `deleteContentBackward` / `Forward` | `Editor.deleteBackward` / `deleteForward` |
| `deleteWordBackward` / `Forward` | 同上 + `{ unit: 'word' }` |
| `deleteSoftLineBackward` / `Forward` | 同上 + `{ unit: 'line' }` |
| `deleteHardLineBackward` / `Forward` | 同上 + `{ unit: 'block' }` |
| `deleteEntireSoftLine` | 前后各删一次 `{ unit: 'line' }` |
| `deleteByCut` / `deleteByDrag` / `deleteByComposition` | `Editor.deleteFragment` |
| `historyUndo` / `historyRedo` | `editor.undo()` / `redo()` |
| 其他 | 什么都不做（但已经 `preventDefault`，等于禁掉） |

选区是展开的且是任意 `delete*`，一律走 `Editor.deleteFragment`，不看具体 inputType。

### ③ native 快路径：Slate 故意放手的那一小块

`native = true` 要同时满足（`editable.tsx`）：

- `inputType === 'insertText'`，选区存在且**折叠**；
- `event.data.length === 1` 且匹配 `/[a-z ]/i`——只放单个字母和空格。长按弹出的重音字符会双插；
- `selection.anchor.offset !== 0`——Chrome 在节点开头有 bug（比如紧跟一个行内链接之后）；
- `!editor.marks`——带 mark 的插入会新建文本节点，不只是改字符；
- 节点映射不脏（`IS_NODE_MAP_DIRTY` 为 false），且：不在 `<a>` 末尾、父级不是 `white-space: pre` 且块内无 tab；
- `getTargetRanges()[0]` 转成 Slate Range 后与 `editor.selection` 完全相等。

满足则**不 preventDefault**：浏览器自己改自己的文本节点，Slate 把 `Editor.insertText` 塞进 `deferredOperations`，等 `input` 事件再执行，保证「DOM 先改、数据后补」。任何一条不满足（含所有中文输入、所有带格式输入），就是老老实实 `preventDefault` + 合成命令。

> 所以不要笼统地说「Slate 让浏览器自己打字」。它只放开了 ASCII 单字符这一条缝，纯粹为了保住原生纠错和性能。

### ③ 命令 → 操作：三层职责

```
Editor.insertText(editor, 'a')     命令层：读 selection / marks，决定语义
   └─ Transforms.insertText(...)   变换层：处理 at 定位、展开选区先删除、void 跳过
        └─ editor.apply(op)        操作层：唯一改树的入口
```

`Editor.insertText`（`editor/insert-text.ts`）只有几行，但分岔很关键：

```ts
if (marks) Transforms.insertNodes(editor, { text, ...marks })  // 光标上有待生效格式
else       Transforms.insertText(editor, text)                  // 普通输入
editor.marks = null
```

普通输入的最终产物就是**一个** `insert_text` op。注意选区没有对应的 op——它由 `apply` 里的自动重定位负责（第六节）。

所有 `Transforms.*` 都把自己包在 `Editor.withoutNormalizing` 里：这期间 `NORMALIZING` 标志为 false，每次 `apply` 结尾的 `Editor.normalize` 直接空转；退出时统一 normalize 一次。所以**一次变换 = 一次归一化**，而不是每个 op 一次。

### ④ `editor.apply` 的七步（`core/apply.ts`，就 40 行）

1. **重定位所有 ref**：遍历 `Editor.pathRefs/pointRefs/rangeRefs`，按各自 affinity 调 `PathRef.transform` 等。注意是**在树被改之前**做的；transform 成 `null` 的 ref 自动 `unref`。
2. **更新脏路径**：`editor.getDirtyPaths(op)`（`core/get-dirty-paths.ts`）给出这次操作影响的路径——文本类操作是 `Path.levels(path)`（从根到自己）、`split_node` 额外加 `Path.next(path)`、`insert_node` 加整棵子树、`remove_node` 只加祖先。旧脏路径先经 `Path.transform` 重定位。`DIRTY_PATH_KEYS`（`path.join(',')`）做 O(1) 去重。
3. **改树**：`Transforms.transform(editor, op)`（`interfaces/transforms/general.ts`）是唯一写 `children` 的地方。**没有 immer**：`utils/modify.ts` 手写结构共享——从目标节点往上逐层 `{...ancestor, children: [...]}`，最后只有一处真赋值 `editor.children = ...`。结果是：编辑器对象本身原地可变，编辑器以下全部不可变；**根到被改节点这条链上的对象身份全变，旁支不变**（React memo 就靠这个）。
4. `editor.operations.push(op)`。
5. `Editor.normalize(editor, { operation: op })`——在 `withoutNormalizing` 里是空转。
6. 如果是 `set_selection`，`editor.marks = null`（光标一动，待生效格式作废）。
7. **微任务 flush**：`FLUSHING` 没标记时标记它，然后 `Promise.resolve().then(() => { onChange({operation}); editor.operations = [] })`。

第 7 步就是 Slate 的「批处理」：一个 tick 内不管产生多少 op，`onChange` 只在微任务里调**一次**，`editor.operations` 是这一 tick 的全部 op（`onChange` 的参数只带**最后**一个 op）。想拿全量必须读 `editor.operations`，而且只能在 `onChange` 同步期间读——之后就被清空了。

### ⑤ normalize：文档不变式

`Editor.normalize`（`editor/normalize.ts`）：

- 前置扫一遍：对「children 为空的 Element」先补一个空文本，避免其他归一化规则和它互相等待；
- 主循环用 `Array.pop()` 消费脏路径，即 **LIFO**。因为 `Path.levels` 是浅→深压入的，单个 op 的效果就是「先深后浅」，根路径 `[]` 总是最后处理；
- 熔断在 `core/should-normalize.ts`：`maxIterations = initialDirtyPathsLength * 42`，超了直接 **throw**（不是 warn）。自定义 normalizer 写得不收敛就是这个报错；
- 整个过程也在 `withoutNormalizing` 内，所以归一化产生的 op 不会递归触发归一化。

内置规则（`core/normalize-node.ts`）：

| 规则 | 行为 |
| --- | --- |
| 非文本节点缺 `children` | 直接补 `[]`（不产生 op，纯防御） |
| Element 没有孩子 | 插入 `{ text: '' }`；**编辑器本身豁免**，所以 `children: []` 是稳定但会渲染崩的状态 |
| 相邻两个 Text | 空的删掉；`Text.equals(loose)` 相同格式的合并（`merge_node`） |
| 行内元素 | 前后必须有 Text 相邻，缺就插空文本 |
| 行内容器里出现块 | `unwrapNodes` 拆掉 |
| 块容器（含编辑器）里出现 Text / 行内 | 默认 **`removeNodes` 删掉**；传了 `fallbackElement` 才是包一层 |

最后一条是数据丢失的常见来源：程序化插入裸文本到顶层，会被静默删除。

---

## 四、换个例子：给 `"hello world"` 的 `wor` 加粗

`Editor.addMark(editor, 'bold', true)` 有两条完全不同的路：

**选区折叠**（只是光标）：**一个 op 都不产生**。只写 `editor.marks = { bold: true }`，然后手动调一次 `editor.onChange()`。这意味着：不进 undo 栈、不进 `operations`。下次 `insertText` 时走 `insertNodes({ text, ...marks })` 分支把格式带上，然后 `marks` 清空。中间任何一次点击 / 方向键都会产生 `set_selection`，`apply` 第 6 步就把它作废了——这就是「点了加粗但没打字，格式就没了」的实现原因。

**选区展开**：走 `Transforms.setNodes(editor, {bold:true}, { match: Text.isText, split: true })`，op 序列是：

```js
1. split_node { path:[0,0], position:9 }   // "hello wor" | "ld"      先切尾
2. split_node { path:[0,0], position:6 }   // "hello " | "wor" | "ld" 再切头
3. set_selection { newProperties: { anchor:{path:[0,1],offset:0}, focus:{path:[0,1],offset:3} } }
4. set_node { path:[0,1], properties:{}, newProperties:{ bold: true } }
```

三个细节：

- **先切结束点再切起始点**，否则起始点切完，结束点的 path 就漂了；
- 切之前先 `Editor.rangeRef(at, { affinity: 'inward' })` 存住选区，切完 `unref()` 拿回新坐标——这是 refs 的标准用法；
- `set_node` 只在真的有属性变化时才发（`hasChanges`），`setSelection` 的 diff 为空时也不发。**「一次变换产生 0 个 op」是正常结果**，别假设 transform 一定改了东西。

---

## 五、坐标系统：`Path.transform` 与 refs

`Path.transform(path, op, { affinity })` 是整个系统的数学核心（`interfaces/path.ts`）：给定一条路径和一个操作，算出操作之后它应该在哪。`insert_text` / `remove_text` / `set_node` / `set_selection` 不改变结构，直接原样返回。

以 op 所在的深度对比（`endsBefore` = 同前缀且索引更小，`isAncestor` = op 是 path 的祖先）：

| 操作 | 规则 |
| --- | --- |
| `insert_node` | `equals`/`endsBefore`/`isAncestor` → 该层索引 `+1` |
| `remove_node` | `equals`/`isAncestor` → **`null`**（路径消失）；`endsBefore` → `-1` |
| `merge_node` | `equals`/`endsBefore` → `-1`；`isAncestor` → 该层 `-1`，下一层 `+position` |
| `split_node` | `equals` → forward `+1` / backward 不动 / affinity 为 null 时 `null`；`endsBefore` → `+1`；`isAncestor` 且 `path[深度] >= position` → 该层 `+1`，下一层 `-position` |
| `move_node` | 四种互斥情形，是路径 bug 最常见的出处 |

例子，`path = [0,1]`：

```
split_node @[0,0]              → [0,2]   前面多了个兄弟
insert_node @[0,1]             → [0,2]   自己被顶到后面
insert_node @[0,2]             → [0,1]   不影响
remove_node @[0,1]             → null    自己被删了
split_node @[0] position=1     → [1,0]   父级被切开，自己跑到新父级里
```

`Path.transform` 是**纯函数**，它不记忆。可是一个变换内部往往要跨好几个 op 持有坐标（上面加粗的例子就是），于是有了 `Editor.pathRef / pointRef / rangeRef`：把一个可变格子注册进 WeakMap 里的 Set，`apply` 第 1 步对每个已注册 ref 逐 op 重定位，`ref.current` 永远是最新坐标，`ref.unref()` 取值并注销。

affinity 决定「插入正好落在边界上时算里面还是外面」：`forward`（默认）/ `backward` / `inward` / `outward`。`setNodes` 用 `inward`，`splitNodes` 的 `beforeRef` 用 `backward`，都是为了让格式不外溢。

**选区的自动重定位**：`insert_node` / `insert_text` / `remove_text` / `merge_node` / `split_node` / `move_node` 这六种 op 执行完，`general.ts` 会用 `Point.transform`（默认 forward）重算 `editor.selection` 的 anchor / focus。`set_node` / `set_selection` 不需要；`remove_node` 特殊——它绕过通用逻辑，自己扫 `Node.texts(editor)` 找最近的前/后文本节点来落光标（O(文档) 的线性扫描，也是「删除后光标乱跳」的来源）。

关键的一条 `Point.transform` 规则：同一路径上 `insert_text`，当 `op.offset < offset`，或 `op.offset === offset` 且 affinity 是 forward 时，`offset += text.length`。这就是「在光标处打字，光标跟着往右走」的全部实现。

---

## 六、DOM ↔ 数据：桥是怎么搭的

### 渲染出来的 DOM 约定

组件是四层：`Element` → `Text` → `Leaf`（每个 decoration 切出的叶子一个）→ `String`。

```html
<div data-slate-editor data-slate-node="value" contenteditable="true"
     style="white-space:pre-wrap;word-wrap:break-word">
  <div data-slate-node="element">                <!-- 块 -->
    <span data-slate-node="text">
      <span data-slate-leaf="true">
        <span data-slate-string="true">hello </span>
      </span>
      <span data-slate-leaf="true">
        <span data-slate-string="true"><b>wor</b></span>
      </span>
    </span>
  </div>
  <div data-slate-node="element">                <!-- 空段落 -->
    <span data-slate-node="text"><span data-slate-leaf="true">
      <span data-slate-zero-width="n" data-slate-length="0">&#xFEFF;<br/></span>
    </span></span>
  </div>
</div>
```

标记的用途：

| 标记 | 用途 |
| --- | --- |
| `data-slate-editor` | `hasDOMNode` 判断「这个 DOM 属于我这个编辑器」 |
| `data-slate-node="element\|text\|value"` | `toSlateNode` 沿 DOM 往上找最近的这个属性，再查 `ELEMENT_TO_NODE` |
| `data-slate-leaf` / `data-slate-string` | `toSlatePoint` / `toDOMPoint` 计算 offset 的锚点 |
| `data-slate-zero-width` + `data-slate-length` | 空文本的占位（见下），`length` 让 offset 用**逻辑长度**而不是 DOM 长度 |
| `data-slate-void` / `data-slate-spacer` | void 节点及其零高度占位容器 |
| `data-slate-placeholder` / `data-slate-mark-placeholder` | 占位符、光标待生效格式的隐形锚点 |
| `data-slate-fragment` | 复制时把 Slate 片段 base64 塞进 HTML，粘回来能还原结构 |

**为什么要零宽字符 `﻿` 和 `<br>`**：Slate 认为「空」的叶子在 DOM 里没有文本节点，光标就没地方放，IME 往里组词会直接破坏 `toSlateRange` 依赖的结构（源码注释里同时记着「加了它导致 iOS 自动大写异常」和「不加会崩」两个 bug）。`<br>` 则是因为空块没有行盒会塌掉；标成 `"n"` 的零宽还会在复制时被替换成真正的 `\n`。另外行尾的 `\n` 会被浏览器吞掉，所以 `String` 在最后一个叶子且以 `\n` 结尾时会**多渲染一个 `\n`**，代价是 Firefox 的 offset 要额外补偿一位。

### 半受控的那一个点

整个 Slate 只有一处是命令式写 DOM 的：`TextString` 的 layout effect。它用 `useState(getTextContent)` 只在挂载时取一次初值，之后每次渲染都拿 `ref.current.textContent` 跟数据比，**不一样才写**。注释写得很直白：既然基础插入是浏览器原生完成的，数据流就不再是单向的，所以只能对着真实 DOM diff，否则 React 每次按键都换掉文本节点，原生拼写检查和输入法就失效了。

### WeakMap 表（`slate-dom/src/utils/weak-maps.ts`）

| WeakMap | 作用 |
| --- | --- |
| `NODE_TO_INDEX` / `NODE_TO_PARENT` | **渲染期**写入，`findPath` 靠向上走它们拼出 path |
| `NODE_TO_KEY` | 节点 → `Key` 实例（自增 id 的对象），React key 的来源 |
| `EDITOR_TO_KEY_TO_ELEMENT` | `Key → DOM 元素`，`toDOMNode` 实际查的是这张表（按编辑器隔离） |
| `NODE_TO_ELEMENT` / `ELEMENT_TO_NODE` | 节点 ↔ DOM 双向 |
| `EDITOR_TO_ELEMENT` / `EDITOR_TO_WINDOW` | 编辑器 → contenteditable / window（iframe、shadow DOM 用） |
| `IS_FOCUSED` / `IS_READ_ONLY` / `IS_COMPOSING` | 状态位；`IS_COMPOSING` 是「是否正在组字」的唯一真相 |
| `IS_NODE_MAP_DIRTY` | 数据已变但还没重渲染 → 路径映射不可信的窗口期 |
| `EDITOR_TO_ON_CHANGE` / `EDITOR_TO_FORCE_RENDER` | `<Slate>` 的 onChange 回调 / 强制重渲染句柄 |
| `EDITOR_TO_PENDING_DIFFS` / `_ACTION` / `_SELECTION` | 安卓待对账的输入 |
| `EDITOR_TO_USER_SELECTION` | beforeinput 期间临时挪走选区时，先把用户真实选区存这里 |
| `EDITOR_TO_PENDING_INSERTION_MARKS` / `_USER_MARKS` | IME 期间保证插入的是用户**看到**的格式 |

两个推论值得记住：

1. **`ReactEditor.findPath` 只有在渲染之后才可信**。`NODE_TO_INDEX` / `NODE_TO_PARENT` 是在 `useChildren` 里、也就是 render 期间写的；`IS_NODE_MAP_DIRTY` 标记的就是「数据改了、映射还没更新」的窗口，源码里有三处（选区处理、native 快路径、targetRange 校准）读到它就直接放弃本次处理。所以 `useSelected` 这类要用 `findPath` 的 selector 必须是 deferred，等重渲染写完映射再跑。
2. **React key 必须来自 `NODE_TO_KEY`**。Slate 节点不可变，每次 op 都换新对象，对象身份不能当 key；数组下标一 split/insert 就错位。`withDOM.apply` 会在每个 op 前后把旧 `Key` 重新挂到新节点对象上（`move_node` 用 `PathRef` 追踪）。key 稳定 → React 复用 DOM 子树 → `data-slate-string` 下那个文本节点活着 → 组字、拼写检查、光标全部活着。

### 选区往返

**DOM → 数据**：监听 `document` 的原生 `selectionchange`（不用 React 的 `onSelect`），`debounce(0)` 包着 `throttle(100)` 的处理函数；`beforeinput` 里会先 `.flush()` 这两个，因为有些输入法和插件会在 beforeinput 前一瞬改选区。处理时：映射脏就重排自己、组字中直接跳过、否则 `toSlateRange(exactMatch:false)` → `Transforms.select`。

**数据 → DOM**：`Editable` 里一个**没有依赖数组**的 `useIsomorphicLayoutEffect`，每次渲染后都跑。先短路：把当前 DOM 选区按 `exactMatch:true` 转回 Slate Range，和 `editor.selection` 相等就什么都不做；否则 `toDOMRange` + `setBaseAndExtent`（反向选区要交换 anchor/focus，因为 DOM Range 没有方向），并置 `isUpdatingSelection`，在 `setTimeout` 里复位，避免把自己写选区引发的 `selectionchange` 当成用户操作。组字期间只做 `collapseToEnd()`，绝不设置 range。

---

## 七、IME 与安卓：为什么这块代码最脏

**桌面**：`IS_COMPOSING` 是唯一真相（React state 里的 `isComposing` 只是为了触发重渲染）。有意思的是桌面上 `compositionstart` **不**置位，`compositionupdate` 才置位；`compositionend` 里用 `Promise.resolve().then()` 在微任务里清位，好让同一 tick 的处理函数还看得到「正在组字」。组字期间：composition 类的 `beforeinput` 直接 return（这些事件不可取消，等 `compositionend`）、`selectionchange` 整个跳过、选区回写只做 `collapseToEnd`、占位符不显示。部分浏览器（非 WebKit / 非 iOS / 非微信 / 非 UC）上 composition 的 beforeinput 不可用，就在 `compositionend` 里自己把 `event.data` 插进去。

**安卓**是另一套世界，因为那里 `beforeinput` **不可取消**——`preventDefault` 没用，键盘想改就改。策略变成「先让它改，再对账」：

- `android-input-manager` 把每次 `beforeinput` 变成两种东西之一：**pending diff**（`{path, diff:{start,end,text}}`，存 `EDITOR_TO_PENDING_DIFFS`）或 **pending action**（一个待执行的命令闭包，结构性操作如插段落、删词、粘贴走这条）；
- 攒着不立刻应用，由 `handleUserSelect` 的 200ms 空闲、`compositionend`（25ms 后，或组字仍活着时用 `flushSync` 立刻）、`input` 事件等触发 `flush()`；`flush` 逐个 diff：选中目标范围 → `insertText` / `deleteFragment` → `verifyDiffState` 校验数据里真的变成了 DOM 显示的样子，不一致就整批放弃；
- `diff-text.ts` 负责这套账：`normalizeStringDiff`（收缩到最小差异）、`mergeStringDiffs`（同一叶子里连续按键合成一个 diff）、`transformTextDiff` / `transformPendingRange`（**在 `withDOM.apply` 里、op 应用之前**把所有未 flush 的 diff 重定位）。所以协同编辑的远端 op 可以和本地未落地的 IME 输入交错；
- 一个反直觉的保护：pending diff 落在**空叶子**里且组字还活着时，`flush` 会推迟 50ms 重试——因为应用这个 diff 会卸载那个零宽 span，而 IME 正在它的文本节点里组字，卸载等于静默取消组字。

**RestoreDOM**（只在安卓生效，其他平台是透明壳）是个 class 组件，因为它需要 `getSnapshotBeforeUpdate`——hooks 没有等价物。它在 React 提交 DOM 之**前**，把 MutationObserver 缓冲的结构性变更**反向撤销**（删掉的插回去、加上的移除），把 DOM 还原成 React 上次认识的样子，React 的 diff 才是有效的；`characterData` 变更**不撤销**（改文本会杀掉组字），文本差异交给 pending diff 去补。配合 `useTrackUserInput`：只有和真实 `beforeinput` 处于**同一个 animation frame** 的 mutation 才进缓冲，React 自己和插件造成的变更不会被误撤销。

---

## 八、undo：为什么是「按 tick 批」

`withHistory` 在 `apply` 前拦一刀（`slate-history/src/with-history.ts`）：

- `shouldSave`：`set_selection` **不存**。撤销时的选区靠 batch 的 `selectionBefore` 字段（在 apply 之前抓的 `editor.selection`）恢复；
- 是否合并进上一个 batch：**`editor.operations.includes(lastOp)`** → true。`editor.operations` 是当前还没 flush 的这一 tick 的 op 数组，所以规则就是「**同一个 tick 内的所有 op（包括归一化产生的）合成一条撤销记录**」；
- 跨 tick 只有连续打字会合并（`shouldMerge`：连续 `insert_text` 且 `op.offset === prev.offset + prev.text.length`，退格是镜像条件）；
- 栈上限硬编码 100 个 batch；任何一次保存都清空 redo；
- `undo()` = 取栈顶 batch，`operations.map(Operation.inverse).reverse()` 逐个 apply，全程在 `withoutSaving` + `withoutNormalizing` 里，最后 `setSelection(selectionBefore)`。

推论：归一化的 op 和用户 op 在同一个 batch 里，所以撤销恢复的是**归一化之前**的树。如果自定义 `normalizeNode` 不是幂等/可逆的，undo 会漂。另外前面说的「折叠选区加粗」不产生 op，**撤销不回来**。

---

## 九、插件模型：洋葱式覆盖，不是数组

Slate 没有插件数组，插件就是**函数覆盖**：

```ts
const withImages = editor => {
  const { isVoid, insertData, normalizeNode } = editor   // 抓住上一层
  editor.isVoid = el => el.type === 'image' || isVoid(el)
  editor.insertData = data => { /* 处理图片 */ ; insertData(data) }
  editor.normalizeNode = (entry, options) => {
    const [node, path] = entry
    if (/* 我的不变式被破坏 */) { Transforms.xxx(editor, ...); return }  // 改了就 return
    normalizeNode(entry, options)
  }
  return editor
}

const editor = withImages(withHistory(withReact(createEditor())))
```

`Editor.xxx(editor, ...)` 这些静态方法只是 `editor.xxx(...)` 的转发，所以覆盖一定生效。`normalizeNode` 里改完就 `return` 是硬规矩：op 会把路径重新标脏，`Editor.normalize` 会再调你一次，这个不动点循环就是设计意图——不推进状态就会撞上 `42 × 脏路径数` 的 throw。

`withReact` 本身很薄，只覆盖了 `getChunkSize`（默认关闭分块）、安卓的 `insertText`、React 18 以下的批量更新、`move_node` 的 key 记账。真正的重活在 `withDOM`：per-editor 的 key 表、`addMark/removeMark`（触发安卓 flush + 处理待生效格式）、按行删除（需要 DOM 几何）、`apply`（重定位 pending 状态 + 维护 `NODE_TO_KEY` + 置 `IS_NODE_MAP_DIRTY`）、剪贴板的 `setFragmentData` / `insertData`、`onChange` 里回调 `EDITOR_TO_ON_CHANGE`。

---

## 十、渲染性能：为什么打一个字不会全量重渲染

`useSlate` 的实现就是「往 `<Slate>` 的订阅仓库里塞一个 `forceRender`」，所以**每次变更 `Editable` 自身都会重渲染**。真正省下来的是它下面：

- **三层 memo**：`MemoizedElement` 比 `element` 身份 + 五个 render 回调 + decoration 相等；`MemoizedText` 同构；`MemoizedLeaf` 比 `parent` / `isLast` / `text` / `Text.equals(leaf)`。第三节说过结构共享只换「根到改动点」这条链上的对象，所以旁支的比较全部走廉价的身份相等，直接 bail out；
- **decoration 切分复用**：`useDecorationsByChild` 把父级 decoration 裁给每个孩子，结果写进一个 `useRef` 稳定的外层数组，只替换真正变了的下标，让 memo 的比较大多命中 `list === another`；
- **chunking（可选）**：`editor.getChunkSize` 默认返回 `null`（关闭）。打开后，一个节点的 `children` 上会建一棵扇出为 `chunkSize` 的平衡索引树（缓存在 `KEY_TO_CHUNK_TREE`，用 `Key` 做键所以能跨不可变替换存活），只有被改动的 chunk 及其祖先链失效。量级感受一下：1 万个顶层块、`chunkSize = 6`，不开分块时一次按键要构造 1 万个 React element、调 1 万次 `findKey`、写 2 万个 WeakMap 条目（即使每个 memo 都 bail out）；开了之后只重渲染约 5 层 ≈ 30 个 element。注意它不能让这一趟完全变成亚线性——decoration 切分和叶子遍历还是 O(N)；
- `readOnly` 和 `selected` 故意不参与任何 memo 比较，它们走 context / 订阅。

---

## 十一、踩坑清单

- **`editor.operations` 只在 `onChange` 同步期间有效**，微任务里 `onChange` 之后立刻被清空。`onChange({operation})` 的参数只是这一 tick 的**最后一个** op。
- **`ReactEditor.findPath` 在渲染之前不可信**（`IS_NODE_MAP_DIRTY`）。在 op 之后立刻 `findPath` 可能拿到旧路径或直接抛错。
- 折叠选区上的 `addMark` / `removeMark` **零 op**：不进 undo、不触发 `set_selection`，光标一动就丢。
- 顶层出现裸 Text / 行内节点会被 `normalizeNode` **默认删除**（不是包起来），程序化插入或粘贴时静默丢内容。
- 自定义 normalizer 不收敛 → `Could not completely normalize the editor after N iterations!` **抛异常**，N = 初始脏路径数 × 42。
- `Editor.insertText(editor, text)` 这个**静态方法直接丢掉 options 参数**，需要 options 得用 `Transforms.insertText`。同类陷阱在其他静态方法上也有，用前先看一眼源码。
- 一次变换**可能一个 op 都不产生**（值没变、diff 为空、`setNodes` 折叠选区在非空叶子里会静默 return），不要假设变换必然有效果。
- void 节点：`contentEditable={false}` 只加在**行内** void 上，块级 void 靠 `data-slate-spacer` + 零宽文本放光标；Chrome/Safari 选中 void 时不发 `beforeinput`，要手动补 `deleteBackward({unit:'block'})`。
- **不要把 `<Editable>` 当受控组件**：`initialValue` 只在首次渲染读一次（`useState` 初始化器）。外部要改文档只能通过 `Transforms.*`，直接换 `value` 数组不生效。
- React 18 / StrictMode：chunk 失效集合是在**提交后的 effect** 里清的，就是为了双渲染仍然看得到；反过来有好几张 WeakMap 是在 **render 期间**写的（`IS_READ_ONLY`、`NODE_TO_INDEX`…），严格说是副作用，只因为幂等才被容忍。
- 老资料里的两个过期说法：immer 已被移除（现在是 `utils/modify.ts` 手写结构共享）；DOM 相关工具已从 `slate-react` 拆到 `slate-dom`。

---

## 面试速答

| 问题 | 答法 |
| --- | --- |
| Slate 和 Quill / ProseMirror 的本质区别 | Slate 只提供数据模型 + 操作 + 归一化，渲染完全交给 React，没有自己的视图层；schema 也不是声明式的，靠 `normalizeNode` 用代码表达 |
| 为什么不用 `contenteditable` 的原生行为 | 各浏览器对同一操作产生的 DOM 千差万别。Slate 在 `beforeinput` 拦下来，把 `inputType` 翻译成自己的命令，保证任何平台上数据变化一致 |
| Slate 是受控还是非受控 | 半受控。真相在 `editor.children`，但为了保住 IME / 拼写纠错，ASCII 单字符输入、组字、安卓输入都允许 DOM 先改，事后用 pending diff / textContent 比对补账 |
| 一次输入产生几个 operation | 普通输入 1 个 `insert_text`；带待生效格式是 `split_node` + `insert_node`；加粗一段是 2 × `split_node` + `set_selection` + `set_node`。归一化产生的 op 也算在同一 tick |
| `editor.apply` 做了什么 | 重定位 refs → 更新脏路径 → 结构共享地生成新 `children` → push 到 `operations` → normalize → 微任务里 `onChange` 并清空 `operations` |
| 为什么要 `Path.transform` / `PathRef` | 路径是相对坐标，任何结构操作都会让别处的路径失效。`Path.transform` 是纯函数重算；ref 把它自动化，跨多个 op 持有坐标 |
| 归一化什么时候跑、跑几次 | `Transforms.*` 都包在 `withoutNormalizing` 里，退出时统一跑一次；按脏路径 LIFO 消费（等价于先深后浅），上限 `初始脏路径数 × 42` 次，超了抛错 |
| 撤销的粒度是什么 | 一个 tick 内的所有 op 一条记录（判据是 `editor.operations.includes(lastOp)`）；跨 tick 只有连续打字/退格会合并；选区不进 op，靠 `selectionBefore` 恢复 |
| React key 从哪来，为什么不能用下标 | `NODE_TO_KEY` 里的 `Key` 实例，`withDOM.apply` 负责把旧 key 挂到 op 之后的新节点上。节点不可变所以不能用对象身份，下标一 split/insert 就错位；key 不稳会换掉文本节点，直接打断 IME 和拼写检查 |
| 选区怎么双向同步 | DOM→数据：原生 `selectionchange`（throttle 100ms）→ `toSlateRange` → `Transforms.select`；数据→DOM：`Editable` 的 layout effect → `toDOMRange` → `setBaseAndExtent`，且先反向验证一次，已经一致就短路 |
| 大文档卡顿怎么优化 | 稳定 key + 三层 memo 已经让旁支 bail out；再开 `getChunkSize` 分块，把「构造 N 个 element」降到「重渲染几层 chunk」；decoration 尽量少变、按孩子裁切复用 |
| 为什么空段落里有个看不见的字符 | 空叶子在 DOM 里没有文本节点，光标无处安放、IME 会破坏结构，所以渲染 `﻿`（配 `data-slate-length` 让 offset 用逻辑长度）+ `<br>` 撑起行盒 |

<!-- KG:AUTO-START 由 scripts/kg.mjs build 生成，请勿手改；关系维护在 frontmatter -->
### 相关内容
- **相关**：[React key](../React/key.md)、[EventLoop](../Javascript/EventLoop.md)
<!-- KG:AUTO-END -->
