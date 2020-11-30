webpack核心概念
- entry 一个可执行模块或库的入口文件。
- chunk 多个文件组成的一个代码块，例如把一个可执行模块和它所有依赖的模块组合和一个 chunk 这体现了webpack的打包机制。
- loader 文件转换器，例如把es6转换为es5，scss转换为css。
- plugin 插件，用于扩展webpack的功能，在webpack构建生命周期的节点上加入扩展hook为webpack加入功能。

webpack构建流程
- 解析webpack配置参数，合并从shell传入和webpack.config.js文件里配置的参数，生产最后的配置结果。
- 注册所有配置的插件，好让插件监听webpack构建生命周期的事件节点，以做出对应的反应。
- 从配置的entry入口文件开始解析文件构建AST语法树，找出每个文件所依赖的文件，递归下去。
- 在解析文件递归的过程中根据文件类型和loader配置找出合适的loader用来对文件进行转换。
- 递归完后得到每个文件的最终结果，根据entry配置生成代码块chunk。
- 输出所有chunk到文件系统。

### 获取模块内容
```js
const fs = require('fs')
const getModuleInfo = (file)=>{
    const body = fs.readFileSync(file,'utf-8')
    console.log(body);
}
getModuleInfo("./src/index.js")
```

### 分析模块
安装`@babel/parser` 分析模块的主要任务是 将获取到的模块内容 解析成AST语法树
```js
// 获取主入口文件
const fs = require('fs')
const parser = require('@babel/parser')
const getModuleInfo = (file)=>{
    const body = fs.readFileSync(file,'utf-8')
    const ast = parser.parse(body,{
        sourceType:'module' //表示我们要解析的是ES模块
    });
    console.log(ast);
}
getModuleInfo("./src/index.js")
```
当前我们解析出来的不单单是index.js文件里的内容，它也包括了文件的其他信息。 而它的内容其实是它的属性program里的body里

### 收集依赖
安装`@babel/traverse`。遍历AST，将用到的依赖收集起来
```js
const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const getModuleInfo = (file)=>{
    const body = fs.readFileSync(file,'utf-8')
    const ast = parser.parse(body,{
        sourceType:'module' //表示我们要解析的是ES模块
    });
    
    // 新增代码
    const deps = {}
    traverse(ast,{
        ImportDeclaration({node}){
            const dirname = path.dirname(file)
            const abspath = './' + path.join(dirname,node.source.value)
            deps[node.source.value] = abspath
        }
    })
    console.log(deps);
}
getModuleInfo("./src/index.js")
```

### ES6转成ES5（AST）
把ES6的AST转化成ES5的AST`npm install @babel/core @babel/preset-env`
```js
const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')
const getModuleInfo = (file)=>{
    const body = fs.readFileSync(file,'utf-8')
    const ast = parser.parse(body,{
        sourceType:'module' //表示我们要解析的是ES模块
    });
    const deps = {}
    traverse(ast,{
        ImportDeclaration({node}){
            const dirname = path.dirname(file)
            const abspath = "./" + path.join(dirname,node.source.value)
            deps[node.source.value] = abspath
        }
    })
    
    新增代码
    const {code} = babel.transformFromAst(ast,null,{
        presets:["@babel/preset-env"]
    })
    console.log(code);

}
getModuleInfo("./src/index.js")
```
### 递归获取所有依赖
```js
const getModuleInfo = (file)=>{
    const body = fs.readFileSync(file,'utf-8')
    const ast = parser.parse(body,{
        sourceType:'module' //表示我们要解析的是ES模块
    });
    const deps = {}
    traverse(ast,{
        ImportDeclaration({node}){
            const dirname = path.dirname(file)
            const abspath = "./" + path.join(dirname,node.source.value)
            deps[node.source.value] = abspath
        }
    })
    const {code} = babel.transformFromAst(ast,null,{
        presets:["@babel/preset-env"]
    })
    // 新增代码
    const moduleInfo = {file,deps,code}
    return moduleInfo
}
```
