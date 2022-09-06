父页面
```tsx
const  handleClick = () => {
    const iframeWin = document.getElementById('childPage').contentWindow;
    //向子页面推送信息
    iframeWin.postMessage({
        'name': 'Jartto',
        'say': 'hello~',
        'arr': [1,2,3]
    }, 'http://localhost:3000/');
}
<button onClick={handleClick}>父页面按钮</button>
<iframe
    src={"http://localhost:3000/"}
    style={{
        width:"300px",
        height:"300px"
    }}
    id={'childPage'}
    name="childFrame"
>
</iframe>
```

子页面
```tsx
const receiveMessage = (value) => {
    console.log(value.data)
}
window.addEventListener("message", receiveMessage, false);
const handleClick = () => {
    //向父页面推送信息
    window.parent.postMessage({
        'name': 'Jartto',
        'say': 'hello~',
        'caoxinhui': [1,2,3]
    }, "http://localhost:8000/");
}
<button onClick={handleClick}>iframe子页面按钮</button>
```