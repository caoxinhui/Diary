HTTP报文头部
1. Accept：告诉服务器自己能接收什么媒体类型，*/*表示能接收任何类型，type/*表示接收该类型下的所有子类型
2. Accept-Charset: 浏览器接收内容的字符集，通常是utf-8
3. Accept-Encoding: 浏览器接收内容的编码方式，例如指定是否支持压缩。若支持压缩的话支持什么压缩方式，gzip，deflate，sdch
4. Accept-language
5. Accept-Ranges: Web服务器表明自己是否接收获取某个实体的一部分
6. Age: 一般当服务器用自己缓存的实体去响应请求时，可以用该头部表明实体从产生到现在经过了多长时间。
7. Allow: 该参数头部可以设置服务端支持接收哪些可用的HTTP请求方法
8. Authorization：当客户接收到来自Web服务器的WWW-Authenticate响应时，后面可以用该头部来携带自己的身份验证信息给Web服务器直接进行认证。
9. Cache-Control: 用来声明服务器端缓存控制的指令，包括请求设置指令和响应请求指令。
请求控制指令
no-cache: 不使用缓存实体，要求从Web服务器去请求内容
max-age: 只接受Age值小于max-age值的内容，没有过期的请求对象
max-stale: 可以接收过去的对象，但是过期时间必须小于max-stale值

响应控制指令
public: 可以用Cache中内容回应任何用户
private: 只能用缓存内容回应先前请求该内容的具体用户
no-cache: 可以设置哪些内容不被缓存
max-age: 设置响应中包含对象的过期时间

10. Connection：在请求头中，close 告诉web服务器或者代理服务器，在完成本次请求响应后断开连接，无须等待本次连接的后续请求。keep-alive保持连接，等待本次连接的后续请求，该头部表明希望
web服务器保持连接的时长。
11. Content-Language：服务器告诉浏览器响应的媒体对象类型
12. Content-Encoding: 
13. Content-Length
14. Content-Range:该响应包含的部分对象为整个对象的哪个部分。
15. Content-Type
16. Expires
17. Etag
Etag是服务器响应请求时，返回当前资源文件的一个唯一标识(由服务器生成)。
语法：
```
ETag: W/"<etag_value>"
ETag: "<etag_value>"
```
'W/'(大小写敏感)
表示使用弱验证器，可选。 弱验证器很容易生成，但不利于比较。 强验证器是比较的理想选择，但很难有效地生成。 相同资源的两个弱Etag值可能语义等同，但不是每个字节都相同。
"<etag_value>"
实体标签唯一地表示所请求的资源。 它们是位于双引号之间的ASCII字符串（如“675af34563dc-tr34”）。 没有明确指定生成ETag值的方法。 通常，使用内容的散列，最后修改时间戳的哈希值，或简单地使用版本号。 例如，MDN使用wiki内容的十六进制数字的哈希值。
18. Host: 客户端指定自己访问的Web服务器的域名/IP地址和端口号
19. If-None-Match
20. If-Modified-Since
21. If-Range
22. Last-Modified
23. Location: Web服务器告诉浏览器，试图访问的对象已经被移到别的位置了，让浏览器重定向去读取Location里面返回的内容
24. Pramga：主要使用Pramga: no-cache，相当于 Cache-Control：no-cache
25. Proxy-Authenticate: 代理服务器响应浏览器，要求其提供代理身份验证信息
26. Range: 浏览器告诉Web服务器自己想读取对象的哪部分
27. Referer: 浏览器向Web服务器表明自己是从哪个网页url跳转访问当前请求中网址URL的，即跳转到当前页面的来源。
28. Server: Web服务器通过此头域表明自己是什么软件及版本信息
29. User-Agent：浏览器的代理名称。
30. Transfer-Encoding