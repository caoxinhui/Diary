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

<!-- CHUNK5 -->



