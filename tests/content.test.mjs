import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..");
const fixtureRoot = path.join(testDirectory, "fixtures");
const temporaryRoot = await mkdtemp(
  path.join(tmpdir(), "markdown-postman-"),
);
const publicRoot = path.join(temporaryRoot, "public");
const contentRoot = path.join(publicRoot, "_content");

execFileSync(
  process.execPath,
  [path.join(projectRoot, "scripts", "build-content.mjs")],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      REFERENCE_MARKDOWN_ROOT: path.join(fixtureRoot, "markdown"),
      REFERENCE_PUBLIC_ROOT: publicRoot,
      REFERENCE_ORDER_LEDGER_PATH: path.join(
        fixtureRoot,
        "content-order.json",
      ),
    },
    stdio: "pipe",
  },
);

after(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.join(contentRoot, relativePath), "utf8"),
  );
}

test("cleanup: 1 文档进入当前目录索引", async () => {
  const index = await readJson("directories/index.json");
  assert.equal(index.items.length, 1);
  assert.deepEqual(index.items[0], {
    title: "second",
    href: "/duplicate-demo/2",
    citation: "[2026-06-24]",
    date: "2026-06-24",
  });
});

test("重复 ID 生成稳定编号和基础跳转", async () => {
  const redirect = await readJson("articles/duplicate-demo.json");
  const first = await readJson(
    "articles/duplicate-demo/1/index.json",
  );
  const second = await readJson(
    "articles/duplicate-demo/2/index.json",
  );

  assert.deepEqual(redirect, {
    type: "redirect",
    to: "/duplicate-demo/1",
  });
  assert.equal(first.titleSource, "frontmatter");
  assert.equal(second.titleSource, "filename");
});

test("saved 日期生成 GB/T 7714-2015 网络文献引用数据", async () => {
  const document = await readJson(
    "articles/duplicate-demo/1/index.json",
  );
  assert.equal(document.date, "2026-06-23");
  assert.equal(document.dateKind, "saved");
  assert.deepEqual(document.reference, {
    title: "示例网络文档",
    medium: "EB/OL",
    date: "2026-06-23",
    source: "https://example.com/article",
  });
});

test("time 日期标准化且不生成网络文献引用", async () => {
  const document = await readJson(
    "articles/duplicate-demo/2/index.json",
  );
  assert.equal(document.date, "2026-06-24");
  assert.equal(document.dateKind, "time");
  assert.equal(document.reference, null);
});

test("缺少 title 时使用第一个一级标题并从正文移除", async () => {
  const document = await readJson("articles/heading-fallback.json");
  assert.equal(document.title, "来自正文的标题");
  assert.equal(document.titleSource, "heading");
  assert.doesNotMatch(document.html, /<h1>/);
});

test("缺少 README 时目录默认页保持空白", async () => {
  const metadata = await readJson("directories/meta.json");
  assert.equal(metadata.hasReadme, false);
});

test("正文渲染函数不会遮蔽浏览器 document 对象", async () => {
  const source = await readFile(
    path.join(projectRoot, "src", "main.js"),
    "utf8",
  );

  assert.doesNotMatch(source, /function renderDocument\s*\(\s*document\s*\)/);
  assert.match(source, /function renderDocument\s*\(\s*article\s*\)/);
});

test("文档标题按 30 个 Unicode 字符强制换行", async () => {
  const source = await readFile(
    path.join(projectRoot, "src", "main.js"),
    "utf8",
  );

  assert.match(source, /function appendWrappedText\([^)]*lineLength = 30\)/);
  assert.match(source, /appendWrappedText\(title, article\.title\)/);
});
