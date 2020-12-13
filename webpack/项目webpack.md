### 优化 Webpack 的打包体积

terser-webpack-plugin 压缩加速
new TerserPlugin(
  parallel: true   // 多线程
)

项目中使用到的webpack插件
- terser-webpack-plugin 压缩加速
- mini-css-extract-plugin
通过 mini-css-extract-plugin 提取 Chunk 中的 CSS 代码到单独文件，通过optimize-css-assets-webpack-plugin插件 开启 cssnano 压缩 CSS。


[webpack面试题](https://juejin.im/post/5e6f4b4e6fb9a07cd443d4a5)
[webpack源码](https://juejin.im/post/5e1b2f77e51d454d5177a69d)


### 代码分离
常用的代码分离方法有三种
1. 入口起点：使用 entry 配置手动地分离代码。
2. 防止重复：使用 SplitChunksPlugin 去重和分离 chunk。
3. 动态导入：通过模块的内联函数调用来分离代码。


`loader`有如下几种固定的运用规则：
- 使用test正则来匹配相应的文件
- 使用use来添加文件对应的loader
- 对于多个loader而言，从 右到左 依次调用


### 图片webpack配置
将小于限制值的资源转为base64格式
好处：
1. 减少网络请求次数、提前加载图片
缺点：
1. 图片太大，数据太大，加载过慢
2. base64资源不会有缓存
```json
{
        test: /\.(jpe?g|png|svg|gif|ico)$/,
        use: [
          {
            loader: "url-loader",
            options: {
              limit: 8192,
              fallback: "file-loader",
              name: "[name].[ext]",
              outputPath: "file",
              publicPath: `../file`
            }
          }
        ]
      }
```


[学习文档](https://wangtunan.github.io/blog/webpack/core.html#entry%E5%92%8Coutput%E7%9A%84%E5%9F%BA%E7%A1%80%E9%85%8D%E7%BD%AE)

