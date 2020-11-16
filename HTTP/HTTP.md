[HTTP面试题](https://juejin.im/post/5e91d85ce51d4546c82d9d99#heading-32)
[参考文献](https://github.com/semlinker/awesome-http)
[大白话三次握手](https://github.com/jawil/blog/issues/14)
[Http](https://juejin.im/post/5dc6c7a8e51d45160d04a480)

### 网络协议分层
七层：应用层/表示层/会话层/传输层/网络层/数据链路层/物理层
五层：应用层/传输层/网络层/网络接口层

#### 应用层包括
1、超文本传输协议（HTTP）:万维网的基本协议；
2、文件传输（TFTP简单文件传输协议）；
3、远程登录（Telnet），提供远程访问其它主机功能, 它允许用户登录internet主机，并在这台主机上执行命令；
4、网络管理（SNMP简单网络管理协议），该协议提供了监控网络设备的方法， 以及配置管理,统计信息收集,性能管理及安全管理等；
5、域名系统（DNS），该系统用于在internet中将域名及其公共广播的网络节点转换成IP地址。

#### 网络层包括
1、Internet协议（IP）；
2、Internet控制信息协议（ICMP）；
3、地址解析协议（ARP）；
4、反向地址解析协议（RARP）。

### TCP 和 UDP 区别
1. 基于连接与无连接；
2. 对系统资源的要求（TCP较多，UDP少）；
3. UDP程序结构较简单；
4. 流模式与数据报模式 ；
5. TCP保证数据正确性，UDP可能丢包；
6. TCP保证数据顺序，UDP不保证。

### DNS 解析
> DNS (Domain Name System)是互联网中的重要基础设施，负责对域名的解析工作，为了保证高可用、高并发和分布式，它设计成了树状的层次结构。
> 查找哪台机器有你需要的资源，互联网上每一台计算机的唯一标识是它的IP地址。网址到IP地址的转换，这个过程就是DNS解析
> DNS 是什么-- Domain Name System，域名系统，作为域名和IP地址相互映射的一个分布式数据库。

#### DNS 解析过程

1. 首先在本地域名服务器中查询 IP 地址
2. 本地域名服务器未找到，向根域名服务器发送请求
3. 根域名服务器也不存在该域名，本地域名会向com顶级域名服务器发送一个请求
4. 直到最后本地域名服务器得到IP地址并缓存在本地，供下次查询使用。


#### DNS 缓存

- 浏览器缓存
- 系统缓存
- 路由器缓存
- IPS服务器缓存
- 根域名服务器缓存
- 顶级域名服务器缓存
- 主域名服务器缓存


#### DNS 负载均衡
CDN利用DNS重定向技术。DNS服务器会返回一个跟用户最接近的点的IP地址给用户，CDN节点的服务器负责响应用户的请求，提供所需的内容。


#### DNS-Prefetching
浏览器根据自定义的规则，提前去解析后面可能用到的域名，来加速网站的访问速度。简单来讲就是提前解析域名，以免延迟。

**使用方式**
```html
<link rel="dns-prefetch" href="//www.com">
```
这个功能有个默认加载条件，所有的a标签的href都会自动去启用DNS Prefetching，也就是说，你网页的a标签href带的域名，是不需要在head里面加上link手动设置的。但a标签的默认启动在HTTPS不起作用。

这时要使用 meta里面http-equiv来强制启动功能。
```html
<meta http-equiv="x-dns-prefetch-control" content="on">
```



#### CDN 原理
>CDN（Content Delivery Network）就是内容分发网络。

CDN 网络则是在用户和服务器之间增加 Cache 层，将用户的访问请求引导到Cache 节点而不是服务器源站点，要实现这一目的，主要是通过接管DNS 实现


- 全局负载均衡DNS 解析服务器会根据用户端的源IP 地址，如地理位置(北京还是上海)、接入网类型(电信还是网通)将用户的访问请求定位到离用户路由最短、位置最近、负载最轻的Cache 节点(缓存服务器)上，实现就近定位。定位优先原则可按位置、可按路由、也可按负载等。
- 浏览器得到该域名CDN 缓存服务器的实际IP 地址，向缓存服务器发出访问请求

- 缓存服务器根据浏览器提供的域名，通过Cache 内部专用DNS 解析得到此域名源服务器的真实IP 地址，再由缓存服务器向此真实IP 地址提交访问请求


### 输入url后发生了什么

### 状态码整理


### HTTP 请求方法
- GET 获取资源 (幂等)
- POST 新增资源
- HEAD 获取HEAD元数据 (幂等)
- PUT 更新资源 (带条件时幂等)
- DELETE 删除资源 (幂等)
- CONNECT 建立 Tunnel 隧道
- OPTIONS 获取服务器支持访问资源的方法 (幂等)
- TRACE 回显服务器收到的请求，可以定位问题。(有安全风险)


### HTTPS的理解
HTTPS 就是在 HTTP 和 TCP 协议中间加入了 SSL/TLS 安全套接层。
结合非对称加密和对称加密的各自优点，配合证书。既保证了安全性，也保证了传输效率。
目前应用最广泛的是TLS1.2，实现原理如下：

1. Client 发送 random1+对称加密套件列表+非对称加密套件列表
2. Server 收到信息， 选择 对称加密套件+非对称加密套件 并和 random2+证书(公钥在证书中) 一起返回
3. Client 验证证书有效性，并用 random1+random2 生成 pre-master 通过服务器公钥加密+浏览器确认 发送给 Server
4. Server 收到 pre-master，根据约定的加密算法对 random1+random2+pre-master（解密）生成 master-secret，然后发送服务器确认
5. Client 收到生成同样的 master-secert，对称加密秘钥传输完毕
TLS1.3 则简化了握手过程，完全握手只需要一个消息往返，提升了性能。不仅如此，还对部分不安全的加密算法进行了删减。


### HTTP缓存策略

#### 强缓存
服务器使用 Cache-Control 来设置缓存策略，常用 max-age 来表示资源的有效期。
- no-store：不允许缓存 (用于秒杀页面等变化频率非常高的场景)
- no-cache：可以缓存，使用前必须要去服务端验证是否过期，是否是最新版本
- must-revalidate：如果缓存不过期就可以继续使用，过期了就必须去服务端验证


#### 协商缓存
验证资源是否失效就需要使用条件请求。常用的是 If-Modified-Since 和 If-None-Match，收到 304 状态码就可以复用缓存里的资源。
(If-None-Match 比 If-Modified-Since 优先级更高)
验证资源是否被修改的条件有两个 Last-modified 和 ETag (ETag 比 Last-modified 的精确度更高)，需要预先在服务端的响应报文里设置，配合条件请求使用。


### HTTP重定向
重定向是服务器发起的跳转，要求客户端使用新的 URI 重新发送请求。在响应头字段 Location 中指示了要跳转的 URI。使用 Refresh 字段，还可以实现延时重定向。
301 / 302 是常用的重定向状态码。分别代表永久性重定向和临时性重定向。


除此之外还有：

- 303：类似于 302，重定向后的请求方法改为 GET 方法
- 307：类似于 302，含义比 302 更明确，重定向后请求的方法和实体不允许变动
- 308：类似于 301，代表永久重定向，重定向后请求的方法和实体不允许变动
- 300：是一个特殊的重定向状态码，会返回一个有多个链接选项的页面，由用户自行选择
- 304：是一个特殊的重定向状态码，服务端验证过期缓存有效后，要求客户端使用该缓存


### HTTP 的常用的首部字段
#### 通用首部字段
- Cache-Control 控制缓存
- Connection 连接管理
- Transfor-Encoding 报文主体的传输编码格式
- Date 创建报文的时间
- Upgrade 升级为其他协议
#### 请求首部字段
- Host 请求资源所在的服务器 (唯一一个HTTP/1.1规范里要求必须出现的字段)
- Accept 客户端或者代理能够处理的媒体类型
- If-Match 比较实体标记 (ETag)
- If-None-Match 比较实体标记 (ETag)，与 If-Match 相反
- If-Modified-Since 比较资源更新时间 (Last-Modified)
- If-Unmodified-Since 比较资源更新时间 (Last-Modified)， 与 If-Modified-Since 相反
- Range 实体的字节范围请求
- User-Agent 客户端信息


#### 响应首部字段
- Accept-Ranges 能接受的字节范围
- Location 命令客户端重定向的 URI
- ETag 能够表示资源唯一资源的字符串
- Server 服务器的信息


#### 实体首部字段
- Allow 资源可支持 HTTP 请求方法
- Last-Modified 资源最后修改时间
- Expires 实体主体过期时间
- Content-Language 实体资源语言
- Content-Encoding 实体编码格式
- Content-Length 实体大小
- Content-Type 实体媒体类型


### HTTP状态码
#### 1xx
- 1xx：请求已经接收到，需要进一步处理才能完成，HTTP/1.0 不支持
- 100 Continue：上传大文件前使用
- 101 Switch Protocols：协议升级使用
- 102 Processing：服务器已经收到并正在处理请求，但无响应可用

#### 2xx
- 2xx：成功处理请求
- 200 OK：成功返回响应
- 201 Created：有新资源在服务器端被成功创建
- 202 Accepted：服务器接受并开始处理请求，但请求未处理完成
- 206 Partial Content：使用range协议时返回部分响应内容时的响应码

#### 3xx
### 301 302
301，永久重定向：在请求的URL已被移除时使用，响应的location首部中应包含资源现在所处的URL
302，临时重定向：和永久重定向类似，客户端应用location给出URL临时定位资源，将来的请求仍为原来的URL。

所以浏览器会进行2次请求。第一次返回301/302

服务器响应 状态码为301+ location为新的url

浏览器会再次请求新的URL

#### 一般使用301的情况有下面几种
http网站跳转到https网站
二级域名跳转到主域名，http://www.abc.com跳转到http://abc.com
404页面失效跳转到新的页面
老的域名跳转到新的域名

所以301跳转，对用户体验和谷歌蜘蛛都是比较友好的，权重发生了传递，当然对SEO也是有好处的。


302使用的情况不太常见，因为这是个临时性的跳转，暂时性的把页面A跳转到页面B，但是最终还会使用页面A，这个情况一般就是网站短时间内进行改版，在不影响用户体验的情况下，临时把页面跳转到临时页面

#### 4xx
- 4xx：客户端出现错误
- 400 Bad Request：服务器认为客户端出现了错误，但不明确，一般是 HTTP 请求格式错误
- 401 Unauthorized：用户认证信息确实或者不正确
- 403 Forbidden：服务器理解请求的含义，但没有权限执行
- 407 Proxy Authentication Required：对需要经由代理的请求，认证信息未通过代理服务器的验证
- 404 Not Found：服务器没有找到对应的资源
- 408 Request Timeout：服务器接收请求超时

#### 5xx
- 5xx：服务器端出现错误
- 500 Internal Server Error：服务器内部错误，且不属于以下错误类型
- 502 Bad Gateway：代理服务器无法获取到合法响应
- 503 Service Unavailable：服务器资源尚未准备好处理当前请求
- 505 HTTP Version Not Supported：请求使用的 HTTP 协议版本不支持


### 埋点数据发送请求
埋点是通过img src 实现的
前端通过window.[__bfi].push()方法，ubt将push方法声明为一个函数，函数的功能是对argument进行处理


Referrer-Policy 首部用来监管哪些访问来源信息——会在 Referer  中发送——应该被包含在生成的请求当中。
```text
Referrer-Policy: no-referrer
Referrer-Policy: no-referrer-when-downgrade
Referrer-Policy: origin
Referrer-Policy: origin-when-cross-origin
Referrer-Policy: same-origin
Referrer-Policy: strict-origin
Referrer-Policy: strict-origin-when-cross-origin
Referrer-Policy: unsafe-url
```

no-referrer
整个 Referer  首部会被移除。访问来源信息不随着请求一起发送。
no-referrer-when-downgrade （默认值）
在没有指定任何策略的情况下用户代理的默认行为。在同等安全级别的情况下，引用页面的地址会被发送(HTTPS->HTTPS)，但是在降级的情况下不会被发送 (HTTPS->HTTP)。
origin
在任何情况下，仅发送文件的源作为引用地址。例如  https://example.com/page.html 会将 https://example.com/ 作为引用地址。
origin-when-cross-origin
对于同源的请求，会发送完整的URL作为引用地址，但是对于非同源请求仅发送文件的源。
same-origin
对于同源的请求会发送引用地址，但是对于非同源请求则不发送引用地址信息。
strict-origin
在同等安全级别的情况下，发送文件的源作为引用地址(HTTPS->HTTPS)，但是在降级的情况下不会发送 (HTTPS->HTTP)。
strict-origin-when-cross-origin
对于同源的请求，会发送完整的URL作为引用地址；在同等安全级别的情况下，发送文件的源作为引用地址(HTTPS->HTTPS)；在降级的情况下不发送此首部 (HTTPS->HTTP)。
unsafe-url
无论是同源请求还是非同源请求，都发送完整的 URL（移除参数信息之后）作为引用地址。



### OPTIONS 请求
使用OPTIONS方法对服务器发起请求，可以检测服务器支持哪些 HTTP 方法
>规范要求，对那些可能对服务器数据产生副作用的 HTTP 请求方法（特别是 GET 以外的 HTTP 请求，或者搭配某些 MIME 类型的 POST 请求），浏览器必须首先使用 OPTIONS 方法发起一个预检请求（preflight request），从而获知服务端是否允许该跨域请求。

所以这个跨域请求触发了浏览器自动发起OPTIONS请求，看看此次跨域请求具体触发了哪些条件。
#### 跨域请求时，OPTIONS请求触发条件

|  CORS预检请求触发条件   | 
|  ----  | 
| 1. 使用 HTTP方法 PUT/DELETE/CONNECT/OPTIONS/TRACE/PATCH  | 
| 2. 人为设置了以下集合之外首部字段：Accept/Accept-Language/Content-Language/Content-Type/DPR/Downlink/Save-Data/Viewport-Width/Width  |
| 3. Content-Type 的值不属于下列之一: application/x-www-form-urlencoded、multipart/form-data、text/plain|

#### 优化OPTIONS请求：Access-Control-Max-Age 或者 避免触发
>Access-Control-Max-Age这个响应首部表示 preflight request  （预检请求）的返回结果（即 Access-Control-Allow-Methods 和Access-Control-Allow-Headers 提供的信息） 可以被缓存的最长时间，单位是秒。(MDN)
 

### GET/POST
对get请求参数的限制是来源与浏览器或web服务器，浏览器或web服务器限制了url的长度。
1. HTTP 协议 未规定 GET 和POST的长度限制
2. GET的最大长度显示是因为 浏览器和 web服务器限制了 URI的长度
3. 不同的浏览器和WEB服务器，限制的最大长度不一样


### SEO
- 合理的 title、description、keywords：搜索对着三项的权重逐个减小，title 值强调重点即可，重要关键词出现不要超过 2 次，而且要靠前，不同页面 title 要有所不同；description 把页面内容高度概括，长度合适，不可过分堆砌关键词，不同页面 description 有所不同；keywords 列举出重要关键词即可
- 语义化的 HTML 代码，符合 W3C 规范：语义化代码让搜索引擎容易理解网页
- 重要内容 HTML 代码放在最前：搜索引擎抓取 HTML 顺序是从上到下，有的搜索引擎对抓取长度有限制，保证重要内容一定会被抓取
- 重要内容不要用 js 输出：爬虫不会执行 js 获取内容
- 少用 iframe(搜索引擎不会抓取 iframe 中的内容)
- 非装饰性图片必须加 alt
- 提高网站速度(网站速度是搜索引擎排序的一个重要指标)

### keep-alive

在http早期，每个http请求都要求打开一个tpc socket连接，并且使用一次之后就断开这个tcp连接。
使用keep-alive可以改善这种状态，即在一次TCP连接中可以持续发送多份数据而不会断开连接。通过使用keep-alive机制，可以减少tcp连接建立次数，也意味着可以减少TIME_WAIT状态连接，以此提高性能和提高httpd服务器的吞吐率(更少的tcp连接意味着更少的系统内核调用,socket的accept()和close()调用)。
但是，keep-alive并不是免费的午餐,长时间的tcp连接容易导致系统资源无效占用。配置不当的keep-alive，有时比重复利用连接带来的损失还更大。所以，正确地设置keep-alive timeout时间非常重要。
