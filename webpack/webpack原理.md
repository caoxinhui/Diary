### webpack核心概念
- entry 一个可执行模块或库的入口文件。
- chunk 多个文件组成的一个代码块，例如把一个可执行模块和它所有依赖的模块组合和一个 chunk 这体现了webpack的打包机制。
- loader 文件转换器，例如把es6转换为es5，scss转换为css。
- plugin 插件，用于扩展webpack的功能，在webpack构建生命周期的节点上加入扩展hook为webpack加入功能。

### webpack构建流程
- 解析webpack配置参数，合并从`shell`传入和`webpack.config.js`文件里配置的参数，生产最后的配置结果。
- 注册所有配置的插件，好让插件监听webpack构建生命周期的事件节点，以做出对应的反应，实例化 Compiler。
- 从配置的entry入口文件开始解析文件构建AST语法树，找出每个文件所依赖的文件，递归下去。
- 在解析文件递归的过程中根据文件类型和loader配置找出合适的loader用来对文件进行转换。
- 递归完后得到每个文件的最终结果，根据entry配置生成代码块chunk。
- 输出所有chunk到文件系统。


#### 初始化阶段
|事件名|解释|
| ---- |---- |
|初始化参数|从配置文件和 Shell 语句中读取与合并参数，得出最终的参数。 这个过程中还会执行配置文件中的插件实例化语句 new Plugin()。|
|实例化 Compiler|用上一步得到的参数初始化 Compiler 实例，Compiler 负责文件监听和启动编译。Compiler 实例中包含了完整的 Webpack 配置，全局只有一个 Compiler 实例。|
|加载插件|依次调用插件的 apply 方法，让插件可以监听后续的所有事件节点。同时给插件传入 compiler 实例的引用，以方便插件通过 compiler 调用 Webpack 提供的 API。|
|environment|开始应用 Node.js 风格的文件系统到 compiler 对象，以方便后续的文件寻找和读取。|
|entry-option|读取配置的 Entrys，为每个 Entry 实例化一个对应的 EntryPlugin，为后面该 Entry 的递归解析工作做准备。|
|after-plugins|调用完所有内置的和配置的插件的 apply 方法。|
|after-resolvers|根据配置初始化完 resolver，resolver 负责在文件系统中寻找指定路径的文件。|


#### 编译阶段
|事件名|解释|
| ---- |---- |
|before-run|清除缓存|
|run|启动一次新的编译。|
|watch-run|和 run 类似，区别在于它是在监听模式下启动的编译，在这个事件中可以获取到是哪些文件发生了变化导致重新启动一次新的编译。|
|compile|该事件是为了告诉插件一次新的编译将要启动，同时会给插件带上 compiler 对象。|
|compilation|当 Webpack 以开发模式运行时，每当检测到文件变化，一次新的 Compilation 将被创建。一个 Compilation 对象包含了当前的模块资源、编译生成资源、变化的文件等。Compilation 对象也提供了很多事件回调供插件做扩展。|
|make|一个新的 Compilation 创建完毕，即将从 Entry 开始读取文件，根据文件类型和配置的 Loader 对文件进行编译，编译完后再找出该文件依赖的文件，递归的编译和解析。|
|after-compile|一次 Compilation 执行完成。这里会根据编译结果 合并出我们最终生成的文件名和文件内容。|
|invalid|当遇到文件不存在、文件编译错误等异常时会触发该事件，该事件不会导致 Webpack 退出。|

这里主要最重要的就是compilation过程，compilation 实际上就是调用相应的 loader 处理文件生成 chunks并对这些 chunks 做优化的过程。几个关键的事件（Compilation对象this.hooks中）：

|事件名|解释|
| ---- |---- |
|build-module|使用对应的 Loader 去转换一个模块。|
|normal-module-loader|在用 Loader 对一个模块转换完后，使用 acorn 解析转换后的内容，输出对应的抽象语法树（AST），以方便 Webpack 后面对代码的分析。|
|program|从配置的入口模块开始，分析其 AST，当遇到 require 等导入其它模块语句时，便将其加入到依赖的模块列表，同时对新找出的依赖模块递归分析，最终搞清所有模块的依赖关系。|
|seal|所有模块及其依赖的模块都通过 Loader 转换完成后，根据依赖关系开始生成 Chunk|





#### 输出阶段
|事件名|解释|
| ---- |---- |
|should-emit|所有需要输出的文件已经生成好，询问插件哪些文件需要输出，哪些不需要。|
|emit|确定好要输出哪些文件后，执行文件输出，可以在这里获取和修改输出内容。|
|after-emit|文件输出完毕。|
|done|成功完成一次完成的编译和输出流程。|
|failed|如果在编译和输出流程中遇到异常导致 Webpack 退出时，就会直接跳转到本步骤，插件可以在本事件中获取到具体的错误原因。|


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
