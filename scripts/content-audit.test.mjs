import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { auditSite } from "./content-audit.mjs";

async function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

function article(slug, overrides = {}) {
  const title = overrides.title ?? `Complete Astro Guide ${slug}`;
  const description =
    overrides.description ?? `A practical and reproducible guide for the ${slug} workflow.`;
  const body =
    overrides.body ??
    `## Problem and outcome

This fixture demonstrates a concrete result.

## Implementation

\`\`\`bash
npm run build
\`\`\`

<figure><img src="/images/evidence/${slug}/evidence.png" alt="Build result for ${slug}"><figcaption>Actual fixture output.</figcaption></figure>

Read [guide one](/blog/guide-one/) and [guide two](/blog/guide-two/).

## Verification

Confirm the command exits successfully.

## Limitations and recommendation

Use this method for static Astro sites only.`;

  return `---
title: "${title}"
description: "${description}"
pubDate: 2026-06-11
author: "Jun Yang"
category: "Astro Guides"
tags: ["Astro", "Testing"]
draft: false
seoTitle: "${overrides.seoTitle ?? title}"
seoDescription: "${overrides.seoDescription ?? description}"
---

${body}
`;
}

async function fixtureSite(options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "astroseo-audit-"));
  const count = options.count ?? 22;
  const slugs = Array.from({ length: count }, (_, index) => `guide-${index + 1}`);

  for (const [index, slug] of slugs.entries()) {
    const overrides = index === 0 ? options.firstArticle ?? {} : {};
    await write(root, `src/content/posts/${slug}.md`, article(slug, overrides));
    await write(root, `public/images/evidence/${slug}/source.txt`, "npm run build\n");
    await write(root, `public/images/evidence/${slug}/result.txt`, "build complete\n");
    await write(root, `public/images/evidence/${slug}/evidence.png`, "fixture image");
  }

  await write(
    root,
    "src/config/site.ts",
    'export const siteConfig = { siteUrl: "https://example.com" };\n'
  );

  for (const page of ["about", "contact", "privacy", "terms", "disclaimer"]) {
    const contactText =
      page === "contact"
        ? "https://github.com/example/site/issues Do not submit credentials or sensitive data."
        : page === "about"
          ? "Purpose Audience Editorial principles Jun Yang tested where practical corrections update policy"
          : "Editorial and legal information for this publication.";
    await write(root, `src/pages/${page}.astro`, contactText);
  }
  await write(
    root,
    "src/components/Footer.astro",
    "/about/ /contact/ /privacy/ /terms/ /disclaimer/ https://github.com/example/site"
  );

  const mapRows = slugs.map((slug) => `| ${slug} | retain | ${slug} | retained | none | no |`);
  mapRows.push("| old-guide | merge | guide-1 | overlapping intent | legacy section | yes |");
  await write(
    root,
    "docs/content-consolidation-map.md",
    `| Existing slug | Decision | Retained target | Reason | Absorbed sections | Redirect |\n| --- | --- | --- | --- | --- | --- |\n${mapRows.join("\n")}\n`
  );
  await write(root, "public/_redirects", options.redirects ?? "/blog/old-guide/ /blog/guide-1/ 301\n");
  return root;
}

test("accepts a complete 22-article site", async () => {
  const report = await auditSite(await fixtureSite());
  assert.deepEqual(report.errors, []);
  assert.equal(report.articles.length, 22);
  assert.equal(report.redirects.length, 1);
});

test("rejects an article count other than 22", async () => {
  const report = await auditSite(await fixtureSite({ count: 21 }));
  assert.match(report.errors.join("\n"), /expected 22 published articles, found 21/);
});

test("rejects an article without verification", async () => {
  const body = article("guide-1").split("## Verification")[0];
  const report = await auditSite(await fixtureSite({ firstArticle: { body } }));
  assert.match(report.errors.join("\n"), /guide-1: missing section: Verification/);
});

test("rejects fewer than two contextual blog links", async () => {
  const body = article("guide-1")
    .replace(" and [guide two](/blog/guide-two/)", "")
    .replace("---\n\n", "");
  const report = await auditSite(await fixtureSite({ firstArticle: { body } }));
  assert.match(report.errors.join("\n"), /guide-1: expected at least 2 contextual blog links/);
});

test("rejects missing evidence", async () => {
  const body = article("guide-1")
    .replace("/images/evidence/guide-1/evidence.png", "/images/evidence/missing/evidence.png")
    .replace("---\n\n", "");
  const report = await auditSite(await fixtureSite({ firstArticle: { body } }));
  assert.match(report.errors.join("\n"), /guide-1: missing evidence image/);
});

test("rejects an evidence image without alt text", async () => {
  const body = article("guide-1").replace('alt="Build result for guide-1"', 'alt=""').replace("---\n\n", "");
  const report = await auditSite(await fixtureSite({ firstArticle: { body } }));
  assert.match(report.errors.join("\n"), /guide-1: evidence image requires alt text/);
});

test("rejects a missing redirect for a merged slug", async () => {
  const report = await auditSite(await fixtureSite({ redirects: "" }));
  assert.match(report.errors.join("\n"), /old-guide: missing redirect/);
});

test("rejects a redirect chain", async () => {
  const redirects = "/blog/old-guide/ /blog/middle-guide/ 301\n/blog/middle-guide/ /blog/guide-1/ 301\n";
  const report = await auditSite(await fixtureSite({ redirects }));
  assert.match(report.errors.join("\n"), /redirect chain/);
});

test("rejects duplicate titles", async () => {
  const root = await fixtureSite();
  await write(root, "src/content/posts/guide-2.md", article("guide-2", { title: "Complete Astro Guide guide-1" }));
  const report = await auditSite(root);
  assert.match(report.errors.join("\n"), /duplicate title/);
});

test("rejects banned launch-template phrases", async () => {
  const body = article("guide-1").replace("## Problem and outcome", "## Problem and outcome\n\nPublishing note").replace("---\n\n", "");
  const report = await auditSite(await fixtureSite({ firstArticle: { body } }));
  assert.match(report.errors.join("\n"), /guide-1: banned phrase: Publishing note/);
});

test("rejects an incomplete About page", async () => {
  const root = await fixtureSite();
  await write(root, "src/pages/about.astro", "This is a short About page.");
  const report = await auditSite(root);
  assert.match(report.errors.join("\n"), /about: missing editorial principles/);
});

test("rejects missing trust links in the footer", async () => {
  const root = await fixtureSite();
  await write(root, "src/components/Footer.astro", "/about/ /contact/");
  const report = await auditSite(root);
  assert.match(report.errors.join("\n"), /footer: missing link: \/privacy\//);
});

test("accepts a Contact page that reads the Issues URL from site config", async () => {
  const root = await fixtureSite();
  await write(root, "src/pages/contact.astro", "<a href={siteConfig.issuesUrl}>Issues</a> Do not submit sensitive data.");
  await write(root, "src/config/site.ts", 'export const siteConfig = { siteUrl: "https://example.com", issuesUrl: "https://github.com/example/site/issues" };\n');
  const report = await auditSite(root);
  assert.doesNotMatch(report.errors.join("\n"), /contact: missing GitHub Issues URL/);
});
