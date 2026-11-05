import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const collections = {
  articles: defineCollection({
    loader: glob({
      pattern: '**/*.md',
      base: './content',
    }),
    schema: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      draft: z.boolean().optional().default(false),
      published: z.coerce.date().optional(),
      publishDate: z.coerce.date().optional(),
      modified: z.coerce.date().optional(),
      modifiedDate: z.coerce.date().optional(),
      minor: z.boolean().optional().default(false),
      slug: z.string().optional(),
      tags: z.union([z.string(), z.array(z.string())]).optional(),
      comments: z.boolean().optional(),
      lang: z.string().optional().default('en'),
      dir: z.enum(['ltr', 'rtl']).optional().default('ltr'),
      redirects: z.array(z.string()).optional(),
    }).passthrough().optional().default({}),
  }),
};
