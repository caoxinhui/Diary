### Hooks 
赋予函数组件类组件的能力
useImperativeHandle

### react渲染原理


### react-loadable
组件解决

### 渲染劫持


React做了什么
- Virtual Dom模型
- 生命周期管理
- setState机制
- Diff算法
- React patch、事件系统
- React的 Virtual Dom模型



**JSX 如何生成Element**
React 为了方便 View 层组件化，承载了构建 html 结构化页面的职责。将 html 语法直接加入到 javascript 代码中，再通过翻译器转换到纯 javascript 后由浏览器执行。
这里调用了 React 和 createElement 方法，这个方法就是用于创建虚拟元素 Virtual Dom 的。React 把真实的 DOM 树转换成 Javascript 对象树，也就是 Virtual Dom。 每次数据更新后，重新计算 Virtual Dom ，并和上一次生成的 virtual dom 做对比，对发生变化的部分做批量更新。而 React 是通过创建与更新虚拟元素 Virtual Element 来管理整个Virtual Dom 的。虚拟元素可以理解为真实元素的对应，它的构建与更新都是在内存中完成的，并不会真正渲染到 dom 中去。
                                         
这里 CreateElement 只是做了简单的参数修正，返回一个 ReactElemet 实例对象。
Virtual element 彼此嵌套和混合，就得到了一颗 virtual dom 的树

**Element 如何生成DOM**

现在我们有了由 ReactElement 组成的 Virtual Dom 树，接下来我们要怎么我们构建好的 Virtual dom tree 渲染到真正的 DOM 里面呢？
这时可以利用 ReactDOM.render 方法，传入一个 reactElement 和一个 作为容器的 DOM 节点。
看进去 ReactDOM.render 的源码，里面有两个比较关键的步骤:

第一步是 instantiateReactComponent。
instantiateReactComponent 方法是初始化组件的入口函数，它通过判断 node 的类型来区分不同组件的入口。

`当 node 为空的时候，初始化空组件。
当 node 为对象，类型 type 字段标记为是字符串，初始化 DOM 标签。否则初始化自定义组件。
当 node 为字符串或者数字时，初始化文本组件。`

创建了 Component 实例后，调用 component 的 mountComponent 方法，注意到这里是会被批量 mount 的，这样组件就开始进入渲染到 DOM 的流程了。


React 组件基本由三个部分组成，

- 属性 props
- 状态 state
- 生命周期方法

React 组件可以接受参数props, 也有自身状态 state。
一旦接受到的参数 props 或自身状态 state 有所改变，React 组件就会执行相应的生命周期方法。


React diff算法制定了三条策略，将算法复杂度从 O(n3)降低到O(n)。

1. UI中的DOM节点跨节点的操作特别少，可以忽略不计。
2. 拥有相同类的组件会拥有相似的DOM结构。拥有不同类的组件会生成不同的DOM结构。
3. 同一层级的子节点，可以根据唯一的ID来区分。


1. Tree Diff
对于策略一，React 对树进行了分层比较，两棵树只会对同一层次的节点进行比较。只会对相同层级的 DOM 节点进行比较，当发现节点已经不存在时，则该节点及其子节点会被完全删除，不会用于进一步的比较。如果出现了 DOM 节点跨层级的移动操作。
2. Element Diff
当节点处于同一层级时，diff 提供了 3 种节点操作：插入、移动和删除。
对于同一层的同组子节点添加唯一 key 进行区分

对新集合中的节点进行循环遍历，新旧集合中是否存在相同节点
nextIndex: 新集合中当前节点的位置
lastIndex: 访问过的节点在旧集合中最右的位置（最大位置）
If (child._mountIndex < lastIndex)


dangerouslySetInnerHTML 是 React 为浏览器 DOM 提供 innerHTML 的替换方案。通常来讲，使用代码直接设置 HTML 存在风险，因为很容易无意中使用户暴露于跨站脚本（XSS）的攻击。因此，你可以直接在 React 中设置 HTML