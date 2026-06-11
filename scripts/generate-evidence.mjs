import { execSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const postsDir = path.join(root, "src/content/posts");
const evidenceRoot = path.join(root, "public/images/evidence");

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrap(value, width = 88) {
  const lines = [];
  for (const rawLine of value.split("\n")) {
    if (!rawLine) {
      lines.push("");
      continue;
    }
    let remaining = rawLine;
    while (remaining.length > width) {
      lines.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }
    lines.push(remaining);
  }
  return lines.slice(0, 30);
}

async function renderEvidence(slug, command, result) {
  const lines = ["$ " + command, "", ...wrap(result)];
  const lineHeight = 28;
  const height = Math.max(420, 92 + lines.length * lineHeight);
  const text = lines
    .map((line, index) => `<text x="42" y="${72 + index * lineHeight}" class="terminal">${escapeXml(line)}</text>`)
    .join("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${height}" viewBox="0 0 1400 ${height}">
    <rect width="1400" height="${height}" rx="24" fill="#172019"/>
    <circle cx="42" cy="30" r="7" fill="#e66b5b"/><circle cx="66" cy="30" r="7" fill="#e9b949"/><circle cx="90" cy="30" r="7" fill="#63b174"/>
    <text x="700" y="36" text-anchor="middle" class="label">AstroSEO.io evidence · ${escapeXml(slug)}</text>
    <style>.terminal{font:21px SFMono-Regular,Consolas,monospace;fill:#edf6ec}.label{font:18px Georgia,serif;fill:#9fb4a1}</style>
    ${text}
  </svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(evidenceRoot, slug, "evidence.png"));
}

const files = (await readdir(postsDir)).filter((file) => file.endsWith(".md")).sort();

// Create the complete evidence inventory first so commands that run the content audit
// can inspect the same file set that will be published.
for (const file of files) {
  const slug = file.replace(/\.md$/, "");
  const source = await readFile(path.join(postsDir, file), "utf8");
  const command = source.match(/```bash\n([\s\S]*?)\n```/)?.[1]?.trim();
  if (!command) throw new Error(`${slug} has no bash evidence command`);
  await mkdir(path.join(evidenceRoot, slug), { recursive: true });
  await writeFile(path.join(evidenceRoot, slug, "source.txt"), `${command}\n`);
  await writeFile(path.join(evidenceRoot, slug, "result.txt"), "Evidence command has not run yet.\n");
  await renderEvidence(slug, command, "Evidence command has not run yet.");
}

for (const file of files) {
  const slug = file.replace(/\.md$/, "");
  const command = (await readFile(path.join(evidenceRoot, slug, "source.txt"), "utf8")).trim();
  let result;
  try {
    result = execSync(command, {
      cwd: root,
      encoding: "utf8",
      shell: "/bin/zsh",
      maxBuffer: 1024 * 1024 * 8,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    });
  } catch (error) {
    result = [error.stdout, error.stderr, `exit code: ${error.status ?? "unknown"}`].filter(Boolean).join("\n");
  }
  const normalized = (result.trim().slice(0, 6000) || "Command completed without text output.")
    .replaceAll(root, "<repo>")
    .replaceAll("/Users/yangjun", "<home>")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
  await writeFile(path.join(evidenceRoot, slug, "result.txt"), `${normalized}\n`);
  await renderEvidence(slug, command, normalized);
  console.log(`Captured ${slug}`);
}
