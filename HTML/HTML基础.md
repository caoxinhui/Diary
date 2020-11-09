### 标签语义化

### meta标签
在移动端设置viewport可以加速页面的渲染，同时可以避免缩放导致页面重排和重绘。在移动端固定viewport设置的方法如下。
```html
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
```



### 媒体查询


### viewport meta 作用
让浏览器帮我们把页面缩放，使得页面看起来好像是自适应。实际上这不是自适应，只是在中小屏设备上，看起来差距不大，问题不明显而已。
让当前viewport的宽度等于设备的宽度，同时不允许用户手动缩放。

width=device-width: 让当前viewport宽度等于设备的宽度
user-scalable=no: 禁止用户缩放
initial-scale=1.0: 设置页面的初始缩放值为不缩放
maximum-scale=1.0: 允许用户的最大缩放值为1.0
minimum-scale=1.0: 允许用户的最小缩放值为1.0



### DPR
设备像素比DPR(devicePixelRatio)是默认缩放为100%的情况下，设备像素和CSS像素的比值
DPR = 设备像素 / CSS像素(某一方向上)
而对于设备像素比DPR也有对应的javascript属性window.devicePixelRatio


### 图片格式对比
