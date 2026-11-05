// src/pages/og/[category]/[slug].png.ts
// Static endpoint generating 1200x630 coffee-themed OG share image for every article

import type { APIRoute } from 'astro';
import { getGroupedCategories, type Article } from '../../../lib/articles';
import { generateOgImage } from '../../../lib/og-image';
import { siteConfig } from '../../../../site.config';

export async function getStaticPaths() {
  const categories = await getGroupedCategories();
  const paths = [];

  for (const cat of categories) {
    for (const article of cat.articles) {
      paths.push({
        params: {
          category: article.categorySlug,
          slug: article.slug,
        },
        props: {
          article,
        },
      });
    }
  }

  return paths;
}

interface Props {
  article: Article;
}

export const GET: APIRoute = async ({ props }) => {
  const { article } = props as Props;

  const imageBuffer = await generateOgImage({
    title: article.title,
    category: article.category,
    siteName: siteConfig.name,
    author: siteConfig.author,
  });

  return new Response(new Uint8Array(imageBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
    },
  });
};
