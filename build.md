# 构建与部署指南

本文档说明如何把 FolderMark 部署到 Cloudflare Workers，包括：

- 本地构建；
- GitHub 自动部署；
- Wrangler 手动部署；
- 自定义域名；
- 重复 ID 顺序账本；
- 更新、回滚和常见错误排查。

项目使用 **Cloudflare Workers Static Assets**，不是传统 Cloudflare Pages 项目。最终发布内容来自 `dist/`，路由回退由 `wrangler.jsonc` 管理。

相关文档：

- [README.md](./README.md)：项目功能和日常使用；
- [FrontMatter.md](./FrontMatter.md)：Markdown 与 Front Matter 编写规范。

## 1. 构建链路

每次执行生产构建时会发生以下过程：

```text
npm run build
└── prebuild
    └── npm run content
        └── node scripts/build-content.mjs
            ├── 扫描 markdown/
            ├── 解析 Front Matter
            ├── 解析并清洗 Markdown
            ├── 生成 public/_content/
            └── 复制资源到 public/_files/
└── vite build
    └── 生成 dist/
```

Wrangler 随后读取：

```jsonc
"assets": {
  "directory": "./dist",
  "not_found_handling": "single-page-application"
}
```

并把 `dist/` 上传为 Workers 静态资源。

用户请求 `/soft/example-id` 时：

1. Cloudflare 找不到同名实体 HTML 文件；
2. SPA 回退返回 `dist/index.html`；
3. 浏览器端路由读取 `/_content/...` 下相应 JSON；
4. 页面显示文章。

## 2. 环境要求

### 必需

- Git；
- Node.js 22.12 或更高版本；
- npm；
- 一个 GitHub 仓库；
- 一个 Cloudflare 账号。

### 可选

- 自己管理的 Cloudflare 域名；
- Cloudflare R2 或其他对象存储，用于图片；
- Wrangler 登录，用于本地手动部署。

检查本地版本：

```bash
node --version
npm --version
git --version
```

## 3. 准备新的 GitHub 仓库

本项目已启用 **Template repository**。可通过 **Use this template** 创建新仓库。

### 部署前的必要修改

打开 `wrangler.jsonc`：

```jsonc
{
  "name": "foldermark"
}
```

将 `name` 改成计划在 Cloudflare 中使用的 Worker 名称。例如：

```jsonc
{
  "name": "my-reference-site"
}
```

Worker 名称建议只使用小写字母、数字和短横线。

**Cloudflare 控制台中的 Worker 名称必须与 `wrangler.jsonc` 的 `name` 一致。** 如果名称不同，Git 自动构建会失败。

## 4. 本地安装

首次安装：

```bash
npm install
```

严格按照 `package-lock.json` 安装：

```bash
npm ci
```

建议：

- 开发电脑使用 `npm install`；
- CI 和 Cloudflare 构建环境使用 `npm ci`；
- 提交 `package-lock.json`；
- 不提交 `node_modules/`。

## 5. 本地开发

启动开发服务器：

```bash
npm run dev
```

这个命令会先执行内容扫描，再启动 Vite。

修改 Markdown 后，如果内容没有自动刷新，重新运行：

```bash
npm run content
```

或者停止并重新启动开发服务器。

## 6. 运行测试

```bash
npm test
```

测试使用 `tests/fixtures/` 中的独立文档，并把生成内容写到系统临时目录。因此：

- 不会读取你的正式 `markdown/`；
- 不会改动 `public/_content/`；
- 不会修改 `data/content-order.json`；
- 删除或替换通用演示文档后，测试仍然可以运行。

## 7. 本地生产构建

```bash
npm run build
```

成功时应看到类似输出：

```text
已解析 N 个 Markdown，生成 N 个文档路由。
vite ... building client environment for production...
✓ built
```

检查生成文件：

```bash
find dist -type f
```

Windows PowerShell：

```powershell
Get-ChildItem -Recurse dist
```

生产预览：

```bash
npm run preview
```

## 8. Wrangler 部署预检

不实际上传，只验证配置和资源：

```bash
npx wrangler deploy --dry-run
```

预期输出包含：

```text
Read ... files from the assets directory .../dist
--dry-run: exiting now.
```

如果 `dist/` 不存在，先运行：

```bash
npm run build
```

## 9. 推荐部署：GitHub → Cloudflare Workers Builds

Cloudflare Workers Builds 可以连接 GitHub 仓库。生产分支每次收到新提交后，Cloudflare 自动构建并部署。

### 9.1 创建或导入 Worker

1. 登录 Cloudflare Dashboard；
2. 打开 **Workers & Pages**；
3. 选择 **Create application**；
4. 在导入仓库区域选择 **Import a repository**；
5. 连接 GitHub；
6. 选择本项目仓库；
7. 设置生产分支，通常是 `main`；
8. 确认 Worker 名称与 `wrangler.jsonc` 中的 `name` 完全一致。

如果已经创建 Worker：

1. 打开该 Worker；
2. 进入 **Settings**；
3. 打开 **Builds**；
4. 选择连接 Git 仓库；
5. 选择对应 GitHub 仓库和生产分支。

Cloudflare 官方说明：

- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)

### 9.2 构建设置

使用以下配置：

| 设置 | 值 |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` 或留空 |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

如果控制台额外要求 Output directory，填写：

```text
dist
```

真正的静态资源目录仍以 `wrangler.jsonc` 中的 `assets.directory` 为准。

Cloudflare Workers Builds 的标准流程是：

1. 执行 Build command；
2. 执行 Deploy command。

配置说明见：

- [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

### 9.3 首次部署日志

正常日志通常包含：

```text
Installing project dependencies
Executing user build command: npm run build
已解析 ... 个 Markdown
Success: Build command completed
Executing user deploy command: npx wrangler deploy
Building list of assets
Read ... files from the assets directory .../dist
Uploaded ...
Deployed ...
Success: Deploy command completed
```

部署成功后，Cloudflare 会提供类似地址：

```text
https://YOUR_WORKER.YOUR_SUBDOMAIN.workers.dev
```

### 9.4 自动部署行为

以后只需要：

```bash
git add markdown
git commit -m "Add documents"
git push
```

Cloudflare 会在推送后自动：

1. 克隆仓库；
2. 安装依赖；
3. 扫描 Markdown；
4. 生成索引与文章 JSON；
5. 构建 Vite；
6. 上传 `dist/`；
7. 发布新版本。

索引不是用户访问时临时生成的。

## 10. GitHub Actions：稳定重复 ID 编号

项目包含：

```text
.github/workflows/update-content-order.yml
```

它只在 `main` 分支的 `markdown/**/*.md` 发生变化时运行。

工作流会：

1. 获取完整 Git 历史；
2. 查询每个 Markdown 文件第一次加入仓库的提交时间；
3. 更新 `data/content-order.json`；
4. 仅在账本变化时自动提交。

工作流使用最小范围的：

```yaml
permissions:
  contents: write
```

如果工作流在 `git push` 阶段报 403：

1. 打开 GitHub 仓库；
2. 进入 **Settings → Actions → General**；
3. 找到 **Workflow permissions**；
4. 允许 `GITHUB_TOKEN` 具有读写权限；
5. 保存后重新运行工作流。

GitHub 权限文档：

- [Use GITHUB_TOKEN for authentication](https://docs.github.com/actions/reference/authentication-in-a-workflow)
- [Managing GitHub Actions settings](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)

第一次加入新 Markdown 时，可能发生两次 Cloudflare 构建：

1. 你的内容提交触发一次；
2. Actions 更新顺序账本后再触发一次。

这是正常现象。账本提交本身不会再次触发同一个 Actions 工作流，因为它没有修改 `markdown/`。

## 11. 手动部署到 Cloudflare

不使用 Git 集成时，可以在本地部署。

### 11.1 登录

```bash
npx wrangler login
```

浏览器会打开 Cloudflare 授权页面。

检查当前身份：

```bash
npx wrangler whoami
```

### 11.2 部署

```bash
npm run deploy
```

该命令等价于：

```bash
npm run build
npx wrangler deploy
```

### 11.3 使用 API Token 的自动化环境

在无浏览器的 CI 环境中，可以配置 Cloudflare API Token。不要把 Token 写入：

- `wrangler.jsonc`；
- `.env` 后提交到 Git；
- README；
- GitHub Issue；
- 构建日志。

优先使用部署平台提供的加密环境变量或 Secret。

## 12. 自定义域名

前提：

- 域名已添加到同一 Cloudflare 账号；
- Worker 已成功部署；
- 目标主机名没有冲突的现有 CNAME。

在 Dashboard 中：

1. 打开 **Workers & Pages**；
2. 选择目标 Worker；
3. 进入 **Settings → Domains & Routes**；
4. 选择 **Add → Custom Domain**；
5. 输入域名，例如 `post.example.com`；
6. 确认添加。

Cloudflare 会自动创建所需 DNS 记录并签发证书。

官方文档：

- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

添加完成后验证：

```text
https://post.example.com/
https://post.example.com/index
https://post.example.com/getting-started
```

## 13. 为什么使用 SPA 回退

文章 URL 是：

```text
/soft/document-id
```

但 `dist/` 中没有对应的：

```text
dist/soft/document-id/index.html
```

因此必须在导航请求没有匹配静态文件时返回 `index.html`。项目通过：

```jsonc
"not_found_handling": "single-page-application"
```

完成这一点。

Cloudflare 官方说明：

- [Single Page Application routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)

### 不要添加 `_redirects`

不要再创建以下规则：

```text
/* /index.html 200
```

在 Workers Static Assets 的 SPA 模式中，它是重复配置，可能触发：

```text
Invalid _redirects configuration
Infinite loop detected
```

本项目只使用 `wrangler.jsonc` 作为路由回退配置来源。

## 14. 图片部署

### 外部图片

绝对 HTTPS 图片 URL 不进入 `dist/`：

```markdown
![图](https://img.example.com/path/image.webp)
```

浏览器直接向图片域名请求资源。

### 仓库内图片

非 Markdown 文件会被复制：

```text
markdown/soft/images/a.webp
        ↓
public/_files/soft/images/a.webp
        ↓
dist/_files/soft/images/a.webp
```

相对 Markdown 链接会在构建时改写。

### R2 建议

- 使用内容哈希或稳定 ID 作为对象名；
- 配置自定义图片域名；
- 上传后让 Markdown 客户端自动替换为绝对 URL；
- 对不可变图片设置长期缓存；
- 不要覆盖同名对象后期望所有边缘缓存立即更新，优先换对象名。

## 15. 更新依赖

查看过期依赖：

```bash
npm outdated
```

审计：

```bash
npm audit
```

更新后必须运行：

```bash
npm test
npm run build
npx wrangler deploy --dry-run
```

不要删除 `package-lock.json` 后直接提交未经验证的大范围版本更新。

## 16. 回滚

### Git 回滚

找到最近一个可用提交：

```bash
git log --oneline
```

创建一个反向提交：

```bash
git revert COMMIT_SHA
git push
```

Cloudflare 会自动重新构建该状态。

### Wrangler 回滚

查看版本：

```bash
npx wrangler versions list
```

回滚：

```bash
npx wrangler rollback
```

如果项目主要由 Git 自动部署，建议同时修正 Git 仓库，避免下次提交再次部署有问题的代码。

## 17. 部署验证清单

部署完成后逐项检查：

- [ ] `/` 能显示目录 `README.md`，或按预期为空白；
- [ ] `/index` 能显示根目录可见文档；
- [ ] 子目录 `/soft/` 行为正确；
- [ ] 子目录 `/soft/index` 只列当前目录；
- [ ] 普通 ID 路由能打开；
- [ ] `cleanup: 0` 文档不在索引，但 ID URL 可访问；
- [ ] `saved` 文档显示完整 `[EB/OL]` 引用；
- [ ] `time` 文档只显示日期；
- [ ] 外部来源链接可打开；
- [ ] 图片在桌面和手机宽度下不溢出；
- [ ] 重复 ID 的 `/1`、`/2` 路由稳定；
- [ ] 浏览器控制台没有 JavaScript 错误；
- [ ] Cloudflare 最新部署对应 GitHub 最新提交。

## 18. 常见错误

### `Cannot modify Vite config: could not find a valid plugins array`

原因：Cloudflare 自动配置工具试图把项目改造成 Cloudflare Vite 插件项目。

本项目不需要 Cloudflare Vite 插件。确认仓库根目录存在：

```text
wrangler.jsonc
```

并使用：

```text
Build command: npm run build
Deploy command: npx wrangler deploy
```

不要删除显式 Wrangler 配置。

### `Invalid _redirects configuration: Infinite loop detected`

删除：

```text
public/_redirects
```

只保留：

```jsonc
"not_found_handling": "single-page-application"
```

### Worker name mismatch

确认三处一致：

1. Cloudflare Worker 名称；
2. `wrangler.jsonc` 的 `name`；
3. Cloudflare Git 构建所连接的目标 Worker。

### 构建成功但正文空白

检查：

1. 浏览器开发者工具 Console 是否有错误；
2. `/_content/articles/...json` 是否返回 JSON；
3. 浏览器是否仍缓存旧 JavaScript；
4. 执行 `Ctrl + F5` 强制刷新；
5. Cloudflare 部署是否对应最新提交。

### 页面显示“未找到文档”

检查：

- ID 是否存在；
- URL 是否包含正确目录；
- ID 是否拼写一致；
- Front Matter 是否成功解析；
- ID 是否使用了不允许的字符；
- 是否把普通文档命名成了 `README.md`。

### 文档不在索引中

文档必须同时满足：

```yaml
id: valid-id
cleanup: 1
```

索引只显示当前目录，不递归子目录。

### 构建日志提示 ID 重复

这是警告，不会中止构建。访问：

```text
/ID/1
/ID/2
```

并检查 `data/content-order.json` 是否已由 GitHub Actions 更新。

### GitHub Actions 无法 push

检查：

- 工作流是否具有 `permissions: contents: write`；
- 仓库或组织是否限制 `GITHUB_TOKEN` 写权限；
- `main` 是否有禁止机器人直接推送的分支保护规则。

如不希望 Actions 自动提交，可以删除该工作流并手动维护 `data/content-order.json`，但重复 ID 的编号可能在不同构建环境中变化。

### Cloudflare 部署读取 0 个资源

检查：

```bash
npm run build
find dist -type f
```

并确认：

```jsonc
"assets": {
  "directory": "./dist"
}
```

### 自定义域名无法添加

检查目标主机名是否已经存在冲突的 CNAME，域名是否位于当前 Cloudflare 账号，以及 Worker 是否已成功部署。

## 19. 生产建议

- 把 `main` 设为生产分支；
- 使用 Pull Request 修改程序代码；
- Markdown 内容可根据工作流直接推送；
- 为开源项目启用依赖更新和安全告警；
- 保留 `package-lock.json`；
- 定期执行测试和构建；
- 将大量图片放入 R2；
- 对私密站点使用 Cloudflare Access；
- 不把 `cleanup` 当作权限；
- 备份 `markdown/` 和 `data/content-order.json`。

## 20. 相关官方文档

- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Cloudflare GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/)
- [GitHub Actions GITHUB_TOKEN](https://docs.github.com/actions/reference/authentication-in-a-workflow)
