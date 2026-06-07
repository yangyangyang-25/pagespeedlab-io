import { defineCollection, z } from "astro:content";
import { siteConfig } from "../config/site";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().min(10),
    description: z.string().min(30),
    pubDate: z.coerce.date(),
    modDate: z.coerce.date().optional(),
    author: z.string().min(2),
    category: z.enum(siteConfig.categories),
    tags: z.array(z.string().min(2)).min(1),
    draft: z.boolean().default(false),
    image: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional()
  })
});

export const collections = { posts };
