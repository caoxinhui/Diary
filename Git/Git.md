---
title: "Git"
tags: [工程化, Git]
prereq: []
related: []
deep: []
dup: []
---

### git rebase 和 merge 区别
主要的区别在于是否保留分支的 commit 提交节点，rebase 会给你一个简洁的线性历史树

### git cherry-pick
git cherry-pick命令的参数，不一定是提交的哈希值，分支名也是可以的，表示转移该分支的最新提交。
#### 转移多个提交
`git cherry-pick <HashA> <HashB>`
#### 如果想要转移一系列的连续提交
`git cherry-pick A..B` (不包含A)
#### 包含A
`git cherry-pick A^..B`

### git clone
该命令会在本地主机生成一个目录，与远程主机的版本库同名。若要指定不同的目录名，将目录名作为git clone 命令的第二个参数
`git clone <版本库的网址> <本地目录名>`

### git 批量删除本地分支(删除分支名包含指定字符的分支)
`git branch |grep 'xxx' |xargs git branch -D`



### 删除当前分支以外的分支
```js
git branch | xargs git branch -d
```


### git remote
每个远程主机都有一个主机名，git remote 用于管理主机名

`git remote` 列出所有远程主机
`git remote -v`参看远程主机网址
`git remote show <主机名>`查看主机详细信息
`git remote add <主机名> <网址>`添加远程主机
`git remote rm <主机名>`删除远程主机
`git remote rename <原主机名> <新主机名>`修改远程主机

克隆版本库的时候，所使用的远程主机，自动被git命名为origin，若想使用其他主机名，使用 -o
`git clone -o jQuery https://github.com/jquery/jquery.git`

### HEAD^ 与 HEAD~ 区别
```js
A = A^0
A^ = A^1= A~1
^^= A^1^1= A~2
```

### reset, hard, soft 区别

- HEAD:当前分支当前版本的游标
- index：暂存区


`git reset --soft HEAD~` 本地的内容没有发生变化，index中有最近一次修改的内容，提交变成staged状态。

`--mixed` 修改了index，使得提交变成了unstaged状态

`--hard` 彻底回到上一次提交的状态，无法找回

`git revert commitid` ,`git revert HEAD~3`会回到最近的第四个提交状态，并且生成一个新的commitid

### 代码自动格式化

``` json
// 安装husky，prettier,lint-staged
"husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,jsx}": [
      "prettier --write \"src/**/*.{js,jsx}\"",
      "git add"
    ]
  }
```

<!-- more -->

### git 筛选
git log  --author="username" --oneline ./app.ts

### 本机权限问题

`git pull` 的时候 ` error: cannot open .git/FETCH_HEAD: Permission denied ` , 因为没有当前目录的修改权限
`sudo chmod -R g+w .git ` 修改目录权限。即可正常 `git pull` 

### git pull
`git pull <远程主机名> <远程分支名>:<本地分支名>`

### git表情提示符

全局安装 `git-cz` 或者 `gitmoji` 
`npm install -g git-cz` 
`npm i -g gitmoji-cli` 

### 撤销错误的提交

`git reset --soft HEAD^` 撤销commit，并保留更改
`git push origin <分支名> --force` 

### force
如果远程主机的版本比本地版本更新，推送时 git 会报错，要求先在本地做 git pull 合并差异，再推送到远程主机。这时，如果一定要推送，可以使用 force
`git push --force origin`

### 清理分支

`git remote prune origin` 清理远程分支，把本地不存在的远程分支删除，同时 `git branch -a` 拉到的也是远程最新的分支，不会保留已删除的远程的分支
`git remote show origin` ，可以查看 `remote` 地址，远程分支，还有本地分支与之相对应关系等信息。

### 修改git的用户名和密码

`Git config –global user.name` 用户名
`Git config –global user.email` 邮箱名

### 回退到之前的版本号

`Git reset –hard` 提交版本号

### 删除远程分支(不需要先切换到其他分支)

1. `git push origin --delete 要删除的分支名` 
2. `git push origin -d 分支名` 
3. `git push <远程分支名> -d 分支名` 

### 删除本地分支

`git branch -d 本地分支名` 
`git branch -D 本地分支名(分支没有完全merge会报错提示，改为强制删除即可)` 

### 暂存修改

1. 暂存 `git stash save "message"` 
2. 恢复 `git stash apply` 
3. 恢复之前一个 `git stash apply stash@{2}` 
4. 删除 `git stash drop` 
5. 恢复 + 删除 `git stash pop` 
6. 列表 `git stash list` 
7. 从储藏创建一个文件 `git stash branch branchname` 

### 查看远程仓库信息

1. `git remote -v` 

### git撤销操作

``` 
<!-- 只会产生一次提交，第二次提交修正了第一次的提交内容 -->
`git commit -m 'initial commit'` 
`git add forgotten_file` 
`git commit --amend` 
```

### 新建分支

`git branch testing 新建testing分支 在当前commit对象上新建一个分支指针，不会自动切换到该分支中去` 
`git checkout -b iss53 新建分支并切换到该分支` 
`git push -u origin 分支名` 提交新建的分支到远程
`git push origin 分支名:分支名` 推送新分支到远程
`git fetch <远程主机名> 同步远程服务器上的数据到本地。` 
`git fetch <远程主机名> <分支名>`取回特定分支的更新
`git checkout -b newBranch origin/master` 在origin/master分支的基础上，新建一个分支

> 如果没有推送的远程的话，commit之后只会显示 working tree clean

### 删除远程分支

`git push origin :[分支名]` 删除远程分支

<!--SSH公钥默认存储在账户的主目录下的~/.ssh目录 -->

### ssh key

`cd ~/.ssh` 
查找有没有 `something` 和 `something.pub` 来命名的一对文件，这个 `something` 通常是 `id_dsa` 或 `id_rsa` 。
有 `.pub` 后缀的文件就是公钥，另一个文件是私钥。若 `.ssh` 目录没有，可以用 `ssh-keygen` 来创建。

### rebase
- 合并多个commit为1个
- 合并分支 `git rebase master` 在master分支上的最先提交上补上开发分支的代码


### 合并commit

`git` 修改多个 `commit` 为一个 `commit` 

1. 从HEAD版本开始往过去数3个版本 `git rebase -i HEAD~3` 
将后面的2个commit之前的pick改成s，表示，要把后面的两个commit合并到前一个commit

或者，指明要合并的版本之前的版本号 `git rebase -i commitId（不参与合并）` 

2. 除了第一个以外，后面的多个 `commit pick` 改为 `s` 
3. `esc` 键退出编辑
4. `:wq` 退出
5. `git add .` 
6. `git rebase --continue` 
7. `git rebase --abort` 放弃压缩

### 撤销改动

`git clean -f -d` 移除工作目录中所有未追踪的文件以及空的子目录
如果只是想要看看它会做什么，可以使用 -n 选项来运行命令，这意味着 “做一次演习然后告诉你 将要 移除什么”。
`git clean -d -n`
``` js
git checkout. / publish
git clean - f. / publish
```

### merge 分支

``` js
// merge 代码用
git merge 分支名--squash
git merge abort 取消合并
```

### 比较两次 commit 的差异
1. 比较两次commit提交之后的差异：
`git diff hash1 hash2 --stat`能够查看出两次提交之后，文件发生的变化。

2. 具体查看两次commit提交之后某文件的差异：
`git diff hash1 hash2 --文件名`

3. 比较两个分支的所有有差异的文件的详细差异：
`git diff branch1 branch2`

4. 比较两个分支的指定文件的详细差异
`git diff branch1 branch2 文件名(带路径)`

5. 比较两个分支的所有有差异的文件列表
`git diff branch1 branch2 --stat`


### 撤销已经提交的commit

`git reset --hard HEAD~1` 撤销上次的commit，保留之前的更改
`git reset --hard <需要回退到的版本号（只需输入前几位）>` 
`git push origin <分支名> --force` 或者 `git push --force` 强制提交

### 删除中间某次提交(待补充)

1. 首先 `git log` 查看提交记录，找到出错的前一笔提交的 `commit_id` 
2. 用命令 `git rebase -i commit_id` , 查找提交记录
3. 将出错那次提交的 `pick` 改为 `drop` 
4. `Esc，:wq` 
5. 完成！

### git reset分为三种模式

* soft 
* mixed 
* hard

**git reset --hard commitId**
重置暂存区和工作区，完全重置为指定的commitId，当前分支没有commit的代码会被清除
**git reset --soft commitId**
保留工作目录，把指定的commit节点与当前分支的差异都存入暂存区。没有被commit的代码也能够保留下来
**git reset commitId**
不带参数，就是mixed模式。将会保留工作目录，并把工作区、暂存区、以及与reset的差异都放到工作区，然后清空暂存区。

### rn 项目操作命令

`xcrun simctl list devices` 获取所有设备名称
`crn-cli run-ios --port=5390 --simulator="iPad Air (3rd generation)" --reset` 指定打开设备

### 关联本地项目与GitHub

1. 在本地项目 `git init` 
2. `git add .` 
3. `git commit -m " message"` 
4. 在 `GitHub` 建立一个项目
5. 复制项目 `HTTPS` 地址
6. `git remote add origin https 地址` 
7. `git push -u origin master` 

### 代码版本

1. 查看过去版本 `git log --pretty=oneline` 

### 暂存区文件撤销

1. `git reset HEAD 文件` 

### 删除文件

1. 从版本库中删除文件 `git rm 文件名` 
2. 从版本库中删除文件，但是本地不删除该文件 `git rm --cached 文件名` 

### 创建分支

1. 仅创建 `git branch 分支名` 
2. 创建并切换 `git checkout -b 分支名` 

`git branch -r`查看远程分支

## npm

npm rebuild  重建软件包
npm build
 ### ^ 与 ~ 的区别

  + ~ 会匹配最近的小版本依赖包，~1.2.3 会匹配 1.2.x 
  + ^ 会匹配最新的大版本依赖包，^1.2.3 会匹配 1.x.x

## Unexpected end of JSON input while parsing near '... "http://registry.npm.'

第一步
`npm cache clean --force` 
第二步
`npm install --registry=https://registry.npm（镜像）` 

原因：可以先看下npm install的执行过程：

* 发出npm install命令
* npm 向 registry 查询模块压缩包的网址
* 下载压缩包，存放在~/.npm(本地NPM缓存路径)目录
* 解压压缩包到当前项目的node_modules目录

&nbsp; &nbsp; 实际上说一个模块安装以后，本地其实保存了两份。一份是 ~/.npm 目录下的压缩包，另一份是 node_modules 目录下解压后的代码。但是，运行 npm install 的时候，只会检查 node_modules 目录，而不会检查 ~/.npm 目录。如果一个模块在 ~./npm 下有压缩包，但是没有安装在 node_modules 目录中，npm 依然会从远程仓库下载一次新的压缩包。

&nbsp; &nbsp; 我们想利用已经在缓存中之前已经备份的模块实现离线模块安装的的 cache 机制已经在V5的时候重写了，缓存将由 npm 来全局维护不再需要开发人员操心，离线安装时将不再尝试连接网络，而是降级尝试从缓存中读取，或直接失败。就是如果你 offline ，npm将无缝地使用您的缓存。

&nbsp; &nbsp; 这是一个与npm缓存腐败的问题。尽管在较新版本的npm中他们实现了自我修复，这通常可以保证没有腐败，但似乎并不那么有效。

### 钩子
npm 脚本有pre和post两个钩子。举例来说，build脚本命令的钩子就是prebuild和postbuild
用户执行npm run build的时候，会自动按照 `npm run prebuild && npm run build && npm run postbuild` 的顺序执行

### 更新 npm 插件
`npm update <name> [-g] [--save-dev] `


### vscode 自带终端，每次打开都报错误

`nvm is not compatible with the npm config "prefix" option: currently set to "/usr/local" Run "npm config delete prefix" or "nvm use --delete-prefix v10.15.1 --silent" to unset it.` 

👇
`npm config delete prefix ` 
`npm config set prefix $NVM_DIR/versions/node/v10.15.1` 

![git.jpg](http://ww1.sinaimg.cn/large/92babc53gy1gbmq2fukejj21ai35sqm4.jpg)

## Linux命令
cat file.js 输入 file.js 文件内容


### 分支重命名
#### 本地分支重命名（还没有推送到远程）
`git branch -m oldName newName`

#### 远程分支重命名（已经推送到远程）
1. `git branch -m oldName newName`
2. 删除远程分支**
`git push --delete origin oldName`
3. 上传新命名的本地分支
`git push origin newName`
   
### 区分大小写
设置大小写敏感
`git config --global core.ignorecase false`

修改文件较少的情况
```js
git mv -f [你想要删掉的文件] [你想要留下的文件]
git mv -f a.js A.js

等同于：

git rm a.js
git add A.js
```

修改文件较多的情况
- 在 github 删除该分支
- 本地执行 `git rm -r --cached .` 
- `git push`
