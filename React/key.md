[react协程](https://reactjs.org/docs/reconciliation.html)
### react 协程
#### diff 算法
- 不同类型的 Element
> 组件会重建。当组件将要被销毁的时候，组件实例触发 componentWillUnmount，当建立新树，组件实例接收到 componentWillMount，接着 componentDidMount。旧树的所有状态都会被销毁
- 同类型的 DOM Element
> react 会查看 Element 的属性，只会更新改变的属性。当更新 style，也只会更新改变的属性
- 同类型的 Component Element
当组件更新，组件实例还是一样的，所以在render过程中，状态会维持不变。react 更新组件的 props，并且调用 componentWillReceiveProps 和 componentWillUpdate，然后调用 render 

#### 子元素上的递归
递归一个list，如果是在最后添加一个元素，前面的DOM是维持不变的。如果是在第一个添加，性能很差，react会修改所有子节点。


#### keys
react通过keys去匹配子节点。
可以使用index 作为key，如果 这对子元素没有被重新排列的情况很适用。但是 重排列会变得很慢
组件实例会依据他们的key更新和重用。如果移除一个item，组件状态（类似于非受控input）会引起混乱。


### key更新原理
我们知道在react中渲染一个列表的时候，会要求传入key属性，其实这主要是出于react对性能的考虑。当组件被传入的属性或状态发生改变时，render会重新触发，所以，在一个不确定长度的数组中，react需要基于key去判断整个列表结构，从而操作列表中的dom，大体上有三种情况。
1. 当有新key时，则创建新节点
2. 当有key消失时，则销毁key所对应的节点
3. 当key相同，则更新对应节点

### 使用 index 作为 key 可能会出现问题
因为key是用来唯一标识一个元素的。当你向列表中添加一条数据或者移除某条数据时。如果该键与之前的相同，React会认为DOM元素表示的组件和以前是一样的。然而我们想要的并非如此。
```jsx harmony
class Home extends React.Component {
    constructor() {
        super();
        this.state = {
            list: [
                {name: 'zs', id: 1},
                {name: 'ls', id: 2},
                {name: 'ww', id: 3}
            ]
        }
    }
    addAHeadItem() {
        this.setState({
            list:[{name:'zq',id:4},...this.state.list]
        })
    }
    addBehindItem(){
        this.state({
            list:[...this.state.list,{name:'zq',id:4}]
        })
    }
    render(){
        return (
            <div>
                <button onClick={()=>{this.addAHeadItem()}}>
                    添加到头部
                </button>
                <button onClick={()=>{this.addBehindItem()}}>
                    添加到尾部
                </button>
                <div>
                    {this.state.list.map((item,index)=>{
                        return (
                            <li key={index}>
                                {item.name}
                                <input type='text'/>
                            </li>
                        )
                    })}
                </div>
                <div>
                    {this.state.list.map((item,index)=>{
                        return (
                            <li key={item.id}>
                                {item.name}
                                <input type={'text'}/>
                            </li>
                        )
                    })}
                </div>
            </div>
        )
    }
}
```
