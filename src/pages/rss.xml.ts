import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { isPublished, sortPosts } from "../lib/content";

export async function GET(context: { site: URL }) {
  const posts = sortPosts((await getCollection("posts")).filter(isPublished));

  return rss({
    title: "AstroSEO.io",
    description: "Practical Astro SEO guides",
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.slug}/`
    }))
  });
}
