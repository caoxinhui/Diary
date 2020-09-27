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