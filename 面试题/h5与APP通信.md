### app 调用 h5 的代码
因为 app 是宿主，可以直接访问 h5，所以这种调用比较简单，就是在 h5 中曝露一些全局对象（包括方法），然后在原生 app 中调用这些对象。

### h5 调用 app 的代码
#### 由 app 向 h5 注入一个全局 js 对象，然后在 h5 直接访问这个对象
#### 由 h5 发起一个自定义协议请求，app 拦截这个请求后，再由 app 调用 h5 中的回调函数
1. 由 app 自定义协议，比如 sdk://action?params
2. 在 h5 定义好回调函数，比如 window.bridge = {getDouble: value => {}, getTriple: value => {}}
3. 由 h5 发起一个自定义协议请求，比如 location.href = 'sdk://double?value=10'
4. app 拦截这个请求后，进行相应的操作，获取返回值
5. 由 app 调用 h5 中的回调函数，比如 window.bridge.getDouble(20);
