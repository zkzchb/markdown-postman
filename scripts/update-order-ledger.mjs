import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const markdownRoot = path.join(projectRoot, "markdown");
const ledgerPath = path.join(projectRoot, "data", "content-order.json");
const collator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await walk(absolutePath)));
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      paths.push(absolutePath);
    }
  }

  return paths;
}

function firstCommitTime(relativePath) {
  try {
    const history = execFileSync(
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

    return history.at(-1) ?? null;
  } catch {
    return null;
  }
}

let existing = {};
try {
  existing = JSON.parse(await readFile(ledgerPath, "utf8"));
} catch {
  existing = {};
}

const markdownFiles = await walk(markdownRoot);
const entries = markdownFiles
  .map((absolutePath) => {
    const relativePath = toPosix(path.relative(markdownRoot, absolutePath));
    return [
      relativePath,
      firstCommitTime(relativePath) ?? existing[relativePath] ?? null,
    ];
  })
  .filter(([, timestamp]) => timestamp)
  .sort(([left], [right]) => collator.compare(left, right));

await mkdir(path.dirname(ledgerPath), { recursive: true });
await writeFile(
  ledgerPath,
  `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`,
  "utf8",
);

console.log(`已记录 ${entries.length} 个 Markdown 文件的首次提交时间。`);
