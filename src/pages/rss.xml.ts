// src/pages/rss.xml.ts
// RSS 2.0 full-content feed per Section 8 & Section 10
import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { getArticles } from '../lib/articles';
import { siteConfig, getSiteOrigin, getBasePath, getPath } from '../../site.config';
import { generateExcerpt } from '../lib/excerpt';

const parser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

export const GET: APIRoute = async () => {
  const articles = await getArticles();

  // RSS readers expect newest articles first
  const sortedArticles = [...articles].sort(
    (a, b) => b.publishedDate.getTime() - a.publishedDate.getTime()
  );

  const siteUrl = `${getSiteOrigin()}${getBasePath() || '/'}`;

  return rss({
    title: siteConfig.name,
    description: siteConfig.description,
    site: siteUrl,
    items: sortedArticles.map((article) => {
      // Clean rawBody of Obsidian comments %% ... %%
      const cleanBody = article.rawBody.replace(/%%[\s\S]*?%%/g, '');
      const renderedHtml = parser.render(cleanBody);
      const safeContent = sanitizeHtml(renderedHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          'img',
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

      const description = article.description && article.description.trim() !== ''
        ? article.description
        : generateExcerpt(article.rawBody);

      return {
        title: article.title,
        pubDate: article.publishedDate,
        description,
        link: getPath(`/${article.categorySlug}/${article.slug}/`),
        content: safeContent,
        categories: [article.category, ...article.tags],
        author: siteConfig.author,
      };
    }),
    customData: `<language>en-us</language>`,
  });
};
