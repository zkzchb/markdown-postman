# Markdown 与 Front Matter 编写指南

本文档专门说明如何为 FolderMark 编写内容，包括：

- Markdown 文件应放在哪里；
- Front Matter 的基本语法；
- `id`、`title`、`cleanup`、`saved`、`time`、`source` 的含义；
- 网络文档、手写文档和隐藏文档模板；
- 文件夹 `README.md`；
- 标题、图片、链接和附件；
- ID 生成策略；
- LLM 或本地 Agent 自动清洗建议；
- 常见错误和发布前检查。

部署方式请查看 [build.md](./build.md)，项目功能请查看 [README.md](./README.md)。

## 1. 一个完整示例

```markdown
---
id: 7f3a9c21
title: 一篇完整的示例文档
cleanup: 1
saved: "2026-06-23T11:24:52+08:00"
source: https://example.com/original-article
---

# 正文一级标题

这里是正文。

## 第二部分

这里是第二部分内容。

![示意图](https://img.example.com/7f3a9c21/figure-1.webp)
```

这个文件会：

- 使用 `/7f3a9c21` 作为访问地址；
- 出现在当前目录的 `/index`；
- 使用 Front Matter 中的标题作为页面主标题；
- 显示网络文献引用；
- 渲染正文 Markdown；
- 从外部图片地址加载图片。

## 2. 什么是 Front Matter

Front Matter 是 Markdown 文件开头的一段 YAML 元数据。

基本形式：

```yaml
---
字段名: 字段值
字段名: 字段值
---
```

结束分隔线后开始 Markdown 正文：

```markdown
---
id: example
title: 示例
cleanup: 1
---

这里是正文。
```

### 必须遵守

1. Front Matter 应从文件第一行开始；
2. 开始和结束分隔线都必须是三个半角短横线 `---`；
3. 字段名使用英文半角冒号；
4. 冒号后保留一个空格；
5. 不要使用全角冒号 `：`；
6. 结束分隔线之后建议保留一个空行；
7. 文件建议保存为 UTF-8；
8. 不要在分隔线之前放标题、空行或其他字符。

正确：

```yaml
---
id: example
---
```

错误：

```yaml

---
id：example
---
```

## 3. 支持的字段

| 字段 | 普通文档是否必需 | 类型 | 作用 |
| --- | --- | --- | --- |
| `id` | 是 | 字符串 | 生成稳定文档 URL。 |
| `title` | 否 | 字符串 | 设置页面主标题。 |
| `cleanup` | 否 | 数字或字符串 | 值为 `1` 时进入当前目录索引。 |
| `saved` | 否 | 日期或日期时间 | 网络内容保存时间，生成 `[EB/OL]` 引用。 |
| `time` | 否 | 日期 | 手写文档日期。 |
| `source` | 否 | HTTP/HTTPS URL | 原始来源地址。 |

程序只读取以上字段。你可以添加自己的其他字段，但当前页面不会显示它们。

例如：

```yaml
---
id: example
title: 示例
cleanup: 1
tags:
  - cloudflare
  - markdown
author: Someone
---
```

`tags` 和 `author` 会保留在原始 Markdown 中，但当前构建程序不会使用。

## 4. `id`：文档访问地址

### 基本写法

```yaml
id: 7f3a9c21
```

根目录文档对应：

```text
/7f3a9c21
```

如果文件位于：

```text
markdown/soft/example.md
```

则对应：

```text
/soft/7f3a9c21
```

### 允许的字符

`id` 可以包含：

- Unicode 字母；
- 数字；
- 点号 `.`；
- 下划线 `_`；
- 短横线 `-`；
- 波浪线 `~`。

`id` 必须以字母或数字开头。

推荐：

```yaml
id: 7f3a9c21
id: cloudflare-r2
id: note_2026_001
id: document.v2
```

不推荐或无效：

```yaml
id: index
id: /article
id: article name
id: article/question
id: "#note"
```

### `index` 是保留名称

不要使用：

```yaml
id: index
```

`index` 用于目录索引：

```text
/index
/soft/index
```

文件夹也不要命名为 `index`。

### 没有 `id` 会怎样

普通文档没有 `id` 时：

- 不生成文章路由；
- 不进入索引；
- 即使 `cleanup: 1` 也不会显示；
- 构建不会因此失败。

目录 `README.md` 不需要 `id`，因为它使用目录 URL。

### ID 应保持稳定

一旦发布，尽量不要修改 `id`。修改后，旧 URL 不会自动跳转到新 URL。

标题、文件名和正文可以修改，`id` 最好保持不变。

### 使用哈希作为 ID

可以使用正文内容哈希的前 8～12 位：

```yaml
id: 7f3a9c21
```

注意：不要对“包含最终 Front Matter 的整个文件”反复计算哈希后再把哈希写回同一文件。因为写入 ID 会改变文件内容，从而改变哈希。

推荐以下任一策略：

1. 对插入 Front Matter 之前的原始正文计算哈希；
2. 计算时排除 Front Matter，只对 Markdown 正文做哈希；
3. 对规范化后的来源 URL 做哈希；
4. 使用一次性生成并永久保存的 UUID、ULID 或随机短 ID；
5. 使用本地 Agent 的稳定文档数据库记录 ID。

一个简单策略是：

```text
ID = SHA-256(规范化正文) 的前 8 位
```

“规范化正文”可包括：

- 去掉 Front Matter；
- 统一换行符；
- 去掉首尾空白；
- 保留正文实际内容。

## 5. `title`：页面标题

### 基本写法

```yaml
title: 一篇示例文档
```

标题中包含冒号、井号、方括号或其他 YAML 特殊字符时，建议加引号：

```yaml
title: "Cloudflare R2：从入门到实践"
```

### 标题回退规则

如果没有 `title`，程序依次使用：

1. 正文第一个一级标题；
2. 文件名。

示例：

```markdown
---
id: example
cleanup: 1
---

# 来自正文的标题

正文。
```

页面标题会是：

```text
来自正文的标题
```

用于回退的第一个一级标题会从正文中移除，避免显示两次。

如果既没有 `title`，也没有一级标题：

```text
markdown/my-document.md
```

页面标题为：

```text
my-document
```

### Front Matter 标题和正文一级标题同时存在

```markdown
---
id: example
title: 页面标题
cleanup: 1
---

# 正文一级标题
```

此时：

- 页面主标题使用 `页面标题`；
- 正文一级标题继续保留；
- 两者可以不同。

### 标题显示样式

- 页面主标题居中；
- 每 30 个 Unicode 字符强制换行；
- 字号为 22px；
- Markdown 正文中的一级、二级、五级标题居中；
- 三级、四级、六级标题左对齐。

## 6. `cleanup`：是否进入索引

### 显示在索引

```yaml
cleanup: 1
```

字符串形式也有效：

```yaml
cleanup: "1"
```

### 不显示在索引

```yaml
cleanup: 0
```

或者完全省略：

```yaml
---
id: temporary-note
---
```

以下值不会被识别为显示：

```yaml
cleanup: true
cleanup: yes
cleanup: done
cleanup: 2
```

建议只使用明确的：

```yaml
cleanup: 0
cleanup: 1
```

### 隐藏文档仍可访问

```yaml
---
id: temporary-note
cleanup: 0
---
```

它不会进入 `/index`，但仍可访问：

```text
/temporary-note
```

这是一种“隐藏列表项”，不是权限控制。

不要用它保护：

- 密码；
- Token；
- Cookie；
- 私人身份信息；
- 未公开商业资料；
- 受保密协议约束的内容。

## 7. `saved`：网络保存时间

`saved` 用于从网页、数据库或其他在线来源保存的内容。

推荐保留完整保存时间和时区：

```yaml
saved: "2026-06-23T11:24:52+08:00"
```

也可以只写日期：

```yaml
saved: 2026-06-23
```

页面只显示日期：

```text
2026-06-23
```

不会显示时、分、秒。

### 网络文献引用

如果文档包含：

```yaml
title: 一篇网络文档
saved: "2026-06-23T11:24:52+08:00"
source: https://example.com/article
```

页面会生成：

> 《一篇网络文档》 [EB/OL]. [2026-06-23]. https://example.com/article.

引用位于：

1. 页面主标题之后；
2. 标题下方横线以下；
3. Markdown 正文之前。

### 为什么建议给日期时间加引号

YAML 解析器可能把未加引号的日期自动转换成日期对象。项目可以处理常见日期对象，但完整 ISO 时间加引号更直观，也更方便其他工具原样读取：

```yaml
saved: "2026-06-23T11:24:52+08:00"
```

## 8. `time`：手写文档日期

`time` 用于自己编写的笔记、文章或备忘：

```yaml
time: 2026-06-23
```

以下形式也支持：

```yaml
time: 2026-6-23
```

页面统一显示：

```text
[2026-06-23]
```

`time` 不会生成 `[EB/OL]` 网络文献引用。

### 同时存在 `saved` 和 `time`

```yaml
saved: "2026-06-23T11:24:52+08:00"
time: 2026-06-20
```

程序优先使用 `saved`，忽略 `time`。

一个文档通常只需要其中一个：

- 网络收集内容：`saved`；
- 自己编写内容：`time`。

## 9. `source`：原始来源

```yaml
source: https://example.com/original
```

只接受：

- `http://`
- `https://`

以下地址会被忽略：

```yaml
source: javascript:alert(1)
source: file:///local/file
source: ftp://example.com/file
```

URL 包含 `:`、`#`、`&` 或查询参数时，建议加引号：

```yaml
source: "https://example.com/article?id=123&from=archive"
```

对于 `saved` 文档，`source` 会作为完整 URL 显示在引用块中，并可点击打开。

如果存在 `saved` 但没有 `source`，仍会生成标题、文献类型和日期，但没有来源 URL。为了形成完整网络引文，推荐同时提供 `source`。

## 10. 常用文档模板

### 网络保存文档

```markdown
---
id: 7f3a9c21
title: 网络文章标题
cleanup: 1
saved: "2026-06-23T11:24:52+08:00"
source: "https://example.com/article"
---

这里是正文。
```

### 手写笔记

```markdown
---
id: personal-note-001
title: 我的笔记
cleanup: 1
time: 2026-6-23
---

这里是正文。
```

### 尚未清洗的临时文档

```markdown
---
id: temporary-001
cleanup: 0
saved: "2026-06-23T11:24:52+08:00"
source: "https://example.com/raw"
---

# 临时标题

这里是尚未清洗完成的正文。
```

它可以通过 ID 访问，但不会进入索引。

### 使用一级标题作为页面标题

```markdown
---
id: heading-title-example
cleanup: 1
time: 2026-07-26
---

# 由正文提供的标题

正文。
```

### 使用文件名作为标题

文件：

```text
markdown/没有标题的笔记.md
```

内容：

```markdown
---
id: filename-title-example
cleanup: 1
time: 2026-07-26
---

正文中没有一级标题。
```

页面标题为：

```text
没有标题的笔记
```

### 最小可访问文档

```markdown
---
id: minimal
---

正文。
```

它可以通过 `/minimal` 访问，但不在索引中。

### 最小索引文档

```markdown
---
id: visible
cleanup: 1
---

# 可见文档

正文。
```

## 11. 目录 `README.md`

每个目录中的 `README.md` 是该目录默认页。

```text
markdown/README.md       → /
markdown/soft/README.md  → /soft/
```

目录首页不需要 Front Matter：

```markdown
# 软件资料

这里收集与软件有关的参考文档。

访问 `/soft/index` 查看当前目录文档。
```

也可以添加普通 Front Matter 元数据，但：

- `README.md` 不需要 `id`；
- `README.md` 不进入索引；
- `cleanup` 对 `README.md` 没有实际作用；
- `README.md` 使用目录 URL，不生成独立 ID URL。

删除目录中的 `README.md` 后，目录默认页变为空白。

## 12. 文件夹和索引

示例结构：

```text
markdown/
├── root-note.md
├── soft/
│   ├── tool-a.md
│   └── tool-b.md
└── research/
    └── paper.md
```

索引：

```text
/index
/soft/index
/research/index
```

每个索引只列出当前目录中同时满足以下条件的普通文档：

1. 有有效 `id`；
2. `cleanup: 1`；
3. 不是 `README.md`。

根目录 `/index` 不会显示 `soft/` 和 `research/` 里的文档。

## 13. 重复 ID

同一目录中两个文件可以临时使用相同 ID：

```yaml
id: duplicate
```

生成：

```text
/duplicate/1
/duplicate/2
```

子目录示例：

```text
/soft/duplicate/1
/soft/duplicate/2
```

访问基础地址：

```text
/soft/duplicate
```

会跳转到：

```text
/soft/duplicate/1
```

### 编号顺序

1. 按文件第一次提交到 GitHub 的时间排序；
2. 较早提交的文件编号更小；
3. 同一个提交中加入的重复文件按相对路径排序。

首次提交时间保存在：

```text
data/content-order.json
```

不要随意删除这个文件。

### 不同目录可以使用相同 ID

以下两个文档不会冲突：

```text
markdown/soft/a.md      → id: guide
markdown/research/b.md  → id: guide
```

URL 分别是：

```text
/soft/guide
/research/guide
```

## 14. Markdown 正文规范

### 标题

推荐结构：

```markdown
# 一级标题

## 二级标题

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题
```

显示规则：

- 页面主标题：22px、居中；
- 正文一级标题：22px、居中；
- 正文二级标题：20px、居中；
- 正文五级标题：18px、居中；
- 正文三级、四级、六级标题：18px、左对齐；
- 正文：18px。

建议不要为了字体大小而滥用标题级别，应按照文档结构使用。

### 段落

段落之间保留空行：

```markdown
这是第一段。

这是第二段。
```

普通段落会使用中文阅读样式和首行缩进。

### 引用

```markdown
> 这是一段引用。
```

显示为带左侧强调线的引用块。

### 链接

```markdown
[链接文字](https://example.com)
```

外部 HTTP/HTTPS 链接会在新窗口打开。

### 列表

```markdown
- 第一项
- 第二项

1. 第一项
2. 第二项
```

任务列表：

```markdown
- [x] 已完成
- [ ] 未完成
```

### 代码

行内代码：

```markdown
使用 `npm run build` 构建。
```

代码块：

````markdown
```js
console.log("hello");
```
````

### 表格

```markdown
| 字段 | 说明 |
| --- | --- |
| id | 文档 ID |
| cleanup | 是否进入索引 |
```

宽表格可以横向滚动。

### 分隔线

```markdown
---
```

注意：只有文件开头的成对 `---` 才作为 Front Matter。正文中的单独分隔线按 Markdown 水平线处理。

## 15. 图片

### 推荐：R2 或其他对象存储

```markdown
![图片说明](https://img.example.com/articles/7f3a9c21/figure-1.webp)
```

建议：

- 使用 HTTPS；
- 为图片域名配置有效证书；
- 使用内容哈希或稳定 ID 作为对象名；
- 避免对象名包含空格；
- 图片改变时使用新对象名，便于缓存更新；
- 为不可变图片设置长期缓存。

图片会自动限制最大宽度，不会超出正文。

### 仓库内图片

目录：

```text
markdown/
├── article.md
└── images/
    └── figure.webp
```

Markdown：

```markdown
![示意图](./images/figure.webp)
```

构建时：

```text
markdown/images/figure.webp
        ↓
public/_files/images/figure.webp
        ↓
dist/_files/images/figure.webp
```

### 子目录相对路径

```text
markdown/soft/article.md
markdown/soft/images/figure.webp
```

在文章中：

```markdown
![示意图](./images/figure.webp)
```

构建脚本会保留相对目录关系。

### 图片替代文字

建议始终填写：

```markdown
![污水处理工艺流程图](https://img.example.com/process.webp)
```

不要只写：

```markdown
![](https://img.example.com/process.webp)
```

替代文字有利于无障碍访问、图片加载失败时理解内容以及后续检索。

## 16. 附件

外部附件：

```markdown
[下载 PDF](https://files.example.com/document.pdf)
```

仓库内附件：

```text
markdown/files/document.pdf
```

```markdown
[下载 PDF](./files/document.pdf)
```

非 `.md` 文件会作为静态资源复制。

大量 PDF、视频、音频和高分辨率图片不适合长期存放在 Git 仓库中，推荐使用 R2。

## 17. 原始 HTML

项目允许有限的安全 HTML，例如：

```html
<details>
  <summary>展开内容</summary>
  <p>详细说明。</p>
</details>
```

以下内容会被清理或忽略：

- `<script>`；
- `onclick` 等事件属性；
- `iframe`；
- 不在白名单中的标签；
- `javascript:` URL；
- 任意自定义前端脚本。

不要依赖 Markdown 中的 JavaScript 实现功能。

## 18. YAML 常见问题

### 标题中包含冒号

错误风险：

```yaml
title: Cloudflare R2: 完整指南
```

推荐：

```yaml
title: "Cloudflare R2: 完整指南"
```

### URL 中包含特殊字符

推荐：

```yaml
source: "https://example.com/article?id=1&lang=zh"
```

### 缩进使用 Tab

YAML 不建议使用 Tab 缩进。使用空格：

```yaml
tags:
  - markdown
  - cloudflare
```

### 使用中文标点

错误：

```yaml
title：示例
```

正确：

```yaml
title: 示例
```

### 分隔线数量错误

错误：

```yaml
----
id: example
----
```

正确：

```yaml
---
id: example
---
```

### `cleanup` 写成布尔值

不要写：

```yaml
cleanup: true
```

应写：

```yaml
cleanup: 1
```

### Front Matter 不在文件开头

错误：

```markdown
# 标题

---
id: example
---
```

这会被当作普通 Markdown，而不是 Front Matter。

## 19. 日期常见问题

支持：

```yaml
time: 2026-6-3
time: 2026-06-03
saved: "2026-06-03T08:30:00+08:00"
```

不支持或会产生警告：

```yaml
time: 2026/06/03
time: June 3, 2026
time: 03-06-2026
time: 2026-13-40
```

输出总是：

```text
YYYY-MM-DD
```

## 20. LLM 或本地 Agent 自动清洗

可以让 LLM、WorkBuddy 或其他本地 Agent 定期执行：

1. 读取原始 Markdown；
2. 移除网页导航、广告和无关内容；
3. 保留正文标题层级；
4. 生成或补充 Front Matter；
5. 根据正文或来源生成稳定 ID；
6. 规范化 `saved`、`time` 和 `source`；
7. 上传图片到 R2；
8. 替换图片为 HTTPS 地址；
9. 清洗完成后设置 `cleanup: 1`。

### 推荐输出模板

网络文档：

```yaml
---
id: "<稳定ID>"
title: "<清洗后的标题>"
cleanup: 1
saved: "<原始保存时间，ISO 8601>"
source: "<原始URL>"
---
```

手写文档：

```yaml
---
id: "<稳定ID>"
title: "<文档标题>"
cleanup: 1
time: "<YYYY-MM-DD>"
---
```

### 尚未清洗时

Agent 可以先写：

```yaml
---
id: "<临时或稳定ID>"
cleanup: 0
saved: "<保存时间>"
source: "<原始URL>"
---
```

这样可以手工访问检查，但不会污染索引。

### 给 Agent 的规则示例

```text
请清洗这个 Markdown 文档，并在文件第一行添加 YAML Front Matter：

1. id 使用去除 Front Matter 后规范化正文 SHA-256 的前 8 位；
2. title 使用文章正式标题；
3. 网络来源使用 saved 和 source；
4. 自己撰写的文档使用 time；
5. 日期统一为 ISO 8601 或 YYYY-MM-DD；
6. 未完成清洗时 cleanup 为 0，完成后为 1；
7. 图片上传到指定 R2 域名并替换为绝对 HTTPS URL；
8. 不改变正文事实内容；
9. 输出完整 Markdown，不要使用解释性前言。
```

## 21. 编码和文件名

### 文件编码

推荐：

```text
UTF-8
```

不推荐：

- GBK；
- Big5；
- 混合编码；
- 无法识别的二进制内容保存为 `.md`。

### 文件名

文件名可以包含中文和空格，因为文档 URL 使用 `id`。

仍建议：

- 文件名能够帮助本地识别；
- 避免操作系统不允许的字符；
- 不把 ID 只保存在文件名中；
- 修改文件名时使用 Git 移动，以保留历史。

## 22. 发布前检查

每篇普通文档发布前检查：

- [ ] 文件位于正确的 `markdown/` 目录；
- [ ] 文件使用 UTF-8；
- [ ] Front Matter 位于第一行；
- [ ] 开始和结束分隔线均为 `---`；
- [ ] `id` 有效且稳定；
- [ ] `id` 不是 `index`；
- [ ] `title` 正确，或正文有一级标题；
- [ ] 需要进入索引时使用 `cleanup: 1`；
- [ ] 网络文档使用 `saved` 和 `source`；
- [ ] 手写文档使用 `time`；
- [ ] 日期能够解析；
- [ ] 图片地址可访问；
- [ ] 没有密码、Token、Cookie 或隐私信息；
- [ ] Markdown 标题层级合理；
- [ ] 原始来源 URL 没有被截断。

提交后检查：

- [ ] GitHub 构建或 Cloudflare 构建成功；
- [ ] 当前目录 `/index` 显示符合预期；
- [ ] ID URL 可以打开；
- [ ] `cleanup: 0` 文档没有出现在索引；
- [ ] 引用、图片、表格和链接显示正常。

## 23. 快速参考

### 网络文档

```yaml
---
id: 7f3a9c21
title: 网络文章标题
cleanup: 1
saved: "2026-06-23T11:24:52+08:00"
source: "https://example.com/article"
---
```

### 手写文档

```yaml
---
id: note-001
title: 我的笔记
cleanup: 1
time: 2026-06-23
---
```

### 隐藏文档

```yaml
---
id: temporary-001
cleanup: 0
---
```

### 目录首页

```text
markdown/README.md
markdown/soft/README.md
```

### 当前目录索引

```text
/index
/soft/index
```

### 重复 ID

```text
/same-id/1
/same-id/2
```
