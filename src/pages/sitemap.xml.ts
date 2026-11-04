// src/pages/sitemap.xml.ts
// Static XML Sitemap with per-article lastmod dates per Section 10
import type { APIRoute } from 'astro';
import { getArticles } from '../lib/articles';
import { getCanonicalUrl } from '../../site.config';

function formatIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export const GET: APIRoute = async () => {
  const articles = await getArticles();

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

  const urls: { loc: string; lastmod: string; changefreq: string; priority: string }[] = [
    {
      loc: getCanonicalUrl('/'),
      lastmod: formatIsoDate(latestDate),
      changefreq: 'weekly',
      priority: '1.0',
    },
  ];

  for (const article of articles) {
    const lastmodDate = article.modifiedDate || article.publishedDate;
    urls.push({
      loc: getCanonicalUrl(`/${article.categorySlug}/${article.slug}/`),
      lastmod: formatIsoDate(lastmodDate),
      changefreq: 'monthly',
      priority: '0.8',
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
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
