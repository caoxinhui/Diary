#!/usr/bin/env node
// 知识图谱工具 —— 零依赖，只依赖下面这套 frontmatter 约定。
//
//   node scripts/kg.mjs init    给缺 frontmatter 的文件补骨架（幂等，不覆盖已有值）
//   node scripts/kg.mjs build   生成 README 索引 / GRAPH.md / 各文件「相关」区 / graph.json
//   node scripts/kg.mjs check   只校验不写盘（死链、孤儿、缺标签），适合放 CI
//
// frontmatter 约定（关系用「仓库根目录相对路径」，脚本负责换算成正确的相对链接）：
//   ---
//   title: 事件循环
//   tags: [JavaScript, 异步]
//   prereq:                      # 前置知识（有向：读本文前该先懂什么）
//     - Javascript/作用域、执行上下文.md
//   related:                     # 横向相关（无向，会自动补对向）
//     - 性能/浏览器.md
//   deep:                        # 深入一层（有向）
//     - 操作系统/纤程.md
//   dup: []                      # 内容重叠、待合并（无向），用于治理而非阅读
//   ---

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 注意：仓库路径含空格，必须用 fileURLToPath，不能用 url.pathname（会带 %20）
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP_DIRS = new Set(['.git', '.idea', '.claude', 'node_modules', 'scripts']);
const GENERATED = new Set(['README.md', 'GRAPH.md']);
const REL_KINDS = ['prereq', 'related', 'deep', 'dup'];
const SYMMETRIC = new Set(['related', 'dup']);   // 无向关系，build 时自动补对向
const REL_LABEL = { prereq: '前置', related: '相关', deep: '深入', dup: '内容重叠（待合并）' };

// 目录 → 默认标签。init 只用它做冷启动，之后以文件里的 tags 为准
const DIR_TAGS = {
  CSS: ['CSS'], ES6: ['JavaScript', 'ES6'], Git: ['工程化', 'Git'],
  HTTP: ['网络'], Javascript: ['JavaScript'], React: ['React'],
  'React-imvc': ['React', '同构'], Regex: ['JavaScript', '正则'],
  Typescript: ['TypeScript'], iframe: ['浏览器'], java: ['后端'],
  webpack: ['构建', '工程化'], 微前端: ['微前端', '架构'], 性能: ['性能'],
  操作系统: ['操作系统'], 数据结构: ['数据结构'], 模块化: ['模块化', '工程化'],
  浏览器: ['浏览器'], 算法: ['算法'], 编程范式: ['编程范式'], 面试题: ['面试题'],
  成长路线: ['成长路线'],
};

const toPosix = p => p.split('\\').join('/');

function walk(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (name.endsWith('.md')) out.push(toPosix(relative(ROOT, abs)));
  }
  return out.sort();
}

// ---------- frontmatter：只支持本约定用到的 YAML 子集 ----------
// 之所以手写而不上 gray-matter：仓库没有 package.json，保持零依赖。
// 关系值一律用块序列（- item），因为文件名里可能带逗号（如 call,bind,apply.md），
// 用 [a, b] 内联数组会被逗号切错。
function parseFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return { data: null, body: text };
  const close = lines.indexOf('---', 1);
  if (close === -1) return { data: null, body: text };

  const data = {};
  for (let i = 1; i < close; i++) {
    const m = lines[i].match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (raw === '') {                                   // 块序列
      const arr = [];
      while (i + 1 < close && /^\s*-\s+/.test(lines[i + 1])) {
        arr.push(unquote(lines[++i].replace(/^\s*-\s+/, '').trim()));
      }
      data[key] = arr;
    } else if (raw.startsWith('[')) {                   // 内联数组，仅用于 tags
      data[key] = raw.slice(1, raw.lastIndexOf(']')).split(',').map(s => unquote(s.trim())).filter(Boolean);
    } else {
      data[key] = unquote(raw);
    }
  }
  return { data, body: lines.slice(close + 1).join('\n').replace(/^\n+/, '') };
}

const unquote = s => s.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

function stringifyFrontmatter(d) {
  // title 一律加引号：标题里可能出现 ": "、"#"、"[" 等 YAML 元字符
  const out = ['---', `title: "${String(d.title ?? '').replace(/"/g, '\\"')}"`,
               `tags: [${(d.tags ?? []).join(', ')}]`];
  for (const k of REL_KINDS) {
    const arr = d[k] ?? [];
    if (arr.length === 0) out.push(`${k}: []`);
    else out.push(`${k}:`, ...arr.map(v => `  - ${v}`));
  }
  out.push('---');
  return out.join('\n');
}

const firstH1 = body => body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
const fileTitle = id => id.replace(/\.md$/, '').split('/').pop();

// ---------- 载入整个库 ----------
// 正文里的 [xx](../a/b.md) 也算一条边，这样已有的手写链接不会白费
const BODY_LINK = /\[[^\]]*\]\(([^)\s#]+\.md)(?:#[^)]*)?\)/g;

function load() {
  const docs = new Map();
  for (const id of walk()) {
    if (GENERATED.has(id)) continue;
    const text = readFileSync(join(ROOT, id), 'utf8');
    const { data, body } = parseFrontmatter(text);
    const rels = {};
    for (const k of REL_KINDS) rels[k] = (data?.[k] ?? []).slice();

    const bodyLinks = new Set();
    // 关键：先剥掉自动生成区再抽链接。否则上一轮生成的「相关内容」会被当成新的正文引用，
    // 每跑一次 build 边数就膨胀一轮（不幂等）。
    const handwritten = stripAuto(body);
    for (const [, href] of handwritten.matchAll(BODY_LINK)) {
      if (/^[a-z]+:\/\//.test(href)) continue;
      const target = toPosix(relative(ROOT, join(ROOT, dirname(id), decodeURIComponent(href))));
      if (!target.startsWith('..')) bodyLinks.add(target);
    }

    docs.set(id, {
      id, dir: id.includes('/') ? id.split('/')[0] : '.',
      hasFm: Boolean(data),
      title: data?.title || firstH1(body) || fileTitle(id),
      tags: data?.tags ?? [], rels, bodyLinks, body, text,
    });
  }
  return docs;
}

// ---------- init：补 frontmatter 骨架 ----------
function init() {
  let added = 0, filled = 0;
  for (const id of walk()) {
    if (GENERATED.has(id)) continue;
    const abs = join(ROOT, id);
    const text = readFileSync(abs, 'utf8');
    const { data, body } = parseFrontmatter(text);
    const next = {
      title: data?.title || firstH1(body) || fileTitle(id),
      tags: data?.tags?.length ? data.tags : (DIR_TAGS[id.split('/')[0]] ?? []),
    };
    for (const k of REL_KINDS) next[k] = data?.[k] ?? [];

    const out = `${stringifyFrontmatter(next)}\n\n${body.replace(/^\n+/, '')}`;
    if (out === text) continue;
    writeFileSync(abs, out);
    data ? filled++ : added++;
  }
  console.log(`init: 新增 frontmatter ${added} 个，补全/规范化 ${filled} 个`);
  console.log('下一步：给枢纽文件手工填 related / prereq / deep，然后跑 build');
}

// ---------- 图 ----------
function buildGraph(docs) {
  const edges = [];
  const dead = [];
  const add = (from, to, kind) => {
    if (from === to) return;
    if (!edges.some(e => e.from === from && e.to === to && e.kind === kind)) edges.push({ from, to, kind });
  };

  for (const doc of docs.values()) {
    for (const kind of REL_KINDS) {
      for (const to of doc.rels[kind]) {
        if (!docs.has(to)) { dead.push({ from: doc.id, to, kind }); continue; }
        add(doc.id, to, kind);
        if (SYMMETRIC.has(kind)) add(to, doc.id, kind);      // 无向关系自动补对向
      }
    }
    for (const to of doc.bodyLinks) {
      if (!docs.has(to)) { dead.push({ from: doc.id, to, kind: '正文链接' }); continue; }
      add(doc.id, to, 'link');
    }
  }
  return { edges, dead };
}

// 展示口径：related / dup 会自动补一条反向边，直接数 edges 会翻倍。
// 所以「关联数」一律按「有多少个不同的相邻文件 / 多少对文件相连」来算。
const neighbors = (edges, id) =>
  new Set(edges.flatMap(e => (e.from === id ? [e.to] : e.to === id ? [e.from] : [])));
const pairCount = edges => new Set(edges.map(e => [e.from, e.to].sort().join('|'))).size;

// 从 a.md 指向 b.md 的相对链接
function href(fromId, toId) {
  let rel = toPosix(relative(dirname(fromId), toId));
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/ /g, '%20');
}

const START = '<!-- KG:AUTO-START 由 scripts/kg.mjs build 生成，请勿手改；关系维护在 frontmatter -->';
const END = '<!-- KG:AUTO-END -->';

function stripAuto(text) {
  const s = text.indexOf(START);
  const e = text.indexOf(END);
  return s !== -1 && e !== -1 ? text.slice(0, s) + text.slice(e + END.length) : text;
}

function injectSection(text, section) {
  const s = text.indexOf(START);
  const e = text.indexOf(END);
  const had = s !== -1 && e !== -1;
  if (!section && !had) return text;                    // 无关系又无历史标记：原文不动，别制造 diff 噪音
  const stripped = had
    ? (text.slice(0, s) + text.slice(e + END.length)).replace(/\n{3,}$/, '\n')
    : text;
  if (!section) return stripped.replace(/\s+$/, '') + '\n';
  return `${stripped.replace(/\s+$/, '')}\n\n${START}\n${section}\n${END}\n`;
}

// ---------- build ----------
function relatedSection(doc, docs, edges) {
  const out = [], seen = new Set([doc.id]);
  const link = id => `[${docs.get(id).title}](${href(doc.id, id)})`;
  const row = (label, ids) => {
    const fresh = ids.filter(id => !seen.has(id));
    if (!fresh.length) return;
    fresh.forEach(id => seen.add(id));
    out.push(`- **${label}**：${fresh.map(link).join('、')}`);
  };

  const out_ = k => edges.filter(e => e.from === doc.id && e.kind === k).map(e => e.to);
  const in_ = k => edges.filter(e => e.to === doc.id && e.kind === k).map(e => e.from);

  row(REL_LABEL.prereq, out_('prereq'));
  row(REL_LABEL.deep, out_('deep'));
  row(REL_LABEL.related, out_('related'));
  row(REL_LABEL.dup, out_('dup'));
  row('被引用', [...in_('prereq'), ...in_('deep'), ...in_('link')]);

  return out.length ? `### 相关内容\n${out.join('\n')}` : '';
}

function build() {
  const docs = load();
  const { edges, dead } = buildGraph(docs);

  // 1) 往每个文件底部注入「相关内容」区
  let touched = 0;
  for (const doc of docs.values()) {
    const next = injectSection(doc.text, relatedSection(doc, docs, edges));
    if (next !== doc.text) { writeFileSync(join(ROOT, doc.id), next); touched++; }
  }

  // 2) README 只注入标记区，保留你原有的手写内容
  const readmePath = join(ROOT, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  writeFileSync(readmePath, injectSection(readme, renderIndex(docs, edges)));

  writeFileSync(join(ROOT, 'GRAPH.md'), renderGraph(docs, edges));
  writeFileSync(join(ROOT, 'graph.json'), JSON.stringify({
    nodes: [...docs.values()].map(d => ({ id: d.id, title: d.title, tags: d.tags, dir: d.dir })),
    edges,
  }, null, 2) + '\n');

  const degree = id => neighbors(edges, id).size;
  const orphans = [...docs.keys()].filter(id => degree(id) === 0);
  console.log(`build: ${docs.size} 个文件，${pairCount(edges)} 条关联，更新了 ${touched} 个文件的「相关内容」区`);
  console.log(`       孤儿（还没有任何关联）：${orphans.length} 个 —— 见 GRAPH.md 末尾清单`);
  if (dead.length) {
    console.log(`\n⚠️  ${dead.length} 条死链：`);
    dead.forEach(d => console.log(`   ${d.from} --${d.kind}--> ${d.to}（目标不存在）`));
  }
  return dead.length;
}

// ---------- README 索引区：按目录，每个文件出现一次 ----------
function renderIndex(docs, edges) {
  const deg = id => neighbors(edges, id).size;
  const byDir = new Map();
  for (const d of docs.values()) {
    if (!byDir.has(d.dir)) byDir.set(d.dir, []);
    byDir.get(d.dir).push(d);
  }
  const out = [
    '## 目录索引',
    '',
    `共 ${docs.size} 篇，${pairCount(edges)} 条关联。`,
    `按标签检索、关系图、待连接清单见 [GRAPH.md](GRAPH.md)。`,
    '',
    '> 维护方式：关系写在每个文件的 frontmatter（`prereq` 前置 / `related` 相关 / `deep` 深入 / `dup` 待合并，值用仓库根目录相对路径），',
    '> 然后跑 `node scripts/kg.mjs build` 重新生成本索引、GRAPH.md 和各文件底部的「相关内容」区；`check` 只校验不写盘。',
    '',
  ];
  for (const dir of [...byDir.keys()].sort()) {
    const list = byDir.get(dir).sort((a, b) => a.id.localeCompare(b.id));
    out.push(`<details><summary><b>${dir === '.' ? '根目录' : dir}</b>（${list.length}）</summary>`, '');
    for (const d of list) {
      const n = deg(d.id);
      out.push(`- [${d.title}](${d.id.replace(/ /g, '%20')})${n ? ` <sub>· ${n} 关联</sub>` : ''}`);
    }
    out.push('', '</details>', '');
  }
  return out.join('\n').replace(/\n+$/, '');
}

// ---------- GRAPH.md ----------
// Mermaid 里 label 用引号包住，并把会破坏语法的字符换掉
// & 和 ; 在 mermaid 里是链式/实体语法的一部分，即使在引号里也换成全角更稳
const mmLabel = s => `"${s.replace(/"/g, "'").replace(/[[\]{}()|]/g, ' ').replace(/#/g, '＃')
                        .replace(/&/g, '＆').replace(/;/g, '；')}"`;

function renderGraph(docs, edges) {
  const ids = [...docs.keys()];
  const nid = new Map(ids.map((id, i) => [id, `N${i}`]));
  const deg = id => neighbors(edges, id).size;
  const linked = ids.filter(id => deg(id) > 0);

  // 无向关系只画一次
  const drawn = new Set();
  const arrow = { prereq: '-->|前置|', deep: '-->|深入|', related: '---|相关|', dup: '-.-|重叠|', link: '-->' };
  const lines = [];
  for (const e of edges) {
    const key = SYMMETRIC.has(e.kind) || e.kind === 'link'
      ? [e.from, e.to].sort().join('|') + e.kind
      : `${e.from}>${e.to}${e.kind}`;
    if (drawn.has(key)) continue;
    drawn.add(key);
    lines.push(`  ${nid.get(e.from)} ${arrow[e.kind]} ${nid.get(e.to)}`);
  }

  const byTag = new Map();
  for (const d of docs.values()) for (const t of d.tags) {
    if (!byTag.has(t)) byTag.set(t, []);
    byTag.get(t).push(d);
  }

  // 按目录分组成 subgraph：97 个节点平铺是一团毛线，分组后跨目录的边才看得出来
  const dirs = [...new Set(linked.map(id => docs.get(id).dir))].sort();
  const nodeLines = [];
  dirs.forEach((dir, i) => {
    nodeLines.push(`  subgraph D${i}[${mmLabel(dir === '.' ? '根目录' : dir)}]`);
    linked.filter(id => docs.get(id).dir === dir)
      .forEach(id => nodeLines.push(`    ${nid.get(id)}[${mmLabel(docs.get(id).title)}]`));
    nodeLines.push('  end');
  });

  const out = [
    '# 知识图谱', '',
    '> 本文件由 `node scripts/kg.mjs build` 生成，请勿手改。关系维护在各文件的 frontmatter 里。', '',
    `- 文件：${docs.size} 篇`,
    `- 关联：${pairCount(edges)} 对`,
    `- 已接入图谱：${linked.length} 篇；孤立：${docs.size - linked.length} 篇`,
    `- 标签：${byTag.size} 个`, '',
    '## 关系图', '',
    '只画有关联的节点（孤立节点见文末清单），按目录分组。`前置`/`深入` 有向，`相关`/`重叠` 无向。', '',
    '```mermaid', 'graph LR',
    ...nodeLines,
    ...lines,
    '```', '',
    '## 按标签检索', '',
  ];

  for (const tag of [...byTag.keys()].sort((a, b) => byTag.get(b).length - byTag.get(a).length)) {
    const list = byTag.get(tag).sort((a, b) => a.id.localeCompare(b.id));
    out.push(`### ${tag}（${list.length}）`, '');
    out.push(list.map(d => `[${d.title}](${d.id.replace(/ /g, '%20')})`).join(' · '), '');
  }

  const dups = edges.filter(e => e.kind === 'dup' && e.from < e.to);
  if (dups.length) {
    out.push('## 内容重叠，待合并', '');
    dups.forEach(e => out.push(`- ${docs.get(e.from).title}（\`${e.from}\`） ⇄ ${docs.get(e.to).title}（\`${e.to}\`）`));
    out.push('');
  }

  const orphans = ids.filter(id => deg(id) === 0);
  out.push('## 待连接（还没有任何关联）', '', `${orphans.length} 篇。每次挑几篇，在 frontmatter 里补 \`related\` / \`prereq\` / \`deep\`，再跑一次 build。`, '');
  for (const dir of [...new Set(orphans.map(id => docs.get(id).dir))].sort()) {
    const list = orphans.filter(id => docs.get(id).dir === dir);
    out.push(`- **${dir}**：${list.map(id => `[${docs.get(id).title}](${id.replace(/ /g, '%20')})`).join('、')}`);
  }
  return out.join('\n') + '\n';
}

// ---------- check：只读校验，CI 用 ----------
function check() {
  const docs = load();
  const { edges, dead } = buildGraph(docs);
  const problems = [];

  dead.forEach(d => problems.push(`死链  ${d.from} --${d.kind}--> ${d.to}`));
  for (const d of docs.values()) {
    if (!d.hasFm) problems.push(`缺 frontmatter  ${d.id}（跑 kg.mjs init）`);
    else if (!d.tags.length) problems.push(`缺 tags  ${d.id}`);
  }

  const deg = id => neighbors(edges, id).size;
  const orphans = [...docs.keys()].filter(id => deg(id) === 0);
  console.log(`check: ${docs.size} 篇 / ${pairCount(edges)} 条关联 / 孤立 ${orphans.length} 篇`);
  if (problems.length) {
    console.log(`\n${problems.length} 个问题：`);
    problems.forEach(p => console.log(`  ${p}`));
  } else {
    console.log('没有死链，frontmatter 齐全。');
  }
  return dead.length;   // 只有死链算硬错误；孤儿是待办，不阻塞
}

const cmd = process.argv[2] ?? 'check';
const run = { init, build, check }[cmd];
if (!run) {
  console.error(`未知命令：${cmd}\n用法：node scripts/kg.mjs <init|build|check>`);
  process.exit(2);
}
process.exit(run() ? 1 : 0);
