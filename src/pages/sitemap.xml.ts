// src/pages/sitemap.xml.ts
// Static XML Sitemap with per-article lastmod dates, category/tag hub pages, and Google Image Sitemap extension
import type { APIRoute } from 'astro';
import { getArticles, getGroupedCategories, getAllTags } from '../lib/articles';
import { resolveImage } from '../lib/images';
import { getCanonicalUrl, getSiteOrigin } from '../../site.config';

function formatIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractArticleImages(rawBody: string): string[] {
  const origin = getSiteOrigin();
  const imageUrls = new Set<string>();

  for (const match of rawBody.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
    const info = resolveImage(match[1].trim());
    if (info) {
      imageUrls.add(`${origin}${info.fullAvifUrl || info.optimizedUrl}`);
    }
  }

  for (const match of rawBody.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawSrc = match[1].trim();
    if (rawSrc.startsWith('http://') || rawSrc.startsWith('https://')) {
      imageUrls.add(rawSrc);
    } else {
      const info = resolveImage(rawSrc);
      if (info) {
        imageUrls.add(`${origin}${info.fullAvifUrl || info.optimizedUrl}`);
      }
    }
  }

  return Array.from(imageUrls);
}

export const GET: APIRoute = async () => {
  const articles = await getArticles();
  const categories = await getGroupedCategories();
  const tags = await getAllTags();

  // Find most recent modification date across all articles for home page lastmod
  let latestDate = new Date(0);
  for (const a of articles) {
    const articleDate = a.modifiedDate || a.publishedDate;
    if (articleDate > latestDate) {
      latestDate = articleDate;
    }
  }
  if (latestDate.getTime() === 0) {
    latestDate = new Date();
  }

  const urls: { loc: string; lastmod: string; images?: string[] }[] = [
    {
      loc: getCanonicalUrl('/'),
      lastmod: formatIsoDate(latestDate),
    },
  ];

  // Category hub pages
  for (const cat of categories) {
    let catLatest = new Date(0);
    for (const a of cat.articles) {
      const d = a.modifiedDate || a.publishedDate;
      if (d > catLatest) catLatest = d;
    }
    urls.push({
      loc: getCanonicalUrl(`/${cat.slug}/`),
      lastmod: formatIsoDate(catLatest.getTime() > 0 ? catLatest : latestDate),
    });
  }

  // Tag hub pages
  for (const tag of tags) {
    let tagLatest = new Date(0);
    for (const a of tag.articles) {
      const d = a.modifiedDate || a.publishedDate;
      if (d > tagLatest) tagLatest = d;
    }
    urls.push({
      loc: getCanonicalUrl(`/tags/${tag.slug}/`),
      lastmod: formatIsoDate(tagLatest.getTime() > 0 ? tagLatest : latestDate),
    });
  }

  // Article pages with image sitemap entries
  for (const article of articles) {
    const lastmodDate = article.modifiedDate || article.publishedDate;
    const images = extractArticleImages(article.rawBody);
    urls.push({
      loc: getCanonicalUrl(`/${article.categorySlug}/${article.slug}/`),
      lastmod: formatIsoDate(lastmodDate),
      images,
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map((u) => {
    const imageNodes = (u.images || [])
      .map(
        (img) => `    <image:image>
      <image:loc>${escapeXml(img)}</image:loc>
    </image:image>`
      )
      .join('\n');
    return `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>${imageNodes ? `\n${imageNodes}` : ''}
  </url>`;
  })
  .join('\n')}
</urlset>`.trim();

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
