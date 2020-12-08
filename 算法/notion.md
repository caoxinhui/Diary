BFS(广度优先搜索)
DFS(深度优先搜索)
[二叉树层序遍历](https://github.com/sisterAn/JavaScript-Algorithms/issues/46)
### 二叉树的层次遍历
```
    3
   / \
  9  20
    /  \
   15   7
```

返回其自底向上的层次遍历为
```js
[
  [15,7],
  [9,20],
  [3]
]
```


### 广度优先遍历
BFS 是按层层推进的方式，遍历每一层的节点。题目要求的是返回每一层的节点值，所以这题用 BFS 来做非常合适。
BFS 需要用队列作为辅助结构，我们先将根节点放到队列中，然后不断遍历队列。
```js
const levelOrderBottom = function(root) {
    if(!root) return []
    let res = [], 
        queue = [root]
    while(queue.length) {
        let curr = [],
            temp = []
        while(queue.length) {
            let node = queue.shift()
            curr.push(node.val)
            if(node.left) temp.push(node.left)
            if(node.right) temp.push(node.right)
        }
        res.push(curr)
        queue = temp
    }
    return res.reverse()
};
```

复杂度分析

时间复杂度：O(n)
空间复杂度：O(n)

### 深度优先遍历
DFS 是沿着树的深度遍历树的节点，尽可能深地搜索树的分支

DFS 做本题的主要问题是： DFS 不是按照层次遍历的。为了让递归的过程中同一层的节点放到同一个列表中，在递归时要记录每个节点的深度 depth 。递归到新节点要把该节点放入 depth 对应列表的末尾。

当遍历到一个新的深度 depth ，而最终结果 res 中还没有创建 depth 对应的列表时，应该在 res 中新建一个列表用来保存该 depth 的所有节点。

```js
const levelOrderBottom = function(root) {
    const res = []
    var dep = function (node, depth){
        if(!node) return
        res[depth] = res[depth]||[]
        res[depth].push(node.val)
        dep(node.left, depth + 1)
        dep(node.right, depth + 1)
    }
    dep(root, 0)
    return res.reverse()   
};
```

复杂度分析：

时间复杂度：O(n)
空间复杂度：O(h)，h为树的高度
