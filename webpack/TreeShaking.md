### webpack 拆包原理
tree shaking 是一个术语，通常用于描述移除 JavaScript 上下文中的未引用代码(dead-code)。它依赖于 ES2015 模块语法的 静态结构 特性，例如 import 和 export


### 利用ES6 module特点
- 只能作为模块顶层的语句出现
- import 的模块名只能是字符串常量
- import binding 是 immutable的，引入的模块不能再进行更改

### 代码删除
- uglify: 判断程序流，判断变量是否被使用和引用，进而删除代码。
实现原理可以简单概括为：
1. ES6 module引入进行静态分析，故而编译的时候正确判断到底加载了哪些模块
2. 静态分析程序流，判断哪些模块和变量未被使用或者引用，进而删除对应代码


