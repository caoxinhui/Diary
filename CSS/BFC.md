[参考文献](http://47.98.159.95/my_blog/css/008.html)
### 什么是BFC
> W3C对BFC的定义如下： 浮动元素和绝对定位元素，非块级盒子的块级容器（例如 inline-blocks, table-cells, 和 table-captions），以及overflow值不为"visiable"的块级盒子，都会为他们的内容创建新的BFC（Block Fromatting Context， 即块级格式上下文）


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


### 边距重叠
相邻的两个盒子（可能是兄弟关系也可能是祖先关系）的外边距可以结合成一个单独的外边距。 这种合并外边距的方式被称为折叠，结合而成的外边距称为折叠外边距。
#### 折叠结果遵循下列计算原则：
- 两个相邻的外面边距是正数时，折叠结果就是他们之中的较大值；
- 两个相邻的外边距都是负数时，折叠结果是两者绝对值的较大值；
- 两个外边距一正一负时，折叠结果是两者的相加的和；

有三种情况会形成外边距重叠：

1. 同一层相邻元素之间，相邻的两个元素之间的外边距重叠，除非后一个元素加上clear-fix清除浮动。
2. 没有内容将父元素和后代元素分开

```html
<div class="container">
  <div class="inner"></div>
  <div class="inner"></div>
</div>
.container{
  display: inline-block;
  border: 1px solid grey;
}
.inner{
  width: 20px;
  height: 20px;
  margin: 20px;
  border: 1px solid grey;
  background: lightblue;
}
```
👇通过设置container为 display: inline-block使其产生BFC，这样，两个inner就在不同的BFC下，边距就不会重叠
```html
<div class="container">
  <div class="inner"></div>
  <div class="container1">
     <div class="inner"></div>
  </div>
</div>
.container{
  display: inline-block;
  border: 1px solid grey;
}
.container1{
  display: inline-block;
}
.inner{
  width: 20px;
  height: 40px;
  margin: 40px;
  border: 1px solid grey;
  background: orange;
  overflow: hidden;
}
```
