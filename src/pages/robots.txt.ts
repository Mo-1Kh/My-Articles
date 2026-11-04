// src/pages/robots.txt.ts
// Static robots.txt referencing canonical sitemap per Section 10
import type { APIRoute } from 'astro';
import { getCanonicalUrl } from '../../site.config';

export const GET: APIRoute = async () => {
  const sitemapUrl = getCanonicalUrl('/sitemap.xml');

  const content = `User-agent: *
Allow: /
Disallow: /style-guide/

Sitemap: ${sitemapUrl}
`.trim();

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
