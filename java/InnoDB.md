---
title: "InnoDB 四大件：索引 / MVCC / 锁 / Buffer Pool"
tags: [后端, MySQL]
prereq: [java/SQL.md]
related: [java/数据库.md]
deep: []
dup: []
---

# InnoDB 四大件：索引 / MVCC / 锁 / Buffer Pool

一句话各是什么：

| | 是什么 | 解决什么问题 |
| --- | --- | --- |
| **索引** | 磁盘上的 B+ 树数据结构 | 怎么**快速找到**一行 |
| **Buffer Pool** | 内存里的页缓存 | 怎么**不碰磁盘**也能读写 |
| **锁** | 加在索引记录和间隙上的标记 | 并发写时怎么**不写乱** |
| **MVCC** | undo 版本链 + ReadView | 并发读时怎么**不用等锁** |

四者不是并列的知识点，而是一条链上的环节。一条 `UPDATE orders SET amount = 100 WHERE id = 1` 会依次用到全部四个：

```
1. 索引        走主键 B+ 树，定位到 id=1 所在的那个 16KB 数据页
2. Buffer Pool 页不在内存 → 从磁盘读进来；在内存则直接用
3. 锁          在索引记录上加行锁（X 锁），别的事务改这行要排队
4. MVCC        旧值写进 undo log，形成版本链；页在内存里被改成新值
5. redo log    顺序写日志后事务即可提交（WAL），脏页留在 Buffer Pool
6. 刷盘        后台线程异步把脏页写回磁盘
   ↓
   之后其他事务来读这一行，靠 ReadView + 版本链决定它看到 100 还是旧值
```

记住这条链，四个概念的关系就清楚了：**索引解决「在哪」，Buffer Pool 解决「快不快」，锁解决「写冲突」，MVCC 解决「读不被写堵住」**。

## 一、索引

### 为什么是 B+ 树

候选结构里：哈希表不支持范围查询和排序；二叉树 / 红黑树高度太高（每层一次磁盘 IO）；B 树的非叶子节点也存数据，导致每页能放的键更少、树更高。

B+ 树的两个关键设计：

- **非叶子节点只存键和指针**，不存数据 → 一页能放上千个键，树非常矮。
- **叶子节点存数据，并用双向链表串起来** → 范围查询 `BETWEEN`、`ORDER BY`、`LIMIT` 都能顺着链表扫，不用回到根节点。

算一下高度：页大小 16KB，非叶子节点一条记录 = 主键 8B + 指针 6B ≈ 14B，则一页约 1170 个指针；叶子页按每行 1KB 算能放 16 行。

```
2 层：1170 × 16          ≈ 1.8 万行
3 层：1170 × 1170 × 16   ≈ 2200 万行
4 层：                    ≈ 250 亿行
```

**三层 B+ 树就能撑两千万行**，且根节点常驻内存，查一行最多 2～3 次磁盘 IO。这就是「单表两千万行」这个经验数字的由来。

### 聚簇索引与二级索引

InnoDB 的表**本身就是一棵 B+ 树**（索引组织表），这棵树叫聚簇索引：

- **聚簇索引**（主键索引）：叶子节点存**整行数据**。每张表必然有且只有一个。没显式建主键时，InnoDB 找第一个 `NOT NULL` 的唯一索引；再没有就偷偷生成一个 6 字节的 `DB_ROW_ID` 隐藏列。
- **二级索引**（辅助索引）：叶子节点只存**索引列 + 主键值**。

所以二级索引查询要走两棵树：

```sql
SELECT * FROM users WHERE name = '张三';
-- ① 在 name 索引树上找到 '张三' → 拿到主键 id=5
-- ② 拿 id=5 去聚簇索引树上找整行        ← 这一步叫「回表」
```

由此推出几条实践结论：

- **主键要短**：每个二级索引的叶子都存一份主键值，用 UUID（36 字节）当主键会让所有二级索引膨胀。
- **主键要单调递增**：自增主键顺序写入，页依次填满；随机主键（UUID）会插到已满页的中间，触发**页分裂**，产生碎片、拖慢写入。
- **覆盖索引免回表**：查询要的列都在二级索引里就不用回表。`SELECT id, name FROM users WHERE name = ?` 只走 name 索引就够了，`EXPLAIN` 的 Extra 显示 `Using index`。这是「别写 `SELECT *`」最实质的理由。

### 最左前缀

联合索引 `KEY idx(a, b, c)` 的排序规则是：先按 a 排，a 相同再按 b 排，b 相同再按 c 排。所以它只能从左边开始用：

| 查询条件 | 能用到 |
| --- | --- |
| `a = 1` | a |
| `a = 1 AND b = 2` | a, b |
| `a = 1 AND b = 2 AND c = 3` | a, b, c |
| `b = 2` / `b = 2 AND c = 3` | **用不上**（缺 a） |
| `a = 1 AND c = 3` | 只有 a，c 用不上（b 断了） |
| `a > 1 AND b = 2` | a 用于范围定位，**b 用不上有序性**（a 不同时 b 是乱的） |
| `a = 1 ORDER BY b` | a 过滤 + b 免排序（无 filesort） |

推论：**范围条件要放在联合索引的最后一列**，等值条件放前面。建 `(status, created_at)` 而不是 `(created_at, status)`。

条件写的顺序无所谓（`b = 2 AND a = 1` 一样能用），优化器会自己调整。

### 索引失效的典型场景

```sql
WHERE YEAR(created_at) = 2026      -- ❌ 列上套函数 → 改 created_at >= '2026-01-01' AND < '2027-01-01'
WHERE amount + 1 > 100             -- ❌ 列参与运算   → 改 amount > 99
WHERE phone = 13800138000          -- ❌ phone 是 varchar，数字比较触发隐式转换 → 加引号
WHERE name LIKE '%三'              -- ❌ 前缀模糊，B+ 树按前缀有序，无从下手
WHERE a = 1 OR d = 2               -- ❌ d 无索引则整体全表扫（都有索引时可能走 index_merge）
WHERE city IS NOT NULL             -- ⚠️ 语法上能用索引，但选择性太差时优化器会主动放弃
```

最后一条是关键认知：**索引不是「能用就一定用」**。优化器基于统计信息估算成本，当预计要回表的行数超过全表的一定比例（经验值 20%～30%）时，它会认为顺序全表扫比大量随机回表更快，于是放弃索引。这不是 bug。

### 8.0 的几个新东西

| 特性 | 说明 |
| --- | --- |
| 降序索引 | `KEY(a ASC, b DESC)` 真正生效。8.0 之前 `DESC` 是被解析后忽略的 |
| 隐藏索引 | `ALTER TABLE t ALTER INDEX idx INVISIBLE`，优化器不再使用但索引还在。删索引前先隐藏观察几天，出问题秒回滚 |
| 函数索引 | `CREATE INDEX idx ON t ((YEAR(created_at)))`，8.0.13 起。本质是自动创建的隐藏生成列 |
| 跳跃扫描 | Index Skip Scan，8.0.13 起。`(a, b)` 索引在缺 a 条件时，若 a 的取值极少，会枚举 a 的每个值再用 b —— 最左前缀有了有限的例外 |

其他两个常被问到的机制：

- **索引下推 ICP**（5.6+）：`(name, age)` 索引遇到 `WHERE name LIKE '张%' AND age = 20`，age 无法参与索引定位，但它在索引里有值，于是把 age 的判断**下推到存储引擎层**先过滤，减少回表次数。`EXPLAIN` 显示 `Using index condition`。
- **前缀索引**：`KEY(email(10))` 只索引前 10 个字符，省空间，但**无法覆盖索引、无法用于排序和 DISTINCT**。用 `COUNT(DISTINCT LEFT(col, n)) / COUNT(*)` 选合适的截取长度。

## 二、MVCC

**多版本并发控制。核心目的一句话：让普通 `SELECT` 不加锁也能读到一个一致的快照，从而「读不阻塞写，写不阻塞读」。**

如果没有 MVCC，要保证可重复读就只能读也加锁（Serializable 就是这么干的），并发度会崩。

### 三个组成部分

**1）行上的隐藏列**

每行除了你定义的列，还有：

| 隐藏列 | 大小 | 作用 |
| --- | --- | --- |
| `DB_TRX_ID` | 6 字节 | 最后一次修改这行的事务 ID |
| `DB_ROLL_PTR` | 7 字节 | 指向 undo log 里的上一个版本 |
| `DB_ROW_ID` | 6 字节 | 仅在没有主键和唯一索引时才有 |

**2）undo log 版本链**

每次 `UPDATE` 都把旧值写一条 undo log，新行的 `roll_ptr` 指向它，一行的历史就串成一条链：

```
最新行 (trx_id=30) ──roll_ptr──> undo (trx_id=20) ──roll_ptr──> undo (trx_id=10)
   amount=300                      amount=200                     amount=100
```

**3）ReadView（一致性视图）**

事务读数据时生成的快照凭证，四个字段：

- `m_ids`：生成时刻**所有活跃（未提交）事务的 ID 列表**
- `min_trx_id`：`m_ids` 里的最小值
- `max_trx_id`：下一个将分配的事务 ID
- `creator_trx_id`：创建这个 ReadView 的事务 ID

### 可见性判断

拿到一行后，用它的 `trx_id` 对照 ReadView 逐条判断：

```
trx_id == creator_trx_id  →  可见（自己改的）
trx_id <  min_trx_id      →  可见（在我开始前就已提交）
trx_id >= max_trx_id      →  不可见（在我生成 ReadView 之后才开启的事务）
min_trx_id ≤ trx_id < max_trx_id
      ├─ 在 m_ids 中       →  不可见（当时还活跃着，没提交）
      └─ 不在 m_ids 中     →  可见（当时已经提交了）
```

不可见就顺着 `roll_ptr` 往下取上一个版本，重新判断，直到找到可见版本或链条走完（走完说明这行对你不存在）。

### RC 和 RR 的差别只有一行代码

| 隔离级别 | ReadView 生成时机 | 结果 |
| --- | --- | --- |
| **RC**（读已提交） | **每次 `SELECT` 都新建一个** | 每次都能看到最新提交的数据 → 不可重复读 |
| **RR**（可重复读） | **第一次一致性读时建一个，整个事务复用** | 全程看同一个快照 → 可重复读 |

这就是两个隔离级别在实现上的**全部区别**。MySQL 默认是 RR（PostgreSQL、Oracle 默认 RC）；MySQL 选 RR 是历史原因——早期只有 statement 格式的 binlog，RC 下主从会不一致。

### 快照读 vs 当前读

MVCC 只管**快照读**。这是理解「为什么 RR 下有时还是看到了别人的新数据」的关键：

| | 语句 | 读什么 |
| --- | --- | --- |
| 快照读 | 普通 `SELECT`（RC / RR 下） | 走 MVCC，读历史版本，**不加锁** |
| 当前读 | `SELECT ... FOR UPDATE` / `FOR SHARE`、`UPDATE`、`DELETE`、`INSERT` | 读**最新已提交版本**，并**加锁** |

写操作必须是当前读——不然基于旧快照去改，就把别人的修改覆盖了。经典现象：RR 事务里 `SELECT` 看到 `amount=100`，紧接着 `UPDATE ... SET amount = amount + 1` 的结果却基于别人刚提交的 `200`。

MVCC 只在 RC 和 RR 下生效：读未提交直接读最新值（不看版本链），串行化把所有读都变成加锁的当前读。

### 长事务的代价

undo log 里的版本要等到「没有任何 ReadView 可能需要它」时才能被 purge 线程回收。一个开着不提交的事务会让它开始之后的所有版本都无法清理：

- undo 表空间无限膨胀（8.0 之前塞在 ibdata1 里，删不掉，只能重建实例）
- 版本链越来越长，每次读都要顺着链回溯，查询逐渐变慢
- 顺带一直占着行锁和 MDL

排查：`SELECT * FROM information_schema.innodb_trx WHERE TIME_TO_SEC(TIMEDIFF(NOW(), trx_started)) > 60;`

## 三、锁

### 全局锁 / 表级锁

| 锁 | 场景 |
| --- | --- |
| 全局读锁 `FLUSH TABLES WITH READ LOCK` | 全库逻辑备份（不支持事务的引擎才需要，InnoDB 用 `--single-transaction` 即可） |
| 表锁 `LOCK TABLES ... READ/WRITE` | InnoDB 里几乎不用 |
| **MDL（元数据锁）** | 5.5 起自动加。增删改查加 MDL **读**锁，DDL 加 MDL **写**锁 |
| 意向锁 `IS` / `IX` | 表级标记，表示「表内有行锁」。让表锁能 O(1) 判断冲突，不必逐行检查 |

**MDL 是线上事故重灾区**，机制值得单独记：读锁之间兼容，读写锁互斥，且**申请队列是先进先出的**。所以给大表加字段时——

```
事务 A：一个跑了 10 分钟的慢查询，持有 MDL 读锁
事务 B：ALTER TABLE 加字段，申请 MDL 写锁 → 被 A 阻塞，进入队列
事务 C/D/E...：普通 SELECT，申请 MDL 读锁 → 排在 B 后面，全部阻塞
                                             ↑ 整张表瞬间不可用
```

所以线上 DDL 前必须先检查有没有长事务（`information_schema.innodb_trx`），并给 DDL 加超时：`ALTER TABLE t WAIT 5 ADD COLUMN ...`（或用 gh-ost / pt-online-schema-change）。

### 行锁的三种形态

**前提：InnoDB 的行锁是加在索引记录上的，不是加在「行」这个抽象概念上。**

| 锁 | 锁住什么 | 备注 |
| --- | --- | --- |
| **Record Lock** | 单条索引记录 | |
| **Gap Lock** | 两条索引记录之间的**间隙** | **只在 RR 下存在**；间隙锁之间互不冲突，它只阻止**插入** |
| **Next-Key Lock** | Record + 它前面的 Gap，即左开右闭区间 `(前一条, 当前条]` | **RR 下的默认行为** |
| **Insert Intention Lock** | 插入前在间隙上加的意向锁 | 与 Gap Lock 冲突 —— 这才是 `INSERT` 被阻塞的直接原因 |

Gap Lock 存在的唯一目的是**防幻读**：既然要阻止「同一个范围两次查询行数不同」，就必须阻止别人往这个范围里插入新行。而「不存在的行」没法加记录锁，只能锁住间隙。

### 加锁范围怎么算

RR 下 `SELECT ... FOR UPDATE` 的加锁范围有几条优化规则，面试爱问：

| 情况 | 加锁结果 |
| --- | --- |
| 唯一索引 / 主键，等值查询，**记录存在** | Next-Key **退化为 Record Lock**（只锁这一行，不锁间隙） |
| 唯一索引 / 主键，等值查询，**记录不存在** | Next-Key **退化为 Gap Lock**（只锁间隙，不锁记录） |
| 普通索引，等值查询 | Next-Key Lock + 向右扫到第一个不满足条件的值，在那个间隙上也加 Gap Lock |
| 范围查询 | 从满足条件的第一条开始，逐个加 Next-Key Lock，直到第一个不满足的记录为止 |
| **索引失效 / 无索引** | 扫全表，**给扫过的每一条记录都加锁**，效果接近锁表 |

最后一行是所有条目里最该记住的：`UPDATE users SET vip = 1 WHERE name = '张三'`，如果 `name` 上没索引，这条语句会锁住全表所有行。**「更新必须走索引」不是性能建议，是并发安全要求。**

RC 下没有 Gap Lock（只在外键检查和唯一键冲突检测时例外），所以 RC 的锁冲突远少于 RR，很多互联网公司把默认隔离级别调成 RC 就是这个原因。

### 隔离级别与三类读问题

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 实现手段 |
| --- | --- | --- | --- | --- |
| 读未提交 RU | 有 | 有 | 有 | 直接读最新值 |
| 读已提交 RC | — | 有 | 有 | MVCC，每次 SELECT 新建 ReadView |
| **可重复读 RR**（默认） | — | — | **基本没有** | MVCC + Next-Key Lock |
| 串行化 Serializable | — | — | — | 所有读都变成加 S 锁的当前读 |

RR 说「基本没有」而不是「没有」：SQL 标准里 RR 是允许幻读的，MySQL 靠 Gap Lock 额外解决了当前读的幻读。但特例仍然存在——先快照读、再当前读（`UPDATE` / `FOR UPDATE`）时，可能读到快照里不存在的行。

### 死锁

两个事务各持有对方需要的锁，互相等待。InnoDB 维护一张 wait-for 图**主动检测**，发现环就回滚其中一个（挑 undo 量小、代价低的那个），报 `Deadlock found when trying to get lock`。

```sql
SET GLOBAL innodb_lock_wait_timeout = 50;   -- 单次等锁超时，默认 50 秒，生产建议调到 5～10
SET GLOBAL innodb_deadlock_detect = ON;     -- 死锁检测。高并发热点行场景下检测本身是 CPU 热点，可关掉靠超时兜底
SHOW ENGINE INNODB STATUS;                  -- LATEST DETECTED DEADLOCK 段落，看最近一次死锁的两条 SQL
SELECT * FROM performance_schema.data_locks;      -- 8.0：当前持有和等待的锁
SELECT * FROM performance_schema.data_lock_waits; -- 8.0：谁在等谁
```

预防：**多个事务按同样的顺序访问多行**（最常见的死锁就是 A 改 id=1 再改 id=2、B 反着来）；事务尽量短小、把加锁语句放到事务末尾；避免大范围加锁。

## 四、Buffer Pool

InnoDB 在内存里维护的**页缓存**。磁盘和内存之间的交换单位是 16KB 的页，**所有读写都发生在 Buffer Pool 里**，磁盘只是它的后备存储。

- 读：页在 Buffer Pool 里直接返回；不在则从磁盘读进来（一次磁盘 IO），再返回。
- 写：改内存里的页，标记为**脏页**，写完 redo log 就可以提交了，脏页由后台线程异步刷盘。

这就是 InnoDB 写入快的根本原因：**把随机写磁盘变成了改内存 + 顺序写日志**（WAL，Write-Ahead Logging）。

### 三条链表

Buffer Pool 是一个个页帧的数组，用三条链表管理：

| 链表 | 内容 |
| --- | --- |
| **Free List** | 还没用过的空闲页 |
| **LRU List** | 已缓存的页，按冷热排序，内存不够时从尾部淘汰 |
| **Flush List** | 脏页（按最早修改时间排序），后台线程按序刷盘 |

一个页可以同时在 LRU List 和 Flush List 上（既是热页又是脏页）。

### 改良版 LRU：为什么不用朴素 LRU

朴素 LRU 有个致命问题：一次全表扫描（或预读进来的页）会把大量只用一次的冷页塞进链表头部，**把真正的热数据全部挤出去**，之后一段时间命中率暴跌。这叫缓存污染。

InnoDB 的解法是把 LRU 链表切成两段：

```
      young 区（5/8，热数据）          old 区（3/8）
[头] ============================ | ================== [尾 → 淘汰]
                                  ↑
                          新页从这里插入（old 区头部）
```

- 新读入的页先放到 **old 区头部**，而不是整个链表的头部。
- 要晋升到 young 区需要同时满足：在 old 区**停留超过 `innodb_old_blocks_time`（默认 1000ms）**，且**期间再次被访问**。

全表扫描的特征恰好是「一个页里的多行被连续读完，之后一秒内不再访问」，所以这些页会在 old 区待着并很快被淘汰，热数据毫发无损。参数 `innodb_old_blocks_pct` 默认 37（即 old 区占 37%）。

### 关键参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `innodb_buffer_pool_size` | 128MB | **最重要的一个**。生产建议物理内存的 50%～70%；8.0 起支持在线调整 |
| `innodb_buffer_pool_instances` | 8（size ≥ 1GB 时） | 切成多个实例，减少内部锁竞争 |
| `innodb_buffer_pool_chunk_size` | 128MB | 在线调整的粒度；实际 size 会被取整为 chunk × instances 的倍数 |
| `innodb_max_dirty_pages_pct` | 90 | 脏页比例上限，超过就强制刷盘 |
| `innodb_io_capacity` | 200 | 后台刷盘的 IOPS 预算。SSD 应显著调高（几千） |
| `innodb_flush_log_at_trx_commit` | 1 | **1 才保证提交不丢**（每次提交 fsync redo）；2 是崩溃丢 1 秒，0 是宕机丢 1 秒 |
| `innodb_dedicated_server` | OFF | 打开后自动按机器内存推算上面几个值，独占数据库机器时很省事 |

配套机制：

- **Change Buffer**：对**非唯一二级索引**页的修改，如果页不在内存，先记在 change buffer 里，等页被读进来时再 merge。避免了「为了写一条索引记录先随机读一个页」。唯一索引用不上（必须读页才能校验唯一性）。写多读少的表收益最大。
- **Double Write Buffer**：页 16KB 而磁盘扇区是 4KB，断电时可能只写了一半（partial page write），此时 redo log 也救不回来（redo 是对完好页的增量修改）。所以刷盘前先把页顺序写进 doublewrite 区，再写到真实位置，崩溃后可从 doublewrite 恢复完整页。
- **预读**：顺序访问同一个 extent 里超过 `innodb_read_ahead_threshold`（默认 56）个页时，异步把下一个 extent 整体读入。
- **预热**：`innodb_buffer_pool_dump_at_shutdown` / `load_at_startup`，8.0 默认开启。重启时恢复热页，避免冷启动后一段时间全是慢查询。

### 怎么看它工作得好不好

```sql
SHOW ENGINE INNODB STATUS;   -- BUFFER POOL AND MEMORY 段落
SHOW STATUS LIKE 'Innodb_buffer_pool_read%';
-- 命中率 = 1 - Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests
--   read_requests：逻辑读总次数     reads：不得不去磁盘的次数
-- 正常应 > 99%，长期低于 95% 说明 buffer pool 太小或有大量全表扫描
```

顺带一个常见误解：**Query Cache 不是 Buffer Pool**。前者缓存「SQL 文本 → 结果集」，因为任何写入都要整表失效、锁竞争严重，已在 **8.0 中彻底移除**。Buffer Pool 缓存的是数据页，一直都是核心组件。

## 五、四者串起来的高频追问

**Q：为什么单表建议不超过两千万行？**
不是硬限制，来自 B+ 树高度：三层能放约 2200 万行，再多就要四层，每次查询多一次磁盘 IO。加上二级索引占的内存、DDL 时间、备份时间一起变差，所以取了这个经验值。行很宽（叶子放不下 16 行）时这个数字会更小。

**Q：MVCC 已经解决了并发读，为什么还需要锁？**
MVCC 只解决读。两个事务同时改同一行时，必须靠锁串行化，否则后写的会覆盖前写的（丢失更新）。分工是：**读靠 MVCC，写靠锁**。

**Q：RR 下的幻读到底解决了没有？**
快照读靠 MVCC 解决（整个事务看同一个 ReadView，别人插入的行本来就看不见）；当前读靠 Next-Key Lock 解决（锁住间隙，别人插不进来）。两者配合基本解决，但先快照读再当前读的混用场景仍有特例。

**Q：为什么 `UPDATE` 不走索引会锁全表？**
行锁加在索引记录上。没有索引可用时 InnoDB 只能全表扫描，而扫描过程中**每一条被扫到的记录都要加锁**（否则无法保证判断条件的正确性），结果等价于锁表。

**Q：改了数据但还没提交，宕机了会怎样？**
未提交的事务由 undo log 回滚。已提交的事务即使脏页还在内存里，也能靠 redo log 重放恢复——这就是 WAL 的意义：**redo 保证已提交的不丢（前滚），undo 保证未提交的不留（回滚）**。

**Q：为什么长事务危害这么大？**
一句话踩四个坑：undo 无法 purge（空间膨胀 + 版本链变长）、行锁一直不释放（阻塞其他写）、MDL 读锁一直不释放（阻塞 DDL 及其后所有查询）、回滚时代价巨大。

<!-- KG:AUTO-START 由 scripts/kg.mjs build 生成，请勿手改；关系维护在 frontmatter -->
### 相关内容
- **前置**：[MySQL SQL 速查：DML / JOIN / 分组 / 子查询 / 窗口函数](./SQL.md)
- **相关**：[MySQL / Redis / MongoDB 对比](./数据库.md)
<!-- KG:AUTO-END -->
