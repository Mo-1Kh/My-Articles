import { getCollection, type CollectionEntry } from 'astro:content';
import { getPath } from '../../site.config';
import fs from 'node:fs';
import path from 'node:path';
import { resolveArticleDates } from './git-dates';
import { slugify } from './slug.js';
export { slugify };

export interface Article {
  id: string;
  slug: string;
  category: string;
  categorySlug: string;
  title: string;
  description: string;
  publishedDate: Date;
  modifiedDate?: Date;
  draft: boolean;
  isScheduled?: boolean;
  rawBody: string;
  url: string;
  cover?: string;
  tags: string[];
  entry: CollectionEntry<'articles'>;
}

/**
 * Checks if local dev preview mode is enabled (showing drafts and future posts).
 * Active during local development or when PREVIEW=true / SHOW_DRAFTS=true.
 */
export function isPreviewMode(): boolean {
  if (typeof process === 'undefined') return false;
  return (
    process.env.PREVIEW === 'true' ||
    process.env.SHOW_DRAFTS === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

export interface CategoryGroup {
  name: string;
  slug: string;
  articles: Article[];
  oldestDate: Date;
}

/**
 * Extracts the title following Section 4 rules:
 * 1. frontmatter `title`
 * 2. first H1 in markdown (`# Heading`)
 * 3. filename
 */
export function extractTitle(rawBody: string, id: string, frontmatterTitle?: string): string {
  if (frontmatterTitle && frontmatterTitle.trim() !== '') {
    return frontmatterTitle.trim();
  }

  // Look for first Markdown H1: line starting with `# `
  const h1Match = rawBody.match(/^#\s+(.+)$/m);
  if (h1Match && h1Match[1] && h1Match[1].trim() !== '') {
    return h1Match[1].trim();
  }

  // Fallback to filename (strip directory and .md extension)
  const filename = id.split('/').pop()?.replace(/\.md$/i, '') || id;
  return filename
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Extracts category according to Section 4:
 * - Top-level folder name in ./content
 * - Root-level files -> "Uncategorized"
 * - Deeper subfolders merge into top-level category
 */
export function extractCategory(id: string): string {
  const normalized = id.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length <= 1) {
    return 'Uncategorized';
  }

  // Top-level folder
  const topFolder = parts[0];
  // Standardize naming: e.g. "coffee" -> "Coffee"
  return topFolder.charAt(0).toUpperCase() + topFolder.slice(1);
}

/**
 * Checks if an article should be ignored:
 * - .obsidian folder or files
 * - Any file or folder starting with "_"
 * - Attachment-only folders
 * - draft: true
 */
export function shouldIgnoreArticle(id: string, data: any, allowDrafts: boolean = isPreviewMode()): boolean {
  const normalized = id.replace(/\\/g, '/');
  const parts = normalized.split('/');

  // 1. Ignore anything starting with . (e.g. .obsidian)
  if (parts.some(p => p.startsWith('.'))) {
    return true;
  }

  // 2. Ignore any file or folder starting with _
  if (parts.some(p => p.startsWith('_'))) {
    return true;
  }

  // 3. Ignore attachment-only directories
  const lowerParts = parts.map(p => p.toLowerCase());
  if (lowerParts.some(p => ['attachments', 'images', 'assets', 'media'].includes(p))) {
    return true;
  }

  // 4. Ignore draft: true (unless preview mode is active)
  if (data?.draft === true && !allowDrafts) {
    return true;
  }

  return false;
}

/**
 * Fetches all valid articles from the content collection.
 */
export async function getArticles(): Promise<Article[]> {
  const entries = await getCollection('articles');
  const validArticles: Article[] = [];

  for (const entry of entries) {
    if (shouldIgnoreArticle(entry.id, entry.data)) {
      continue;
    }

    const rawBody = entry.body || '';
    const category = extractCategory(entry.id);
    const categorySlug = slugify(category);
    const title = extractTitle(rawBody, entry.id, entry.data?.title);

    // Slug: frontmatter slug, or filename basename without .md
    const fallbackSlug = entry.id.split('/').pop()?.replace(/\.md$/i, '') || entry.id;
    const finalSlug = slugify(entry.data?.slug || fallbackSlug);

    // Resolve real Git dates with caching, overrides, minor exemption, and future-dated suppression
    let resolvedFilePath = path.join(process.cwd(), 'content', entry.id);
    if (!fs.existsSync(resolvedFilePath) && fs.existsSync(`${resolvedFilePath}.md`)) {
      resolvedFilePath = `${resolvedFilePath}.md`;
    }

    const dates = resolveArticleDates(resolvedFilePath, {
      published: entry.data?.published,
      modified: entry.data?.modified,
      minor: entry.data?.minor,
    });

    // Section 6: Future-dated hiding (suppressed unless preview mode is active)
    if (dates.isFuture && !isPreviewMode()) {
      continue;
    }

    const publishedDate = dates.published;
    const modifiedDate = dates.modified;

    const url = getPath(`/${categorySlug}/${finalSlug}/`);

    // Extract tags from frontmatter or inline #tags (excluding markdown headings)
    const frontmatterTags = Array.isArray(entry.data?.tags) ? entry.data.tags : [];
    const inlineTagMatches = [...rawBody.matchAll(/(?:^|\s)#([a-zA-Z0-9_-]+)(?=\s|$)/g)].map((m) => m[1]);
    const tags = Array.from(new Set([...frontmatterTags, ...inlineTagMatches]));

    validArticles.push({
      id: entry.id,
      slug: finalSlug,
      category,
      categorySlug,
      title,
      description: entry.data?.description || '',
      publishedDate,
      modifiedDate,
      draft: entry.data?.draft === true,
      isScheduled: dates.isFuture,
      rawBody,
      url,
      cover: entry.data?.cover,
      tags,
      entry,
    });
  }

  return validArticles;
}

/**
 * Groups and sorts articles for the Home Page according to Section 7:
 * - Articles within category: OLDEST to NEWEST by published date
 * - Categories: OLDEST to NEWEST by the published date of the oldest article in each category
 */
export async function getGroupedCategories(): Promise<CategoryGroup[]> {
  const articles = await getArticles();
  const map = new Map<string, Article[]>();

  for (const article of articles) {
    const list = map.get(article.category) || [];
    list.push(article);
    map.set(article.category, list);
  }

  const groups: CategoryGroup[] = [];

  for (const [name, groupArticles] of map.entries()) {
    // Sort articles within category: oldest to newest
    groupArticles.sort((a, b) => a.publishedDate.getTime() - b.publishedDate.getTime());

    groups.push({
      name,
      slug: slugify(name),
      articles: groupArticles,
      oldestDate: groupArticles[0].publishedDate,
    });
  }

  // Sort categories: oldest to newest by oldest article in category
  groups.sort((a, b) => {
    const diff = a.oldestDate.getTime() - b.oldestDate.getTime();
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  return groups;
}
