import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const markdownRoot = process.env.REFERENCE_MARKDOWN_ROOT
  ? path.resolve(process.env.REFERENCE_MARKDOWN_ROOT)
  : path.join(projectRoot, "markdown");
const publicRoot = process.env.REFERENCE_PUBLIC_ROOT
  ? path.resolve(process.env.REFERENCE_PUBLIC_ROOT)
  : path.join(projectRoot, "public");
const contentRoot = path.join(publicRoot, "_content");
const fileRoot = path.join(publicRoot, "_files");
const orderLedgerPath = process.env.REFERENCE_ORDER_LEDGER_PATH
  ? path.resolve(process.env.REFERENCE_ORDER_LEDGER_PATH)
  : path.join(projectRoot, "data", "content-order.json");
const collator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});
const warnings = [];
let orderLedger = {};

marked.setOptions({
  gfm: true,
  breaks: false,
});

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function encodeUrlPath(relativePath) {
  return relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function validRouteSegment(value) {
  return (
    typeof value === "string" &&
    /^[\p{L}\p{N}][\p{L}\p{N}._~-]*$/u.test(value) &&
    value.toLowerCase() !== "index"
  );
}

function normalizeId(value, relativePath) {
  if (value === undefined || value === null) {
    return null;
  }

  const id = String(value).trim();
  if (!validRouteSegment(id)) {
    warnings.push(
      `${relativePath}: id "${id}" 不是安全的 URL 片段，文档不会生成访问路由。`,
    );
    return null;
  }
  return id;
}

function normalizeDateParts(year, month, day) {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const check = new Date(
    Date.UTC(numericYear, numericMonth - 1, numericDay),
  );

  if (
    check.getUTCFullYear() !== numericYear ||
    check.getUTCMonth() + 1 !== numericMonth ||
    check.getUTCDate() !== numericDay
  ) {
    return null;
  }

  return [
    String(numericYear).padStart(4, "0"),
    String(numericMonth).padStart(2, "0"),
    String(numericDay).padStart(2, "0"),
  ].join("-");
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return [
      value.getUTCFullYear(),
      String(value.getUTCMonth() + 1).padStart(2, "0"),
      String(value.getUTCDate()).padStart(2, "0"),
    ].join("-");
  }

  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  return match ? normalizeDateParts(match[1], match[2], match[3]) : null;
}

function resolveDate(data, relativePath) {
  if (data.saved !== undefined && data.saved !== null) {
    const date = normalizeDate(data.saved);
    if (!date) {
      warnings.push(`${relativePath}: saved 字段无法解析，日期将不显示。`);
      return { date: null, citation: null, kind: "saved" };
    }
    return {
      date,
      citation: `[EB/OL]. [${date}]`,
      kind: "saved",
    };
  }

  if (data.time !== undefined && data.time !== null) {
    const date = normalizeDate(data.time);
    if (!date) {
      warnings.push(`${relativePath}: time 字段无法解析，日期将不显示。`);
      return { date: null, citation: null, kind: "time" };
    }
    return {
      date,
      citation: `[${date}]`,
      kind: "time",
    };
  }

  return { date: null, citation: null, kind: null };
}

function normalizeSource(value, relativePath) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  try {
    const url = new URL(String(value).trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("unsupported protocol");
    }
    return url.toString();
  } catch {
    warnings.push(`${relativePath}: source 不是有效的 HTTP(S) URL，已忽略。`);
    return null;
  }
}

function plainHeading(token) {
  return String(token?.text ?? "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .trim();
}

function rewriteRelativeTarget(value, sourceDirectory) {
  if (
    !value ||
    /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\/)/i.test(value)
  ) {
    return value;
  }

  const suffixIndex = value.search(/[?#]/);
  const pathname = suffixIndex === -1 ? value : value.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : value.slice(suffixIndex);
  const decodedPath = pathname
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
  const normalized = path.posix.normalize(
    path.posix.join(sourceDirectory, decodedPath),
  );

  if (normalized === ".." || normalized.startsWith("../")) {
    return value;
  }

  return `/_files/${encodeUrlPath(normalized)}${suffix}`;
}

function renderMarkdown(tokens, sourceDirectory) {
  const rendered = marked.parser(tokens);

  return sanitizeHtml(rendered, {
    allowedTags: [
      "a",
      "blockquote",
      "br",
      "code",
      "del",
      "details",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "img",
      "input",
      "li",
      "ol",
      "p",
      "pre",
      "span",
      "strong",
      "sub",
      "summary",
      "sup",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "ul",
    ],
    allowedAttributes: {
      a: ["href", "name", "rel", "target", "title"],
      code: ["class"],
      div: ["class"],
      img: ["alt", "loading", "src", "title"],
      input: ["checked", "disabled", "type"],
      ol: ["start"],
      span: ["class"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedClasses: {
      code: [/^language-[\w-]+$/],
      div: ["table-wrapper"],
      span: ["task-list-item-checkbox"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => {
        const href = rewriteRelativeTarget(attributes.href, sourceDirectory);
        const external = /^https?:\/\//i.test(href ?? "");
        return {
          tagName: "a",
          attribs: {
            ...attributes,
            href,
            ...(external
              ? { rel: "noopener noreferrer", target: "_blank" }
              : {}),
          },
        };
      },
      img: (_tagName, attributes) => ({
        tagName: "img",
        attribs: {
          ...attributes,
          src: rewriteRelativeTarget(attributes.src, sourceDirectory),
          loading: "lazy",
        },
      }),
      table: () => ({
        tagName: "table",
        attribs: {},
      }),
    },
  });
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => collator.compare(left.name, right.name));
  const results = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(absolutePath)));
    } else {
      results.push(absolutePath);
    }
  }

  return results;
}

async function firstCommitTime(relativePath, absolutePath) {
  const recordedTime = Date.parse(orderLedger[relativePath]);
  if (!Number.isNaN(recordedTime)) {
    return recordedTime;
  }

  try {
    const output = execFileSync(
      "git",
      [
        "log",
        "--follow",
        "--diff-filter=A",
        "--format=%aI",
        "--",
        toPosix(path.join("markdown", relativePath)),
      ],
      {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    if (output.length > 0) {
      return Date.parse(output.at(-1));
    }
  } catch {
    // The local preview may not have Git history yet.
  }

  const fileStat = await stat(absolutePath);
  return fileStat.birthtimeMs || fileStat.mtimeMs;
}

async function parseDocument(absolutePath) {
  const relativePath = toPosix(path.relative(markdownRoot, absolutePath));
  const sourceDirectory = path.posix.dirname(relativePath);
  const normalizedDirectory =
    sourceDirectory === "." ? "" : sourceDirectory;
  const filename = path.posix.basename(relativePath);
  const fallbackTitle = filename.replace(/\.md$/i, "");
  const raw = await readFile(absolutePath, "utf8");
  let parsed;

  try {
    parsed = matter(raw);
  } catch (error) {
    warnings.push(
      `${relativePath}: Front Matter 解析失败（${error.message}），已按无元数据文档处理。`,
    );
    parsed = { data: {}, content: raw };
  }

  const tokens = marked.lexer(parsed.content);
  const firstHeadingIndex = tokens.findIndex(
    (token) => token.type === "heading" && token.depth === 1,
  );
  const headingTitle =
    firstHeadingIndex >= 0 ? plainHeading(tokens[firstHeadingIndex]) : "";
  const frontMatterTitle =
    typeof parsed.data.title === "string" ? parsed.data.title.trim() : "";
  let title = fallbackTitle;
  let titleSource = "filename";

  if (frontMatterTitle) {
    title = frontMatterTitle;
    titleSource = "frontmatter";
  } else if (headingTitle) {
    title = headingTitle;
    titleSource = "heading";
    tokens.splice(firstHeadingIndex, 1);
  }

  return {
    absolutePath,
    relativePath,
    directory: normalizedDirectory,
    filename,
    isReadme: filename.toLowerCase() === "readme.md",
    id: normalizeId(parsed.data.id, relativePath),
    title,
    titleSource,
    visible:
      parsed.data.cleanup === 1 || parsed.data.cleanup === "1",
    source: normalizeSource(parsed.data.source, relativePath),
    ...resolveDate(parsed.data, relativePath),
    html: renderMarkdown(tokens, normalizedDirectory),
    firstCommitTime: await firstCommitTime(relativePath, absolutePath),
  };
}

async function writeJson(targetPath, value) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function routeFor(directory, ...segments) {
  return `/${[directory, ...segments].filter(Boolean).join("/")}`;
}

function contentFile(root, relativePath, filename) {
  return path.join(
    root,
    ...relativePath.split("/").filter(Boolean),
    filename,
  );
}

function publicDocument(document) {
  return {
    type: "document",
    title: document.title,
    titleSource: document.titleSource,
    citation: document.citation,
    date: document.date,
    dateKind: document.kind,
    source: document.source,
    reference:
      document.kind === "saved" && document.date
        ? {
            title: document.title,
            medium: "EB/OL",
            date: document.date,
            source: document.source,
          }
        : null,
    html: document.html,
  };
}

function compareDuplicateOrder(left, right) {
  return (
    left.firstCommitTime - right.firstCommitTime ||
    collator.compare(left.relativePath, right.relativePath)
  );
}

function compareIndexItems(left, right) {
  if (left.date && right.date && left.date !== right.date) {
    return right.date.localeCompare(left.date);
  }
  if (left.date && !right.date) {
    return -1;
  }
  if (!left.date && right.date) {
    return 1;
  }
  return collator.compare(left.title, right.title);
}

async function copyAssets(allFiles) {
  const assetFiles = allFiles.filter(
    (absolutePath) => !absolutePath.toLowerCase().endsWith(".md"),
  );

  for (const absolutePath of assetFiles) {
    const relativePath = path.relative(markdownRoot, absolutePath);
    const targetPath = path.join(fileRoot, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(absolutePath, targetPath);
  }
}

async function build() {
  await mkdir(markdownRoot, { recursive: true });
  await rm(contentRoot, { recursive: true, force: true });
  await rm(fileRoot, { recursive: true, force: true });

  try {
    orderLedger = JSON.parse(await readFile(orderLedgerPath, "utf8"));
  } catch {
    orderLedger = {};
  }

  const allFiles = await walk(markdownRoot);
  const markdownFiles = allFiles.filter((absolutePath) =>
    absolutePath.toLowerCase().endsWith(".md"),
  );
  const documents = await Promise.all(markdownFiles.map(parseDocument));
  const directories = new Map([["", []]]);

  for (const document of documents) {
    if (!directories.has(document.directory)) {
      directories.set(document.directory, []);
    }
    directories.get(document.directory).push(document);

    const segments = document.directory.split("/").filter(Boolean);
    for (let index = 1; index <= segments.length; index += 1) {
      const parent = segments.slice(0, index).join("/");
      if (!directories.has(parent)) {
        directories.set(parent, []);
      }
    }
  }

  const routeGroups = new Map();
  for (const document of documents) {
    if (document.isReadme || !document.id) {
      continue;
    }
    const key = `${document.directory}\0${document.id}`;
    if (!routeGroups.has(key)) {
      routeGroups.set(key, []);
    }
    routeGroups.get(key).push(document);
  }

  const resolvedRoutes = new Map();
  for (const group of routeGroups.values()) {
    group.sort(compareDuplicateOrder);
    const { directory, id } = group[0];

    if (group.length === 1) {
      const route = routeFor(directory, id);
      resolvedRoutes.set(group[0].relativePath, route);
      await writeJson(
        contentFile(
          path.join(contentRoot, "articles"),
          directory,
          `${id}.json`,
        ),
        publicDocument(group[0]),
      );
      continue;
    }

    const baseRoute = routeFor(directory, id);
    warnings.push(
      `${group.map((item) => item.relativePath).join(", ")}: ID "${id}" 重复，已生成编号路由。`,
    );
    await writeJson(
      contentFile(
        path.join(contentRoot, "articles"),
        directory,
        `${id}.json`,
      ),
      {
        type: "redirect",
        to: `${baseRoute}/1`,
      },
    );

    for (const [index, document] of group.entries()) {
      const number = String(index + 1);
      const route = `${baseRoute}/${number}`;
      resolvedRoutes.set(document.relativePath, route);
      await writeJson(
        contentFile(
          path.join(contentRoot, "articles"),
          route.slice(1),
          "index.json",
        ),
        publicDocument(document),
      );
    }
  }

  for (const [directory, directoryDocuments] of directories) {
    const directoryRoot = contentFile(
      path.join(contentRoot, "directories"),
      directory,
      "",
    );
    const readme = directoryDocuments.find((document) => document.isReadme);
    const visibleItems = directoryDocuments
      .filter(
        (document) =>
          !document.isReadme &&
          document.visible &&
          resolvedRoutes.has(document.relativePath),
      )
      .map((document) => ({
        title: document.title,
        href: resolvedRoutes.get(document.relativePath),
        citation: document.citation,
        date: document.date,
      }))
      .sort(compareIndexItems);

    await writeJson(path.join(directoryRoot, "meta.json"), {
      directory,
      hasReadme: Boolean(readme),
    });
    await writeJson(path.join(directoryRoot, "index.json"), {
      directory,
      title: directory ? `${directory} / 文档索引` : "文档索引",
      items: visibleItems,
    });

    if (readme) {
      await writeJson(
        path.join(directoryRoot, "readme.json"),
        publicDocument(readme),
      );
    }
  }

  await copyAssets(allFiles);

  console.log(
    `已解析 ${documents.length} 个 Markdown，生成 ${resolvedRoutes.size} 个文档路由。`,
  );
  for (const warning of warnings) {
    console.warn(`警告：${warning}`);
  }
}

await build();
