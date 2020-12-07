[如何实现一个 Virtual DOM 算法](https://github.com/livoras/blog/issues/13)
```js
function Element(tagName, props, children) {
    this.tagName = tagName
    this.props = props
    this.children = children
}

Element.prototype.render = function () {
    const el = document.createElement(this.tagName)
    const props = this.props
    for (var propName in props) {
        var propValue = props[propName]
        el.setAttribute(propName, propValue)
    }
    const children = this.children || []
    children.forEach(function (child) {
        const childEl = (child instanceof Element) ? child.render() : document.createTextNode(child)
        el.appendChild(childEl)
    })
    return el
}

function diff(oldTree, newTree) {
    const index = 0
    const patches = {}
    dfsWalk(oldTree, newTree, index, patches)
    return patches
}

function dfsWalk(oldNode, newNode, index, patches) {
    patches[index] = [...]
    diffChild(oldNode.children, newNode.children, index, patches)
}

function diffChild(oldChildren, newChildren, index, patches) {
    let leftNode = null
    let currentNodeIndex = index
    oldChildren.forEach(function (child, i) {
        var newChild = newChildren[i]
        currentNodeIndex = (leftNode && leftNode.count) ? currentNodeIndex + leftNode.count + 1 : currentNodeIndex + 1
        dfsWalk(child, newChild, currentNodeIndex, patches)
        leftNode = child
    })
}

function patch(node, patches) {
    const walker = {index: 0}
    dfsWalk(node, walker, patches)
}

function dfsWalk(node, walker, patches) {
    const currentPatches = patches[walker.index] // 从patches拿出当前节点的差异

    const len = node.childNodes
        ? node.childNodes.length
        : 0
    for (let i = 0; i < len; i++) { // 深度遍历子节点
        var child = node.childNodes[i]
        walker.index++
        dfsWalk(child, walker, patches)
    }

    if (currentPatches) {
        applyPatches(node, currentPatches) // 对当前节点进行DOM操作
    }
}

function applyPatches(node, currentPatches) {
    currentPatches.forEach(function (currentPatch) {
        switch (currentPatch.type) {
            case REPLACE:
                node.parentNode.replaceChild(currentPatch.node.render(), node)
                break
            case REORDER:
                reorderChildren(node, currentPatch.moves)
                break
            case PROPS:
                setProps(node, currentPatch.props)
                break
            case TEXT:
                node.textContent = currentPatch.content
                break
            default:
                throw new Error('Unknown patch type ' + currentPatch.type)
        }
    })
}
```

### 为何采用虚拟DOM
1. 为函数式的 UI 编程方式打开了大门；
- 虚拟DOM是由react引入的概念，react的核心理念就是函数式编程，类似ui = f (a)，其中a是数据，函数f则是react的render，每个a的改动，都会重新生成新的ui。
- 每次生成新的ui就需要重新刷新页面代价太过昂贵，虚拟DOM以及diff算法的引入可以最大限度的复用旧的DOM，使得渲染性能大幅提升。
2. 可以渲染到 DOM 以外的 backend，比如 ReactNative。
- 有了虚拟DOM就可以轻松实现跨平台，多平台的core都相同，只是在render到具体平台的时候采取不同的render就好了


### 虚拟DOM的遍历采用深度遍历算法
深度遍历需要栈结构，可以通过递归（内核维护调用栈）的方式实现，也可以采用人为构造栈，然后循环栈完成深度遍历
广度遍历则采用队列的方式实现，由于广度优先是按照树的层级来遍历的，在遍历某层的时候需要将下一层的数据推进队列里面，所以队列的长度通常会比树的宽度还要宽。
