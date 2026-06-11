import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_SECTIONS = ["Verification", "Limitations and recommendation"];
const REQUIRED_PAGES = ["about", "contact", "privacy", "terms", "disclaimer"];
const BANNED_PHRASES = [
  "Small publishing mistakes",
  "Start with the target keyword",
  "Final checklist",
  "Publishing note",
  "launch set",
];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed.replace(/^['"]|['"]$/g, "");
}

function parseMarkdown(source, slug) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { slug, data: {}, body: source };
  const data = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (field) data[field[1]] = parseScalar(field[2]);
  }
  return { slug, data, body: match[2] };
}

async function readArticles(rootDir) {
  const postsDir = path.join(rootDir, "src/content/posts");
  if (!(await exists(postsDir))) return [];
  const files = (await readdir(postsDir)).filter((file) => /\.mdx?$/.test(file)).sort();
  const articles = [];
  for (const file of files) {
    const source = await readFile(path.join(postsDir, file), "utf8");
    const article = parseMarkdown(source, file.replace(/\.mdx?$/, ""));
    if (article.data.draft !== true) articles.push(article);
  }
  return articles;
}

async function readRedirects(rootDir) {
  const file = path.join(rootDir, "public/_redirects");
  if (!(await exists(file))) return [];
  const source = await readFile(file, "utf8");
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [from, to, status] = line.split(/\s+/);
      return { from, to, status };
    })
    .filter((item) => item.from && item.to);
}

async function readMap(rootDir) {
  const file = path.join(rootDir, "docs/content-consolidation-map.md");
  if (!(await exists(file))) return [];
  const source = await readFile(file, "utf8");
  return source
    .split("\n")
    .filter((line) => /^\|/.test(line) && !/Existing slug|^\|\s*-/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 3)
    .map(([slug, decision, target]) => ({ slug, decision, target }));
}

function addDuplicateErrors(articles, field, errors) {
  const seen = new Map();
  for (const article of articles) {
    const value = article.data[field];
    if (!value) continue;
    if (seen.has(value)) errors.push(`${article.slug}: duplicate ${field} with ${seen.get(value)}`);
    else seen.set(value, article.slug);
  }
}

function validateArticles(articles, errors) {
  if (articles.length !== 22) {
    errors.push(`expected 22 published articles, found ${articles.length}`);
  }

  addDuplicateErrors(articles, "title", errors);
  addDuplicateErrors(articles, "description", errors);
  addDuplicateErrors(articles, "seoTitle", errors);
  addDuplicateErrors(articles, "seoDescription", errors);

  for (const article of articles) {
    for (const section of REQUIRED_SECTIONS) {
      if (!new RegExp(`^##\\s+${section}\\s*$`, "im").test(article.body)) {
        errors.push(`${article.slug}: missing section: ${section}`);
      }
    }

    const links = article.body.match(/\[[^\]]+\]\(\/blog\/[^)]+\)/g) ?? [];
    if (links.length < 2) errors.push(`${article.slug}: expected at least 2 contextual blog links`);

    for (const phrase of BANNED_PHRASES) {
      if (article.body.toLowerCase().includes(phrase.toLowerCase())) {
        errors.push(`${article.slug}: banned phrase: ${phrase}`);
      }
    }

    const evidenceImages = [...article.body.matchAll(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)];
    if (evidenceImages.length === 0) errors.push(`${article.slug}: missing evidence image reference`);
    if (evidenceImages.length > 0 && !/<figcaption>[\s\S]*?<\/figcaption>/i.test(article.body)) {
      errors.push(`${article.slug}: evidence image requires a visible figcaption`);
    }
    for (const image of evidenceImages) {
      const tag = image[0];
      const alt = tag.match(/alt=["']([^"']*)["']/i)?.[1] ?? "";
      if (!alt.trim()) errors.push(`${article.slug}: evidence image requires alt text`);
    }
  }
}

async function validateEvidence(rootDir, articles, errors) {
  for (const article of articles) {
    const evidenceDir = path.join(rootDir, "public/images/evidence", article.slug);
    for (const file of ["source.txt", "result.txt"]) {
      if (!(await exists(path.join(evidenceDir, file)))) {
        errors.push(`${article.slug}: missing evidence file: ${file}`);
      }
    }
    const hasRenderedEvidence =
      (await exists(path.join(evidenceDir, "evidence.webp"))) ||
      (await exists(path.join(evidenceDir, "evidence.png")));
    if (!hasRenderedEvidence) errors.push(`${article.slug}: missing evidence file: evidence.png or evidence.webp`);

    for (const match of article.body.matchAll(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
      const relative = match[1].replace(/^\//, "");
      if (!(await exists(path.join(rootDir, "public", relative)))) {
        errors.push(`${article.slug}: missing evidence image: ${match[1]}`);
      }
    }
  }
}

async function validatePages(rootDir, errors) {
  for (const page of REQUIRED_PAGES) {
    const target = path.join(rootDir, `src/pages/${page}.astro`);
    if (!(await exists(target))) errors.push(`missing trust page: ${page}`);
  }
  const contact = path.join(rootDir, "src/pages/contact.astro");
  if (await exists(contact)) {
    const source = await readFile(contact, "utf8");
    const configFile = path.join(rootDir, "src/config/site.ts");
    const configSource = (await exists(configFile)) ? await readFile(configFile, "utf8") : "";
    const hasIssuesUrl =
      /github\.com\/[^/]+\/[^/]+\/issues/.test(source) ||
      (/siteConfig\.issuesUrl/.test(source) && /issuesUrl:\s*["']https:\/\/github\.com\/[^/]+\/[^/]+\/issues["']/.test(configSource));
    if (!hasIssuesUrl) errors.push("contact: missing GitHub Issues URL");
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(source)) errors.push("contact: public email address is not allowed");
  }

  const about = path.join(rootDir, "src/pages/about.astro");
  if (await exists(about)) {
    const source = await readFile(about, "utf8");
    if (!/editorial principles/i.test(source)) errors.push("about: missing editorial principles");
    if (!/Jun Yang/.test(source)) errors.push("about: missing author identity");
    if (!/tested where practical/i.test(source)) errors.push("about: missing testing policy");
  }

  const footer = path.join(rootDir, "src/components/Footer.astro");
  if (!(await exists(footer))) {
    errors.push("missing footer component");
  } else {
    const source = await readFile(footer, "utf8");
    for (const route of REQUIRED_PAGES.map((page) => `/${page}/`)) {
      if (!source.includes(route)) errors.push(`footer: missing link: ${route}`);
    }
  }
}

function normalizeRoute(route) {
  if (!route) return route;
  const pathname = route.split(/[?#]/)[0];
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function validateRedirects(mapRows, redirects, articleSlugs, errors) {
  const bySource = new Map(redirects.map((item) => [normalizeRoute(item.from), item]));
  const redirectSources = new Set(bySource.keys());
  for (const row of mapRows.filter((item) => item.decision !== "retain")) {
    const source = `/blog/${row.slug}/`;
    const redirect = bySource.get(source);
    if (!redirect) {
      errors.push(`${row.slug}: missing redirect`);
      continue;
    }
    if (redirect.status !== "301") errors.push(`${row.slug}: redirect must use 301`);
    const target = normalizeRoute(redirect.to);
    if (redirectSources.has(target)) errors.push(`${row.slug}: redirect chain through ${target}`);
    const targetSlug = target?.match(/^\/blog\/([^/]+)\/$/)?.[1];
    if (!targetSlug || !articleSlugs.has(targetSlug)) errors.push(`${row.slug}: redirect target does not exist`);
  }
}

function validateCanonicalUniqueness(articles, siteUrl, errors) {
  const seen = new Set();
  for (const article of articles) {
    const canonical = `${siteUrl.replace(/\/$/, "")}/blog/${article.slug}/`;
    if (seen.has(canonical)) errors.push(`${article.slug}: duplicate canonical`);
    seen.add(canonical);
  }
}

async function readSiteUrl(rootDir) {
  const file = path.join(rootDir, "src/config/site.ts");
  if (!(await exists(file))) return "";
  const source = await readFile(file, "utf8");
  return source.match(/siteUrl:\s*["']([^"']+)["']/)?.[1] ?? "";
}

export async function auditSite(rootDir) {
  const errors = [];
  const warnings = [];
  const articles = await readArticles(rootDir);
  const redirects = await readRedirects(rootDir);
  const mapRows = await readMap(rootDir);
  validateArticles(articles, errors);
  await validateEvidence(rootDir, articles, errors);
  await validatePages(rootDir, errors);
  validateRedirects(mapRows, redirects, new Set(articles.map((article) => article.slug)), errors);
  validateCanonicalUniqueness(articles, await readSiteUrl(rootDir), errors);
  return { errors, warnings, articles, redirects };
}

async function writeReports(rootDir, report) {
  const reportDir = path.join(rootDir, "work/content-audit");
  await mkdir(reportDir, { recursive: true });
  const summary = {
    articleCount: report.articles.length,
    redirectCount: report.redirects.length,
    errors: report.errors,
    warnings: report.warnings,
  };
  await writeFile(path.join(reportDir, "astroseo-io.json"), `${JSON.stringify(summary, null, 2)}\n`);
  const markdown = `# AstroSEO.io Content Audit\n\n- Articles: ${summary.articleCount}\n- Redirects: ${summary.redirectCount}\n- Errors: ${summary.errors.length}\n- Warnings: ${summary.warnings.length}\n\n## Errors\n\n${summary.errors.length ? summary.errors.map((error) => `- ${error}`).join("\n") : "None."}\n`;
  await writeFile(path.join(reportDir, "astroseo-io.md"), markdown);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rootDir = process.cwd();
  const report = await auditSite(rootDir);
  await writeReports(rootDir, report);
  console.log(JSON.stringify({
    articles: report.articles.length,
    redirects: report.redirects.length,
    errors: report.errors,
    warnings: report.warnings,
  }, null, 2));
  process.exitCode = report.errors.length ? 1 : 0;
}
