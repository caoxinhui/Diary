布局的传统解决方案，基于盒状模型，依赖`display`+`position` + `float`属性
Flex是Flexible Box的缩写，意为弹性布局
### 容器属性
`
- flex-direction
- flex-wrap
- flex-flow
- justify-content
- align-items
- align-content
`

### flex-direction
`flex-direction: row | row-reverse | column | column-reverse;`
![flex-direction](http://www.ruanyifeng.com/blogimg/asset/2015/bg2015071005.png)

### flex-wrap
`flex-wrap: nowrap | wrap | wrap-reverse`
![flex-wrap](http://www.ruanyifeng.com/blogimg/asset/2015/bg2015071006.png)
### flex-flow
`flex-flow`属性是`flex-direction`属性和`flex-wrap`属性的简写形式，默认值为`row nowrap`。
flex-flow: <flex-direction> || <flex-wrap>;


### justify-content
`justify-content: flex-start | flex-end | center | space-between | space-around`

`
- flex-start（默认值）：左对齐
- flex-end：右对齐
- center： 居中
- space-between：两端对齐，项目之间的间隔都相等。
- space-around：每个项目两侧的间隔相等。所以，项目之间的间隔比项目与边框的间隔大一倍。
`
![justify-content](http://www.ruanyifeng.com/blogimg/asset/2015/bg2015071010.png)

### align-items
align-items: flex-start | flex-end | center | baseline | stretch;
![align-items](http://www.ruanyifeng.com/blogimg/asset/2015/bg2015071011.png)
`
- flex-start：交叉轴的起点对齐。
- flex-end：交叉轴的终点对齐。
- center：交叉轴的中点对齐。
- baseline: 项目的第一行文字的基线对齐。
- stretch（默认值）：如果项目未设置高度或设为auto，将占满整个容器的高度。
`

### align-content
align-content属性定义了多根轴线的对齐方式。如果项目只有一根轴线，该属性不起作用。
`align-content: flex-start | flex-end | center | space-between | space-around | stretch`
![align-content](http://www.ruanyifeng.com/blogimg/asset/2015/bg2015071012.png)
### order
order属性定义项目的排列顺序。数值越小，排列越靠前，默认为0。
```css
.item {
  order: <integer>;
}
```


### flex-grow
flex-grow属性定义项目的放大比例，默认为0，即如果存在剩余空间，也不放大。
```css
.item {
  flex-grow: <number>; /* default 0 */
}
```


### flex-shrink
flex-shrink属性定义了项目的缩小比例，默认为1，即如果空间不足，该项目将缩小。

### flex-basis
flex-basis属性定义了在分配多余空间之前，项目占据的主轴空间（main size）。浏览器根据这个属性，计算主轴是否有多余空间。它的默认值为auto，即项目的本来大小。
```css
.item {
  flex-basis: <length> | auto; /* default auto */
}
```

### flex
flex属性是flex-grow, flex-shrink 和 flex-basis的简写，默认值为0 1 auto。后两个属性可选。
```css
.item {
  flex: none | [ <'flex-grow'> <'flex-shrink'>? || <'flex-basis'> ]
}
```

### align-self
align-self属性允许单个项目有与其他项目不一样的对齐方式，可覆盖align-items属性。默认值为auto，表示继承父元素的align-items属性，如果没有父元素，则等同于stretch
align-self: auto | flex-start | flex-end | center | baseline | stretch;

![align-self](http://www.ruanyifeng.com/blogimg/asset/2015/bg2015071016.png)
