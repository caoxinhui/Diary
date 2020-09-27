### 优化 Webpack 的打包体积

terser-webpack-plugin 压缩加速
new TerserPlugin(
  parallel: true   // 多线程
)

项目中使用到的webpack插件
- terser-webpack-plugin 压缩加速
- mini-css-extract-plugin
通过 mini-css-extract-plugin 提取 Chunk 中的 CSS 代码到单独文件，通过optimize-css-assets-webpack-plugin插件 开启 cssnano 压缩 CSS。


