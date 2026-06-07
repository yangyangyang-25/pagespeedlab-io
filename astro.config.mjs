import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkGfm from "remark-gfm";

const repo = "pagespeedlab-io";
const owner = process.env.GITHUB_REPOSITORY_OWNER || "yangjun";
const site = `https://${owner}.github.io`;

export default defineConfig({
  site,
  base: `/${repo}`,
  output: "static",
  integrations: [mdx(), sitemap()],
  markdown: {
    remarkPlugins: [remarkGfm]
  }
});
