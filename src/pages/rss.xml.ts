// src/pages/rss.xml.ts
// RSS 2.0 full-content feed with Obsidian syntax rendering and absolute URLs per Section 8 & Section 10
import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { getArticles, slugify } from '../lib/articles';
import { slugifyHeading } from '../lib/slug';
import { resolveImage } from '../lib/images';
import { siteConfig, getSiteOrigin, getPath, getCanonicalUrl } from '../../site.config';
import { generateExcerpt } from '../lib/excerpt';

const parser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function preprocessObsidianForRss(
  rawBody: string,
  articleTitle: string,
  articleMap: Map<string, { url: string; title: string }>
): string {
  const origin = getSiteOrigin();

  // 1. Strip Obsidian comments %% ... %%
  let text = rawBody.replace(/%%[\s\S]*?%%/g, '');

  // 1b. Strip leading H1 if it duplicates the article title
  text = text.replace(/^\s*#\s+(.+)\r?\n?/, (fullMatch, h1Text: string) => {
    if (!articleTitle || h1Text.trim().toLowerCase() === articleTitle.trim().toLowerCase()) {
      return '';
    }
    return fullMatch;
  });

  // 2. Convert Obsidian image embeds ![[target|alt|width]] to absolute HTML <img>
  text = text.replace(/!\[\[([^[\]]+)\]\]/g, (_match, inner: string) => {
    const segments = inner.split('|').map((s) => s.trim()).filter(Boolean);
    const target = segments[0];
    let customAlt = '';
    let width: number | null = null;
    for (const seg of segments.slice(1)) {
      if (/^\d+(?:x\d+)?$/.test(seg)) {
        width = parseInt(seg.split('x')[0], 10);
      } else {
        customAlt = seg;
      }
    }
    const info = resolveImage(target);
    if (!info) return '';
    const absSrc = `${origin}${info.optimizedUrl}`;
    const rawAlt = customAlt || info.filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    const safeAlt = escapeHtml(rawAlt);
    const safeCaption = customAlt ? escapeHtml(customAlt) : '';
    const w = width || info.width;
    const h = Math.round(w * (info.height / info.width));
    return `<figure><img src="${absSrc}" alt="${safeAlt}" width="${w}" height="${h}" />${safeCaption ? `<figcaption>${safeCaption}</figcaption>` : ''}</figure>`;
  });

  // 3. Convert Obsidian wikilinks [[target#heading|alias]] to absolute HTML <a>
  text = text.replace(/\[\[([^[\]]+)\]\]/g, (_match, inner: string) => {
    let target = inner;
    let alias = '';
    let heading = '';

    if (target.includes('|')) {
      const parts = target.split('|');
      target = parts[0].trim();
      alias = parts[1].trim();
    }
    if (target.includes('#')) {
      const parts = target.split('#');
      target = parts[0].trim();
      heading = parts[1].trim();
    }

    const resolved = articleMap.get(target.toLowerCase()) || articleMap.get(slugify(target));
    const displayText = escapeHtml(alias || heading || target);
    if (resolved) {
      const href = heading ? `${resolved.url}#${slugifyHeading(heading)}` : resolved.url;
      return `<a href="${href}">${displayText}</a>`;
    }
    return displayText;
  });

  // 4. Convert ==highlights== to <mark>
  text = text.replace(/==([^=\n]+)==/g, (_m, inner: string) => `<mark>${escapeHtml(inner)}</mark>`);

  // 5. Convert Obsidian callout headers > [!note]+ Title to bold label
  text = text.replace(/^(>\s*)\[!(\w+)\][+-]?\s*(.*)$/gm, (_m, prefix, type, title) => {
    const label = title ? title.trim() : type.charAt(0).toUpperCase() + type.slice(1);
    return `${prefix}**${label}**`;
  });

  return text;
}

function absolutizeHtmlUrls(html: string): string {
  const origin = getSiteOrigin();
  return html
    .replace(/\b(src|href)="(\/[^"]*)"/g, (_m, attr, relPath) => {
      return `${attr}="${origin}${getPath(relPath)}"`;
    })
    .replace(/\bsrc="([^":]+)"/g, (m, srcVal) => {
      if (srcVal.startsWith('http://') || srcVal.startsWith('https://') || srcVal.startsWith('/')) {
        return m;
      }
      const info = resolveImage(srcVal);
      if (info) {
        return `src="${origin}${info.optimizedUrl}"`;
      }
      return m;
    });
}

export const GET: APIRoute = async () => {
  const articles = await getArticles();

  // Build lookup map for wikilinks in RSS
  const articleMap = new Map<string, { url: string; title: string }>();
  for (const a of articles) {
    const canonical = getCanonicalUrl(`/${a.categorySlug}/${a.slug}/`);
    articleMap.set(a.slug.toLowerCase(), { url: canonical, title: a.title });
    articleMap.set(a.title.toLowerCase(), { url: canonical, title: a.title });
  }

  // RSS readers expect newest articles first
  const sortedArticles = [...articles].sort(
    (a, b) => b.publishedDate.getTime() - a.publishedDate.getTime()
  );

  const siteUrl = getCanonicalUrl('/');
  const rssSelfUrl = getCanonicalUrl('/rss.xml');

  return rss({
    title: siteConfig.name,
    description: siteConfig.description,
    site: siteUrl,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
      dc: 'http://purl.org/dc/elements/1.1/',
    },
    items: sortedArticles.map((article) => {
      const preprocessed = preprocessObsidianForRss(article.rawBody, article.title, articleMap);
      const renderedHtml = absolutizeHtmlUrls(parser.render(preprocessed));
      const safeContent = sanitizeHtml(renderedHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          'img',
          'figure',
          'figcaption',
          'mark',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'pre',
          'code',
          'del',
        ]),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt', 'title', 'width', 'height'],
          a: ['href', 'title', 'target', 'rel'],
          code: ['class'],
          pre: ['class'],
        },
      });

      const description =
        article.description && article.description.trim() !== ''
          ? article.description
          : generateExcerpt(article.rawBody);

      return {
        title: article.title,
        pubDate: article.publishedDate,
        description,
        link: getPath(`/${article.categorySlug}/${article.slug}/`),
        content: safeContent,
        categories: [article.category, ...article.tags],
        customData: `<dc:creator>${escapeHtml(siteConfig.author)}</dc:creator>`,
      };
    }),
    customData: `<language>en-us</language><atom:link href="${rssSelfUrl}" rel="self" type="application/rss+xml" />`,
  });
};
