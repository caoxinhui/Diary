[参考文献](http://47.98.159.95/my_blog/css/008.html)
### 什么是BFC
>W3C对BFC的定义如下： 浮动元素和绝对定位元素，非块级盒子的块级容器（例如 inline-blocks, table-cells, 和 table-captions），以及overflow值不为"visiable"的块级盒子，都会为他们的内容创建新的BFC（Block Fromatting Context， 即块级格式上下文）


### 触发条件
1. 根元素()
2. 浮动元素（元素的 float 不是 none）
3. 绝对定位元素（元素的 position 为 absolute 或 fixed）
4. 行内块元素（元素的 display 为 inline-block）
5. 表格单元格（元素的 display为 table-cell，HTML表格单元格默认为该值）
6. 表格标题（元素的 display 为 table-caption，HTML表格标题默认为该值）
7. 匿名表格单元格元素（元素的 display为 table、table-row、 table-row-group、table-header-group、table-footer-group（分别是HTML table、row、tbody、thead、tfoot的默认属性）或 inline-table）
8. overflow 值不为 visible 的块元素 -弹性元素（display为 flex 或 inline-flex元素的直接子元素）
9. 网格元素（display为 grid 或 inline-grid 元素的直接子元素） 等等


### BFC渲染规则
1. BFC垂直方向边距重叠

2. BFC的区域不会与浮动元素的box重叠

3. BFC是一个独立的容器，外面的元素不会影响里面的元素

4. 计算BFC高度的时候浮动元素也会参与计
