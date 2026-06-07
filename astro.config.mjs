import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkGfm from "remark-gfm";

const site = "https://pagespeedlab-io.pages.dev";

export default defineConfig({
  site,
  base: "/",
  output: "static",
  integrations: [mdx(), sitemap()],
  markdown: {
    remarkPlugins: [remarkGfm]
  }
});
