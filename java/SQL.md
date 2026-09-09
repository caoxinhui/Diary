---
title: "MySQL SQL 速查：DML / JOIN / 分组 / 子查询 / 窗口函数"
tags: [后端, MySQL]
prereq: []
related: [java/数据库.md]
deep: []
dup: []
---

# MySQL SQL 速查

以 **MySQL 8.0+** 为准（窗口函数、CTE 都是 8.0 才有的）。下文所有例子基于这张表结构：

```sql
CREATE TABLE users (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  name      VARCHAR(50) NOT NULL,
  city      VARCHAR(50),
  vip       TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id   BIGINT NOT NULL,
  amount    DECIMAL(10,2) NOT NULL,
  status    ENUM('paid','refunded','cancelled') NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_user (user_id),
  KEY idx_created (created_at)
);
```

### 逻辑执行顺序

SQL 是声明式的，**写的顺序 ≠ 执行顺序**。绝大多数「为什么这里不能用别名」「为什么 WHERE 里不能写聚合」都由这张图解释：

```
FROM / JOIN  →  ON  →  WHERE  →  GROUP BY  →  聚合函数  →  HAVING
   →  SELECT（含窗口函数）  →  DISTINCT  →  ORDER BY  →  LIMIT
```

由此直接推出四条规则：

| 现象 | 原因 |
| --- | --- |
| `WHERE` 里不能用聚合函数 | WHERE 在 GROUP BY 之前，那时还没分组 |
| `WHERE` 里不能用 SELECT 的别名，`ORDER BY` / `HAVING` 里可以 | 别名在 SELECT 阶段才存在，ORDER BY 在其后 |
| 窗口函数不能写在 `WHERE` / `GROUP BY` / `HAVING` 里 | 窗口函数在 SELECT 阶段算，比 HAVING 晚；要过滤得套一层子查询 |
| `LIMIT 10` 不代表「只扫 10 行」 | LIMIT 最后执行，前面该排的序、该建的临时表一样跑 |

## 一、SELECT / INSERT / UPDATE / DELETE

### SELECT

```sql
SELECT DISTINCT city, COUNT(*) AS cnt
FROM users
WHERE vip = 1 AND city IS NOT NULL      -- 判空只能用 IS NULL / IS NOT NULL
GROUP BY city
HAVING cnt > 10
ORDER BY cnt DESC, city ASC
LIMIT 20 OFFSET 40;                     -- 等价于 LIMIT 40, 20（注意这个写法顺序是反的）
```

几个容易被忽略的点：

- `NULL` 参与任何比较结果都是 `NULL`，`= NULL` 永远不成立；要判等且允许 NULL 用 NULL 安全等于 `a <=> b`。
- 深分页 `LIMIT 1000000, 20` 会先扫 100 万行再丢掉，改成**游标式分页**：`WHERE id > :last_id ORDER BY id LIMIT 20`。
- 加锁读：`FOR UPDATE`（排他）/ `FOR SHARE`（共享，8.0 起替代 `LOCK IN SHARE MODE`），可加 `SKIP LOCKED`（跳过被锁行，做任务队列常用）或 `NOWAIT`（不等直接报错）。

### INSERT

```sql
INSERT INTO users (name, city) VALUES ('张三', '北京');            -- 单行
INSERT INTO users (name, city) VALUES ('李四','上海'), ('王五','广州');  -- 批量，比循环单条快一个量级
INSERT INTO users_bak (name, city) SELECT name, city FROM users;   -- 从查询插入

-- 冲突时更新（幂等写入的标准做法）
INSERT INTO users (id, name, city) VALUES (1, '张三', '深圳') AS new
ON DUPLICATE KEY UPDATE city = new.city;
```

`AS new` 别名是 8.0.20 起的新语法，老写法 `VALUES(city)` 已废弃。

| 写法 | 行为 | 建议 |
| --- | --- | --- |
| `INSERT IGNORE` | 冲突时静默跳过，但**同时也吞掉类型截断等错误** | 少用，容易掩盖 bug |
| `REPLACE INTO` | 先 DELETE 再 INSERT | 慎用：未提供的列会被重置为默认值，自增 id 会变，还会触发删除类触发器 |
| `ON DUPLICATE KEY UPDATE` | 真正的 upsert | **首选** |

### UPDATE / DELETE

```sql
UPDATE orders SET status = 'refunded', amount = amount * 0.9
WHERE id = 100;

-- 多表 UPDATE：给 VIP 用户的订单打九折
UPDATE orders o JOIN users u ON o.user_id = u.id
SET o.amount = o.amount * 0.9
WHERE u.vip = 1;

DELETE FROM orders WHERE created_at < '2024-01-01' ORDER BY id LIMIT 1000;  -- 大批量删除要分批
DELETE o FROM orders o JOIN users u ON o.user_id = u.id WHERE u.vip = 0;    -- 多表 DELETE
```

- 单表 `UPDATE` / `DELETE` 支持 `ORDER BY ... LIMIT`，多表版本**不支持**。
- 一次删几百万行会撑爆 undo log 和主从延迟，一定要 `LIMIT` 分批 + 每批间隔提交。
- 清空整表用 `TRUNCATE`：DDL，不可回滚、不走逐行触发器、重置自增，但比 `DELETE` 快得多。

| | DELETE | TRUNCATE | DROP |
| --- | --- | --- | --- |
| 类型 | DML，可回滚 | DDL，不可回滚 | DDL，不可回滚 |
| 表结构 | 保留 | 保留 | 一起删 |
| 自增值 | 保留 | 重置为 1 | — |
| 速度 | 慢（逐行写 undo） | 快 | 快 |

## 二、JOIN

| 类型 | 保留什么 | 说明 |
| --- | --- | --- |
| `INNER JOIN` | 两边都匹配的行 | `JOIN` 默认就是 INNER |
| `LEFT JOIN` | 左表全部 + 右表匹配的（不匹配补 NULL） | 最常用 |
| `RIGHT JOIN` | 右表全部 | 语义等价于交换两表的 LEFT JOIN，可读性差，少用 |
| `CROSS JOIN` | 笛卡尔积 | MySQL 里 `CROSS JOIN` = `JOIN` = `,`，只是习惯上不写 ON 时用它 |
| `STRAIGHT_JOIN` | 同 INNER，但强制左表先驱动 | 只在确认优化器选错顺序时用 |

MySQL **没有 `FULL OUTER JOIN`**，用 UNION 模拟：

```sql
SELECT u.*, o.id FROM users u LEFT JOIN orders o ON u.id = o.user_id
UNION
SELECT u.*, o.id FROM users u RIGHT JOIN orders o ON u.id = o.user_id;
```

### 最经典的两个坑

**1）LEFT JOIN 的右表条件写在 WHERE 里，会退化成 INNER JOIN**

```sql
-- ❌ status 判断在 WHERE：右表补的 NULL 行被 WHERE 过滤掉，等于 INNER JOIN
SELECT u.name, o.amount FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.status = 'paid';

-- ✅ 条件放 ON：没有 paid 订单的用户也留下，amount 为 NULL
SELECT u.name, o.amount FROM users u
LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'paid';
```

记法：**ON 决定「怎么配对」，WHERE 决定「配完后留谁」**。左表自身的过滤条件放 WHERE 更好（能提前减少驱动行数）。

**2）JOIN 出来的行数变多导致聚合翻倍**

一个用户有 3 个订单，`LEFT JOIN` 后该用户就是 3 行，此时 `SUM(u.balance)` 会把余额算 3 遍。多个一对多表同时 JOIN 时尤其明显。解法是**先聚合再 JOIN**：

```sql
SELECT u.name, IFNULL(o.total, 0) AS total
FROM users u
LEFT JOIN (SELECT user_id, SUM(amount) AS total FROM orders GROUP BY user_id) o
  ON u.id = o.user_id;
```

### 半连接 / 反连接

「有没有」的语义不要用 JOIN（会重复行），用 `EXISTS` / `NOT EXISTS`：

```sql
SELECT * FROM users u WHERE     EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);  -- 下过单的
SELECT * FROM users u WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);  -- 从没下单的
```

### 性能要点

- JOIN 列必须有索引，且**两边类型和字符集要一致**，否则发生隐式转换直接放弃索引（`VARCHAR` join `INT` 是高频事故）。
- 8.0.18 起支持 **Hash Join**（等值连接、无可用索引时自动使用），8.0.20 起 Block Nested-Loop 被移除、外连接也能走 hash join。「MySQL 只有嵌套循环」是过期结论。
- 关联表控制在 3～5 张以内；`optimizer_switch` 里的 `join_buffer_size` 影响 hash join 是否落盘。
- 避免 `NATURAL JOIN` 和 `USING`：靠列名同名隐式匹配，加个字段就可能悄悄改变语义。

## 三、聚合函数

把多行压成一行。**除 `COUNT(*)` 外，所有聚合函数都忽略 NULL**。

| 函数 | 说明 |
| --- | --- |
| `COUNT(*)` | 行数，包含 NULL 行 |
| `COUNT(col)` | col 非 NULL 的行数 |
| `COUNT(DISTINCT col)` | 去重计数 |
| `SUM` / `AVG` | 求和 / 平均，**分母只算非 NULL 行** |
| `MAX` / `MIN` | 极值，可用于字符串和日期 |
| `GROUP_CONCAT(col ORDER BY x SEPARATOR ',')` | 把组内值拼成字符串 |
| `JSON_ARRAYAGG` / `JSON_OBJECTAGG` | 8.0 起，聚合成 JSON |
| `STDDEV_SAMP` / `VAR_SAMP` | 样本标准差 / 方差 |
| `BIT_OR` / `BIT_AND` / `BIT_XOR` | 位聚合，做标志位合并 |
| `ANY_VALUE(col)` | 「随便取一个」，专门用来绕过 `ONLY_FULL_GROUP_BY` |

坑：

- `AVG(score)` 里 NULL 不算入分母，想当 0 算要写 `AVG(IFNULL(score, 0))`，或者 `SUM(score) / COUNT(*)`。
- `GROUP_CONCAT` 受 `group_concat_max_len` 限制（默认 1024 字节），**超长会静默截断**，不报错。用它拼 ID 传给上层是常见的踩坑点。
- 条件计数不要写多条 SQL，用聚合里嵌 CASE（行转列的基础）：

```sql
SELECT user_id,
       COUNT(*)                                        AS all_cnt,
       SUM(status = 'paid')                            AS paid_cnt,     -- 布尔当 1/0 用，MySQL 特有的简写
       COUNT(CASE WHEN status = 'refunded' THEN 1 END) AS refund_cnt,   -- 标准写法
       SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid_amount
FROM orders GROUP BY user_id;
```

- `COUNT(*)`、`COUNT(1)`、`COUNT(主键)` 在 InnoDB 里性能没有区别，优化器都会挑最小的可用索引扫。直接写 `COUNT(*)`。

## 四、GROUP BY 与 HAVING

```sql
SELECT city, COUNT(*) AS cnt, AVG(amount) AS avg_amt
FROM users u JOIN orders o ON u.id = o.user_id
WHERE o.created_at >= '2026-01-01'   -- 分组前过滤原始行：能用索引，优先放这里
GROUP BY city
HAVING cnt >= 5 AND avg_amt > 100    -- 分组后过滤聚合结果：只能放这里
ORDER BY cnt DESC;
```

**WHERE 和 HAVING 的唯一区别**：WHERE 过滤「行」（GROUP BY 之前），HAVING 过滤「组」（GROUP BY 之后，可以用聚合函数）。凡是不依赖聚合结果的条件，一律往 WHERE 挪。

### ONLY_FULL_GROUP_BY

5.7 起默认开启：`SELECT` 里的非聚合列必须出现在 `GROUP BY` 中（或函数依赖于它）。

```sql
-- ❌ name 既不在 GROUP BY 里也不是聚合 → 报错
SELECT city, name, COUNT(*) FROM users GROUP BY city;
-- ✅ 三种改法
SELECT city, MAX(name),        COUNT(*) FROM users GROUP BY city;  -- 明确要极值
SELECT city, ANY_VALUE(name),  COUNT(*) FROM users GROUP BY city;  -- 明确「不在乎取哪个」
SELECT city, name,             COUNT(*) FROM users GROUP BY city, name;
```

别去关这个开关。它拦住的正是「一组里有多个 name，你到底想要哪个」这种语义不明确的查询——老版本 MySQL 随机返回一个，是无声的数据错误。

### 小计与多维汇总

```sql
SELECT IFNULL(city, '全部') AS city, COUNT(*) AS cnt, GROUPING(city) AS is_total
FROM users GROUP BY city WITH ROLLUP;
```

`WITH ROLLUP` 会额外产出小计行（分组列为 NULL）。用 `GROUPING(col)` 区分「这是小计行」还是「这列的值本来就是 NULL」。

其他注意点：

- 8.0 起 **`GROUP BY` 不再隐式排序**，也删除了 `GROUP BY col DESC` 语法。要顺序必须显式写 `ORDER BY`。
- `GROUP BY` 用不上索引时会建临时表 + filesort，`EXPLAIN` 里出现 `Using temporary; Using filesort` 就该考虑加联合索引（顺序与 GROUP BY 一致）。

## 五、子查询与 CTE

按返回形状分四类：

```sql
-- 1) 标量子查询：返回 1 行 1 列，可以当值用
SELECT name, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_cnt FROM users u;

-- 2) 列子查询：返回 1 列多行，配 IN / ANY / ALL
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE amount > 1000);
SELECT * FROM orders WHERE amount > ALL (SELECT amount FROM orders WHERE status = 'refunded');

-- 3) 行子查询：返回 1 行多列
SELECT * FROM orders WHERE (user_id, amount) = (SELECT id, 100 FROM users WHERE name = '张三');

-- 4) 派生表：出现在 FROM 里，必须起别名
SELECT t.user_id, t.total FROM (SELECT user_id, SUM(amount) total FROM orders GROUP BY user_id) t
WHERE t.total > 500;
```

**相关子查询**（correlated）指内层引用了外层的列，如上面第 1 例的 `u.id`——它逻辑上对每一行外层记录都执行一次，行数多时是性能杀手，能改 JOIN 就改 JOIN。

### `NOT IN` + NULL：最隐蔽的一个坑

```sql
-- 如果子查询结果里含一个 NULL，整个查询返回空集，且不报错
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM orders);
```

原因：`id NOT IN (1, 2, NULL)` 展开为 `id<>1 AND id<>2 AND id<>NULL`，最后一项恒为 `NULL`（不是 TRUE），整个 AND 永远不成立。**只要子查询列可能为 NULL，就用 `NOT EXISTS`**（`NOT EXISTS` 不受 NULL 影响）。

### CTE（8.0 起）

`WITH` 把子查询提到前面，可以复用、可读性远好于层层嵌套：

```sql
WITH paid AS (
  SELECT user_id, SUM(amount) AS total FROM orders WHERE status = 'paid' GROUP BY user_id
), top_user AS (
  SELECT * FROM paid WHERE total > 1000
)
SELECT u.name, t.total FROM top_user t JOIN users u ON u.id = t.user_id;
```

递归 CTE 用来查树形结构（部门、评论、上下级）：

```sql
WITH RECURSIVE tree AS (
  SELECT id, parent_id, name, 1 AS lvl FROM dept WHERE id = 1        -- 种子
  UNION ALL
  SELECT d.id, d.parent_id, d.name, t.lvl + 1                        -- 递归部分，引用自身
  FROM dept d JOIN tree t ON d.parent_id = t.id
)
SELECT * FROM tree;
```

递归深度上限由 `cte_max_recursion_depth` 控制（默认 1000），数据有环会直接撞上限报错。

其他注意点：

- `IN (子查询)` **不支持 `LIMIT`**（报 `This version of MySQL doesn't yet support...`），套一层派生表绕过：`IN (SELECT * FROM (... LIMIT 10) x)`。
- 「小表用 IN、大表用 EXISTS」是 5.5 时代的结论。5.6 起优化器会把 IN 子查询转成半连接（semi-join，含 materialization / FirstMatch 等策略），两者性能通常相当，以 `EXPLAIN` 为准。
- CTE 默认可能被优化器合并进外层（不物化），需要控制时用 hint `/*+ MERGE(cte) */` 或 `/*+ NO_MERGE(cte) */`。
- `LATERAL`（8.0.14 起）让派生表引用左侧表的列，适合「每个用户取最近 3 单」这类 Top-N per group：

```sql
SELECT u.name, o.id, o.amount FROM users u,
LATERAL (SELECT id, amount FROM orders WHERE user_id = u.id ORDER BY created_at DESC LIMIT 3) o;
```

## 六、UNION / INTERSECT / EXCEPT

纵向拼接结果集（JOIN 是横向）。要求各分支**列数相同、类型兼容**，最终列名取自第一个分支。

| 运算 | 语义 | 版本 |
| --- | --- | --- |
| `UNION` | 并集，**去重**（隐含一次排序或哈希，有成本） | — |
| `UNION ALL` | 并集，不去重，最快 | — |
| `INTERSECT` | 交集，去重 | 8.0.31+ |
| `EXCEPT` | 差集（A 有 B 没有），去重 | 8.0.31+ |

**默认写 `UNION ALL`**，只在确实需要去重时才用 `UNION`。

```sql
-- ORDER BY / LIMIT 作用于整体时写在最后；要作用于单个分支必须加括号
(SELECT id, amount FROM orders WHERE status = 'paid'     ORDER BY amount DESC LIMIT 5)
UNION ALL
(SELECT id, amount FROM orders WHERE status = 'refunded' ORDER BY amount DESC LIMIT 5)
ORDER BY amount DESC;
```

- 分支里的 `ORDER BY` 不配 `LIMIT` 会被优化器丢掉——单独排序对最终结果没有意义。
- `INTERSECT` 优先级高于 `UNION` 和 `EXCEPT`，混用时用括号写清楚。
- 一个实用场景：`UNION ALL` 拆分 `OR` 条件。`WHERE a = 1 OR b = 2` 常常两个索引都用不上，拆成两个分支各走一个索引再 `UNION` 去重，往往更快（`index_merge` 优化不生效时的手动版本）。

## 七、窗口函数（8.0 起）

聚合函数把多行压成一行，**窗口函数保留每一行，同时在旁边附上跨行计算的结果**。这是它和 `GROUP BY` 的根本区别。

```sql
SELECT id, user_id, amount,
       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY amount DESC) AS rn,
       SUM(amount)  OVER (PARTITION BY user_id)                      AS user_total,
       amount / SUM(amount) OVER (PARTITION BY user_id) * 100        AS pct
FROM orders;
```

`OVER` 子句三段：`PARTITION BY`（怎么分组，不写就是全表一组）、`ORDER BY`（组内怎么排）、frame（算哪几行）。

### 常用函数

| 函数 | 用途 |
| --- | --- |
| `ROW_NUMBER()` | 1,2,3,4 —— 严格递增，并列也不同号 |
| `RANK()` | 1,2,2,4 —— 并列同号，**跳号** |
| `DENSE_RANK()` | 1,2,2,3 —— 并列同号，不跳号 |
| `NTILE(n)` | 均分成 n 桶，用来分位数分层 |
| `LAG(col, n, default)` / `LEAD(...)` | 取前 n 行 / 后 n 行的值，算环比、时间差 |
| `FIRST_VALUE` / `LAST_VALUE` / `NTH_VALUE` | 窗口内第一 / 最后 / 第 n 行的值 |
| `PERCENT_RANK()` / `CUME_DIST()` | 百分比排名 / 累积分布 |
| 聚合函数 + `OVER` | `SUM` / `AVG` / `COUNT` / `MAX` / `MIN` 都能当窗口函数用，做累计值、移动平均 |

### 两个高频场景

**分组取 Top N**——窗口函数出现前只能靠自连接或变量骚操作：

```sql
SELECT * FROM (
  SELECT id, user_id, amount,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY amount DESC) AS rn
  FROM orders
) t WHERE rn <= 3;   -- 必须套一层：窗口函数不能写在 WHERE 里（MySQL 也没有 QUALIFY）
```

**累计与环比**：

```sql
SELECT created_at, amount,
       SUM(amount) OVER (ORDER BY created_at) AS running_total,          -- 累计求和
       AVG(amount) OVER (ORDER BY created_at ROWS 6 PRECEDING) AS ma7,   -- 7 日移动平均
       amount - LAG(amount) OVER (ORDER BY created_at) AS diff           -- 与上一行的差
FROM orders;
```

### frame（窗口范围）—— 最容易出错的地方

有 `ORDER BY` 时，默认 frame 是 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`（从头到当前行）；没有 `ORDER BY` 时是整个分区。

```
ROWS  BETWEEN 2 PRECEDING AND CURRENT ROW     -- 按物理行数：前 2 行 + 当前行
RANGE BETWEEN 2 PRECEDING AND CURRENT ROW     -- 按 ORDER BY 列的值域，且并列行（peer）全部算进来
ROWS  BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING   -- 整个分区
```

由此产生两个必踩的坑：

1. **`LAST_VALUE` 默认返回当前行**，因为默认 frame 到 CURRENT ROW 就截止了。想取分区最后一行必须显式写 `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`。
2. `SUM(amount) OVER (ORDER BY created_at)` 用的是 `RANGE`，**同一时间的多行会得到相同的累计值**。要严格逐行累计，写成 `ORDER BY created_at ROWS UNBOUNDED PRECEDING`（或在 ORDER BY 里补一个唯一列打破并列）。

多个窗口函数共用同一个窗口定义时，用命名窗口避免复制粘贴：

```sql
SELECT user_id, amount,
       ROW_NUMBER() OVER w, SUM(amount) OVER w
FROM orders
WINDOW w AS (PARTITION BY user_id ORDER BY amount DESC);
```

其他限制：窗口函数里**不支持 `DISTINCT`**（`COUNT(DISTINCT x) OVER ()` 不合法）；窗口函数不能嵌套窗口函数，要分层就套子查询 / CTE。

## 八、坑合集

| 说法 / 写法 | 纠正 |
| --- | --- |
| `WHERE col = NULL` | 永远不成立，用 `IS NULL` 或 `<=>` |
| `NOT IN (子查询)` | 子查询含 NULL 时返回空集，改 `NOT EXISTS` |
| `LEFT JOIN` + 右表条件写 WHERE | 退化成 INNER JOIN，条件应放 ON |
| `SELECT *` | 多读列、破坏覆盖索引、上层代码依赖列顺序，生产代码显式列出字段 |
| `LIMIT 100000, 20` | 深分页扫全部前置行，改游标分页 |
| `GROUP BY` 自带排序 | 8.0 起不再隐式排序，必须显式 `ORDER BY` |
| MySQL 没有 hash join | 8.0.18 起有，8.0.20 起外连接也支持 |
| MySQL 没有 `INTERSECT` / `EXCEPT` | 8.0.31 起支持 |
| 小表 IN、大表 EXISTS | 5.6 起半连接优化后基本等价，看 `EXPLAIN` |
| `COUNT(1)` 比 `COUNT(*)` 快 | InnoDB 中完全一样 |
| 用 `VALUES(col)` 做 upsert | 8.0.20 起废弃，改 `AS new ... = new.col` |
| `GROUP_CONCAT` 结果不全 | `group_concat_max_len` 默认 1024 字节，静默截断 |

## 九、面试高频追问

**Q：GROUP BY 和窗口函数怎么选？**
要「压成汇总行」用 GROUP BY；要「每行都保留，同时带上汇总/排名/环比」用窗口函数。分组取 Top N、累计值、同比环比，都是窗口函数的主场。

**Q：为什么窗口函数不能写在 WHERE 里？**
执行顺序上窗口函数在 SELECT 阶段计算，比 WHERE / HAVING 都晚。MySQL 没有 `QUALIFY`，只能套一层子查询或 CTE 再过滤。

**Q：HAVING 能不用 GROUP BY 吗？**
能。不写 GROUP BY 时整个结果集视为一组，`SELECT COUNT(*) FROM t HAVING COUNT(*) > 10` 合法。但这种写法可读性差，不建议。

**Q：`EXPLAIN` 里最该关注什么？**
`type`（`ALL` 全表扫是红灯，理想是 `ref` / `range` / `eq_ref` / `const`）、`key`（实际用了哪个索引）、`rows`（预估扫描行数）、`Extra`（`Using index` 是覆盖索引，好；`Using temporary` / `Using filesort` 通常意味着 GROUP BY / ORDER BY 用不上索引）。8.0 可以用 `EXPLAIN ANALYZE` 看真实执行耗时。

**Q：一条慢 SQL 怎么排查？**
先 `EXPLAIN` 看是否走索引、扫多少行；再看是不是索引失效的典型场景（列上套函数、隐式类型转换、`LIKE '%x'` 前缀模糊、联合索引不满足最左前缀、`OR` 拼接）；然后看是否有临时表和 filesort；最后才考虑改写 SQL（先聚合再 JOIN、拆 UNION ALL）或补联合索引。

<!-- KG:AUTO-START 由 scripts/kg.mjs build 生成，请勿手改；关系维护在 frontmatter -->
### 相关内容
- **相关**：[MySQL / Redis / MongoDB 对比](./数据库.md)
- **被引用**：[InnoDB 四大件：索引 / MVCC / 锁 / Buffer Pool](./InnoDB.md)
<!-- KG:AUTO-END -->
