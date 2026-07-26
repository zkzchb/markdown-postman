import "./styles.css";

const app = document.querySelector("#app");
const siteName = "Markdown Postman";

function decodedSegments() {
  return window.location.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

function contentUrl(kind, segments, filename) {
  const encoded = segments.map((segment) => encodeURIComponent(segment));
  return `/_content/${kind}/${[...encoded, filename].join("/")}`;
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("application/json")) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

function setTitle(title) {
  document.title = title ? `${title} · ${siteName}` : siteName;
}

function resetPage(className = "") {
  document.body.className = className;
  app.replaceChildren();
}

function htmlToFragment(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

function createPaper() {
  const shell = document.createElement("main");
  shell.className = "reader-shell";
  const paper = document.createElement("article");
  paper.className = "paper";
  shell.append(paper);
  app.append(shell);
  return paper;
}

function appendWrappedText(element, value, lineLength = 30) {
  const characters = Array.from(String(value ?? ""));

  for (let index = 0; index < characters.length; index += lineLength) {
    if (index > 0) {
      element.append(document.createElement("br"));
    }
    element.append(characters.slice(index, index + lineLength).join(""));
  }
}

function renderBlank() {
  resetPage("blank-page");
  setTitle("");
}

function renderLoading() {
  resetPage();
  const shell = document.createElement("main");
  shell.className = "loading-shell";
  const label = document.createElement("span");
  label.textContent = "正在读取…";
  shell.append(label);
  app.append(shell);
}

function renderNotFound() {
  resetPage();
  setTitle("未找到文档");
  const paper = createPaper();
  const section = document.createElement("section");
  section.className = "status-message";
  const title = document.createElement("h1");
  title.textContent = "未找到文档";
  const hint = document.createElement("p");
  hint.textContent = "请检查地址是否正确。";
  section.append(title, hint);
  paper.append(section);
}

function renderDocument(article) {
  resetPage();
  setTitle(article.title);
  const paper = createPaper();
  const header = document.createElement("header");
  header.className = "document-header";
  const title = document.createElement("h1");
  appendWrappedText(title, article.title);
  header.append(title);

  if (!article.reference && (article.citation || article.source)) {
    const meta = document.createElement("div");
    meta.className = "document-meta";

    if (article.citation) {
      const citation = document.createElement("span");
      citation.textContent = article.citation;
      meta.append(citation);
    }

    if (article.source) {
      const source = document.createElement("a");
      source.href = article.source;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = "阅读原文";
      meta.append(source);
    }

    header.append(meta);
  }

  paper.append(header);

  if (article.reference) {
    const quote = document.createElement("blockquote");
    quote.className = "document-citation";
    quote.setAttribute("aria-label", "文献引用");
    const paragraph = document.createElement("p");
    const reference = article.reference;
    paragraph.append(
      `《${reference.title}》 [${reference.medium}]. [${reference.date}].`,
    );

    if (reference.source) {
      paragraph.append(" ");
      const source = document.createElement("a");
      source.href = reference.source;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = reference.source;
      paragraph.append(source, ".");
    }

    quote.append(paragraph);
    paper.append(quote);
  }

  const body = document.createElement("section");
  body.className = "markdown-body";
  body.append(htmlToFragment(article.html));
  paper.append(body);
}

function renderIndex(index) {
  resetPage();
  setTitle(index.title);
  const paper = createPaper();
  const header = document.createElement("header");
  header.className = "index-header";
  const title = document.createElement("h1");
  title.textContent = index.title;
  header.append(title);

  const list = document.createElement("ol");
  list.className = "document-list";

  if (index.items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "index-empty";
    empty.textContent = "暂无可显示文档";
    paper.append(header, empty);
    return;
  }

  for (const item of index.items) {
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.href;
    link.textContent = item.title;
    listItem.append(link);

    if (item.citation) {
      const meta = document.createElement("span");
      meta.textContent = item.citation;
      listItem.append(meta);
    }

    list.append(listItem);
  }

  paper.append(header, list);
}

async function renderDirectoryHome(segments, metadata) {
  if (!metadata.hasReadme) {
    renderBlank();
    return;
  }

  const document = await fetchJson(
    contentUrl("directories", segments, "readme.json"),
  );
  if (document?.type === "document") {
    renderDocument(document);
  } else {
    renderBlank();
  }
}

async function route() {
  renderLoading();
  const segments = decodedSegments();

  if (segments.at(-1)?.toLowerCase() === "index") {
    const directorySegments = segments.slice(0, -1);
    const index = await fetchJson(
      contentUrl("directories", directorySegments, "index.json"),
    );
    if (index) {
      renderIndex(index);
    } else {
      renderNotFound();
    }
    return;
  }

  const directoryMetadata = await fetchJson(
    contentUrl("directories", segments, "meta.json"),
  );
  if (directoryMetadata) {
    await renderDirectoryHome(segments, directoryMetadata);
    return;
  }

  const article = await fetchJson(
    contentUrl("articles", segments.slice(0, -1), `${segments.at(-1)}.json`),
  );

  if (article?.type === "redirect") {
    window.location.replace(article.to);
    return;
  }
  if (article?.type === "document") {
    renderDocument(article);
    return;
  }

  const numberedArticle = await fetchJson(
    contentUrl("articles", segments, "index.json"),
  );
  if (numberedArticle?.type === "document") {
    renderDocument(numberedArticle);
    return;
  }

  renderNotFound();
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (
    !link ||
    link.target === "_blank" ||
    link.origin !== window.location.origin ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();
  history.pushState(null, "", link.href);
  route();
});

window.addEventListener("popstate", route);
route();
