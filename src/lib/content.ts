import type { CollectionEntry } from "astro:content";

export type PostEntry = CollectionEntry<"posts">;

export function isPublished(post: PostEntry) {
  return !post.data.draft;
}

export function sortPosts(posts: PostEntry[]) {
  return [...posts].sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
  );
}

export function slugify(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function groupByCategory(posts: PostEntry[]) {
  return posts.reduce<Record<string, PostEntry[]>>((acc, post) => {
    const key = post.data.category;
    acc[key] ||= [];
    acc[key].push(post);
    return acc;
  }, {});
}

export function groupByTag(posts: PostEntry[]) {
  return posts.reduce<Record<string, PostEntry[]>>((acc, post) => {
    for (const tag of post.data.tags) {
      acc[tag] ||= [];
      acc[tag].push(post);
    }
    return acc;
  }, {});
}

export function getRelatedPosts(current: PostEntry, posts: PostEntry[], limit = 3) {
  return posts
    .filter((post) => post.id !== current.id)
    .map((post) => {
      const categoryScore = post.data.category === current.data.category ? 2 : 0;
      const tagScore = post.data.tags.filter((tag) => current.data.tags.includes(tag)).length;
      return { post, score: categoryScore + tagScore };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.post);
}
