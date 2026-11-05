// src/pages/robots.txt.ts
// Static robots.txt referencing canonical sitemap per Section 10
import type { APIRoute } from 'astro';
import { getCanonicalUrl, getPath } from '../../site.config';

export const GET: APIRoute = async () => {
  const sitemapUrl = getCanonicalUrl('/sitemap.xml');
  const styleGuidePath = getPath('/style-guide/');

  const content = `User-agent: *
Allow: /
Disallow: ${styleGuidePath}

Sitemap: ${sitemapUrl}
`.trim();

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
