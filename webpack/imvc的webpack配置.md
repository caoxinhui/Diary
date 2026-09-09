---
title: "imvc的webpack配置"
tags: [构建, 工程化]
prereq:
  - webpack/webpack原理.md
related:
  - React-imvc/原理.md
deep: []
dup: []
---

### DefinePlugin
允许在 编译时 创建配置的全局常量，这在需要区分开发模式与生产模式进行不同的操作时，非常有用。例如，如果想在开发构建中进行日志记录，而不在生产构建中进行，就可以定义一个全局常量去判断是否记录日志

<!-- KG:AUTO-START 由 scripts/kg.mjs build 生成，请勿手改；关系维护在 frontmatter -->
### 相关内容
- **前置**：[Webpack 原理](./webpack原理.md)
- **相关**：[react-imvc 原理](../React-imvc/原理.md)、[项目webpack](./项目webpack.md)
<!-- KG:AUTO-END -->
