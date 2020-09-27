[原文链接](https://github.com/dwqs/blog/issues/70)
## 页面中插入几万条DOM
```html
<body>
<button id="button">button</button>
<br>
<ul id="container"></ul>
<script>
    document.getElementById('button').addEventListener('click', function () {
        // 记录任务开始时间
        let now = Date.now();
        // 插入一万条数据
        const total = 10000;
        // 获取容器
        let ul = document.getElementById('container');
        // 将数据插入容器中
        for (let i = 0; i < total; i++) {
            let li = document.createElement('li');
            li.innerText = ~~(Math.random() * total)
            ul.appendChild(li);
        }
        console.log('JS运行时间：', Date.now() - now);
        setTimeout(() => {
            console.log('总运行时间：', Date.now() - now);
        }, 0)

        // print JS运行时间：38
        // print 总运行时间：957
    })
</script>
</body>
```

### 虚拟列表
虚拟列表其实是按需显示的一种实现，即只对 可见区域进行渲染，对 非可见区域中的数据不渲染或部分渲染的技术，从而达到极高的渲染性能。


#### 实现
虚拟列表的实现，实际上就是在首屏加载的时候，只加载 `可视区域` 内需要的列表项，当滚动发生时，动态通过计算获得 `可视区域` 内的列表项，并将 `非可视区域` 内存在的列表项删除。

计算当前 `可视区域` 起始数据索引( `startIndex`)
计算当前 `可视区域` 结束数据索引( `endIndex`)
计算当前 `可视区域` 的数据，并渲染到页面中
计算 `startIndex` 对应的数据在整个列表中的偏移位置 `startOffset` 并设置到列表上


```jsx harmony
// Item.jsx
import React, { Component } from 'react'

export default class Item extends Component {
    componentDidMount() {
        /* eslint-disable-next-line */
        this.props.cachePosition(this.node, this.props.index)
    }

    render() {
        /* eslint-disable-next-line */
        const { index, item } = this.props

        return (
            <div className='list-item' style={{ height: 'auto' }} ref={node => { this.node = node }}>
                <p>#${index} {item.words}</p>
                <p>{item.paragraphs}</p>
            </div>
        )
    }
}
```

```jsx harmony
// fakeData
import faker from 'faker/locale/zh_CN'

const pageSize = 200
const host = 'http://picsum.photos'

const words = []
const paragraphs = []
const images = []

function fakerData (start = 0, useImage = true) {
  const a = []
  for (let i = start; i < start + pageSize; i++) {
    const rw = (1 + Math.random()) * 100
    const rh = (1 + Math.random()) * 100

    a.push({
      id: i,
      image: useImage ? images[i] || (images[i] = `${host}/${Math.trunc(rw)}/${Math.trunc(rh)}`) : undefined,
      words: words[i] || (words[i] = faker.lorem.words()),
      paragraphs: paragraphs[i] || (paragraphs[i] = Math.random() <= 0.5 ? faker.lorem.paragraphs() : faker.lorem.sentences())
    })
  }

  return a
}

export default fakerData
```

```jsx harmony
// app.js
import React, { Component } from 'react';
import './App.css';

import Item from './Item'
import fakerData from './fakerData'


const estimatedItemHeight = 80
const bufferSize = 5

export default class VirtualizedList extends Component {
  constructor(props) {
    super(props)

    this.state = {
      startOffset: 0,
      endOffset: 0,
      visibleData: []
    }

    this.data = fakerData(0, false)

    this.startIndex = 0
    this.endIndex = 0
    this.scrollTop = 0

    this.doc = null

    // 缓存已渲染元素的位置信息
    this.cache = []
    // 缓存锚点元素的位置信息
    this.anchorItem = {
      index: 0, // 锚点元素的索引值
      top: 0, // 锚点元素的顶部距离第一个元素的顶部的偏移量(即 startOffset)
      bottom: 0 // 锚点元素的底部距离第一个元素的顶部的偏移量
    }

    this.handleScroll = this.handleScroll.bind(this)
    this.cachePosition = this.cachePosition.bind(this)
  }

  cachePosition(node, index) {
    const rect = node.getBoundingClientRect()
    const top = rect.top + window.pageYOffset

    this.cache.push({
      index,
      top,
      bottom: top + rect.height
    })
  }

  // 滚动事件处理函数
  handleScroll(e) {
    if (!this.doc) {
      // 兼容 iOS Safari/Webview
      this.doc = window.document.body.scrollTop ? window.document.body : window.document.documentElement
    }

    const scrollTop = this.doc.scrollTop
    if (scrollTop > this.scrollTop) {
      if (scrollTop > this.anchorItem.bottom) {
        this.updateBoundaryIndex(scrollTop)
        this.updateVisibleData()
      }
    } else if (scrollTop < this.scrollTop) {
      if (scrollTop < this.anchorItem.top) {
        this.updateBoundaryIndex(scrollTop)
        this.updateVisibleData()
      }
    }

    this.scrollTop = scrollTop
  }

  // 计算 startIndex 和 endIndex
  updateBoundaryIndex(scrollTop) {
    scrollTop = scrollTop || 0
    // 用户正常滚动下，根据 scrollTop 找到新的锚点元素位置
    const anchorItem = this.cache.find(item => item.bottom >= scrollTop)

    if (!anchorItem) {
      // 滚的太快，找不到锚点元素，这个暂不处理
      return
    }

    this.anchorItem = {
      ...anchorItem
    }

    this.startIndex = this.anchorItem.index
    this.endIndex = this.startIndex + this.visibleCount
  }

  updateVisibleData() {
    const visibleData = this.data.slice(this.startIndex, this.endIndex)

    this.setState({
      startOffset: this.anchorItem.top,
      endOffset: (this.data.length - this.endIndex) * estimatedItemHeight,
      visibleData
    })
  }

  componentDidMount() {
    // 计算可渲染的元素个数
    this.visibleCount = Math.ceil(window.innerHeight / estimatedItemHeight) + bufferSize
    this.endIndex = this.startIndex + this.visibleCount
    this.updateVisibleData()

    window.addEventListener('scroll', this.handleScroll, false)
  }

  render() {
    const { startOffset, endOffset, visibleData } = this.state

    return (
      <div className='wrapper' ref={node => { this.wrapper = node }}>
        <div style={{ paddingTop: `${startOffset}px`, paddingBottom: `${endOffset}px` }}>
          {
            visibleData.map((item, index) => {
              return (
                <Item
                  cachePosition={this.cachePosition}
                  key={this.startIndex + index}
                  item={item}
                  index={this.startIndex + index}
                />
              )
            })
          }
        </div>
      </div>
    )
  }
}
```