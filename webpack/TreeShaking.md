### webpack 拆包原理


tree shaking 是一个术语，通常用于描述移除 JavaScript 上下文中的未引用代码(dead-code)。它依赖于 ES2015 模块语法的 静态结构 特性，例如 import 和 export


### ES6 module特点
只能作为模块顶层的语句出现
import 的模块名只能是字符串常量
import binding 是 immutable的
