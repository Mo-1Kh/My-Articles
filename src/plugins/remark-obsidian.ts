// src/plugins/remark-obsidian.ts
// Handles Obsidian comments, highlights, wikilinks, tags, and responsive AVIF/WebP image embeds in remark AST.
import { visit } from 'unist-util-visit';
import fs from 'node:fs';
import path from 'node:path';
import { getPath } from '../../site.config.js';
import { slugify } from '../lib/slug.js';
import { scanAndOptimizeImages, resolveImage, type OptimizedImageInfo } from '../lib/images.js';

interface WikiTarget {
  categorySlug: string;
  articleSlug: string;
  url: string;
}

function isPreviewMode(): boolean {
  if (typeof process === 'undefined') return false;
  return (
    process.env.PREVIEW === 'true' ||
    process.env.SHOW_DRAFTS === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function humanizeFilename(filename: string): string {
  return path
    .parse(filename)
    .name.replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderResponsiveFigure(
  imgInfo: OptimizedImageInfo,
  options: {
    explicitWidth?: number | null;
    customAlt?: string | null;
    isFirstImage: boolean;
  }
): string {
  const { explicitWidth, customAlt, isFirstImage } = options;
  const renderWidth = explicitWidth || imgInfo.width;
  const renderHeight = Math.round(renderWidth * (imgInfo.height / imgInfo.width));

  const rawAlt = customAlt && customAlt.trim() !== '' ? customAlt.trim() : humanizeFilename(imgInfo.filename);
  const safeAlt = escapeHtml(rawAlt);
  const hasExplicitCaption = Boolean(customAlt && customAlt.trim() !== '' && customAlt.trim() !== imgInfo.filename);

  const loadingAttr = isFirstImage ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const sizesAttr = explicitWidth
    ? `${explicitWidth}px`
    : '(min-width: 760px) 720px, calc(100vw - 2rem)';

  const styleParts: string[] = [];
  if (imgInfo.placeholder) {
    styleParts.push(`background: url(${imgInfo.placeholder}) center/cover no-repeat`);
  }
  const styleAttr = styleParts.length > 0 ? ` style="${styleParts.join('; ')}"` : '';
  const dataFullAttr = imgInfo.fullAvifUrl ? ` data-full="${escapeHtml(imgInfo.fullAvifUrl)}"` : '';

  const avifVariants = imgInfo.variants?.avif || [];
  const webpVariants = imgInfo.variants?.webp || [];

  let mediaMarkup = '';
  if (avifVariants.length > 0 && webpVariants.length > 0) {
    const avifSrcset = avifVariants.map((v) => `${v.src} ${v.w}w`).join(', ');
    const webpSrcset = webpVariants.map((v) => `${v.src} ${v.w}w`).join(', ');
    mediaMarkup = `<picture><source type="image/avif" srcset="${avifSrcset}" sizes="${sizesAttr}" /><img src="${imgInfo.optimizedUrl}" srcset="${webpSrcset}" sizes="${sizesAttr}" alt="${safeAlt}" width="${renderWidth}" height="${renderHeight}" ${loadingAttr} decoding="async" class="zoomable-image"${styleAttr}${dataFullAttr} /></picture>`;
  } else {
    mediaMarkup = `<img src="${imgInfo.optimizedUrl}" alt="${safeAlt}" width="${renderWidth}" height="${renderHeight}" ${loadingAttr} decoding="async" class="zoomable-image"${styleAttr}${dataFullAttr} />`;
  }

  const captionMarkup = hasExplicitCaption ? `<figcaption>${safeAlt}</figcaption>` : '';
  return `<figure class="article-image-figure">${mediaMarkup}${captionMarkup}</figure>`;
}

// Build a fast lookup map of articles in ./content
function buildVaultMap(): Map<string, WikiTarget> {
  const map = new Map<string, WikiTarget>();
  const contentDir = path.resolve(process.cwd(), 'content');
  const allowDrafts = isPreviewMode();
  const now = new Date();

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
      if (['attachments', 'images', 'assets', 'media'].includes(entry.name.toLowerCase())) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const rel = path.relative(contentDir, fullPath).replace(/\\/g, '/');
        const parts = rel.split('/');
        const category = parts.length > 1 ? parts[0] : 'Uncategorized';
        const categorySlug = slugify(category);
        const filename = entry.name.replace(/\.md$/, '');
        const fileSlug = slugify(filename);

        let articleSlug = fileSlug;
        let titleSlug = fileSlug;

        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (fmMatch) {
            const fmBlock = fmMatch[1];
            if (!allowDrafts && /^draft:\s*true\s*$/m.test(fmBlock)) {
              continue;
            }
            const pubMatch = fmBlock.match(/^(?:published|publishDate):\s*["']?([^"'\r\n]+)["']?/m);
            if (!allowDrafts && pubMatch) {
              const pubDate = new Date(pubMatch[1].trim());
              if (!isNaN(pubDate.getTime()) && pubDate.getTime() > now.getTime()) {
                continue;
              }
            }
            const slugMatch = fmBlock.match(/^slug:\s*["']?([^"'\r\n]+)["']?/m);
            if (slugMatch && slugMatch[1].trim()) {
              articleSlug = slugify(slugMatch[1].trim());
            }
            const titleMatch = fmBlock.match(/^title:\s*["']?([^"'\r\n]+)["']?/m);
            if (titleMatch && titleMatch[1].trim()) {
              titleSlug = slugify(titleMatch[1].trim());
            }
          }
        } catch {}

        const target: WikiTarget = {
          categorySlug,
          articleSlug,
          url: getPath(`/${categorySlug}/${articleSlug}/`),
        };

        // Index by filename, relative path, fileSlug, articleSlug, and titleSlug
        map.set(filename.toLowerCase(), target);
        map.set(rel.replace(/\.md$/, '').toLowerCase(), target);
        map.set(fileSlug.toLowerCase(), target);
        map.set(articleSlug.toLowerCase(), target);
        map.set(titleSlug.toLowerCase(), target);
      }
    }
  }

  scanDir(contentDir);
  return map;
}

export function remarkObsidian() {
  let vaultMap = buildVaultMap();

  return async (tree: any) => {
    if (process.env.NODE_ENV === 'development') {
      vaultMap = buildVaultMap();
    }
    await scanAndOptimizeImages();
    let imageCounter = 0;

    // 1. First pass: strip Obsidian %% comments %% across all text nodes
    visit(tree, 'text', (node: any) => {
      if (node.value && node.value.includes('%%')) {
        node.value = node.value.replace(/%%[\s\S]*?%%/g, '');
      }
    });

    // 2. Intercept mermaid code blocks before Shiki syntax highlighter touches them
    visit(tree, 'code', (node: any, index: any, parent: any) => {
      if (node.lang === 'mermaid' && parent && typeof index === 'number') {
        parent.children[index] = {
          type: 'html',
          value: `<pre class="mermaid">${node.value}</pre>`,
        };
      }
    });

    // 3. Process text nodes for ==highlights==, [[wikilinks]], ![[embeds]], and #tags
    visit(tree, 'paragraph', (paragraphNode: any) => {
      const newChildren: any[] = [];

      for (const child of paragraphNode.children) {
        if (child.type !== 'text') {
          newChildren.push(child);
          continue;
        }

        const text = child.value;
        if (!text) continue;

        // Regular expressions for Obsidian syntax
        // Wikilink: [[target#heading|alias]] or ![[image.png|alt|300]]
        // Highlight: ==text==
        // Tag: #tag (preceded by whitespace/start and followed by whitespace/punctuation)
        const combinedRegex = /(!?\[\[([^[\]]+)\]\]|==([^=]+)==|(?<=\s|^)#([a-zA-Z0-9_\/-]+)(?=\s|$|[.,;:!?]))/g;

        let lastIndex = 0;
        let match;

        while ((match = combinedRegex.exec(text)) !== null) {
          const matchStart = match.index;
          const matchEnd = matchStart + match[0].length;

          // Push preceding plain text
          if (matchStart > lastIndex) {
            newChildren.push({
              type: 'text',
              value: text.slice(lastIndex, matchStart),
            });
          }

          const matchedStr = match[0];

          // 3a. Embed: ![[image.png|alt text|350]] or ![[image.png|350]]
          if (matchedStr.startsWith('![[')) {
            const inner = match[2];
            const segments = inner.split('|').map((s: string) => s.trim()).filter(Boolean);
            const target = segments[0];
            let explicitWidth: number | null = null;
            let customAlt: string | null = null;

            for (const seg of segments.slice(1)) {
              if (/^\d+(?:x\d+)?$/.test(seg)) {
                explicitWidth = parseInt(seg.split('x')[0], 10);
              } else {
                customAlt = seg;
              }
            }

            const imgInfo = resolveImage(target);

            if (imgInfo) {
              const isFirstImage = imageCounter === 0;
              imageCounter++;
              newChildren.push({
                type: 'html',
                value: renderResponsiveFigure(imgInfo, {
                  explicitWidth,
                  customAlt,
                  isFirstImage,
                }),
              });
            } else {
              newChildren.push({
                type: 'html',
                value: `<div class="missing-image-alert" role="alert"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Missing image: <code>${escapeHtml(target)}</code></div>`,
              });
            }
          }
          // 3b. Wikilink: [[target#heading|alias]]
          else if (matchedStr.startsWith('[[')) {
            const inner = match[2];
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

            const cleanTargetKey = target.toLowerCase();
            const resolved = vaultMap.get(cleanTargetKey);

            if (resolved) {
              const displayText = escapeHtml(alias || heading || target);
              const href = heading ? `${resolved.url}#${slugify(heading)}` : resolved.url;
              newChildren.push({
                type: 'html',
                value: `<a href="${href}" class="wikilink">${displayText}</a>`,
              });
            } else {
              const displayText = escapeHtml(alias || heading || target);
              newChildren.push({
                type: 'html',
                value: `<span class="wikilink-broken">${displayText}</span>`,
              });
            }
          }
          // 3c. Highlight: ==text==
          else if (matchedStr.startsWith('==')) {
            const highlightText = escapeHtml(match[3]);
            newChildren.push({
              type: 'html',
              value: `<mark class="highlight">${highlightText}</mark>`,
            });
          }
          // 3d. Tag: #tag
          else if (matchedStr.startsWith('#')) {
            const tagName = escapeHtml(match[4]);
            newChildren.push({
              type: 'html',
              value: `<span class="tag">#${tagName}</span>`,
            });
          }

          lastIndex = matchEnd;
        }

        // Push any remaining text
        if (lastIndex < text.length) {
          newChildren.push({
            type: 'text',
            value: text.slice(lastIndex),
          });
        }
      }

      paragraphNode.children = newChildren;
    });

    // 4. Process standard markdown images ![alt](url)
    visit(tree, 'image', (node: any, index: any, parent: any) => {
      const cleanUrl = decodeURIComponent(node.url);
      const imgInfo = resolveImage(cleanUrl);

      if (imgInfo && parent && typeof index === 'number') {
        const isFirstImage = imageCounter === 0;
        imageCounter++;
        parent.children[index] = {
          type: 'html',
          value: renderResponsiveFigure(imgInfo, {
            explicitWidth: null,
            customAlt: node.alt || null,
            isFirstImage,
          }),
        };
      } else if (!imgInfo && parent && typeof index === 'number') {
        parent.children[index] = {
          type: 'html',
          value: `<div class="missing-image-alert" role="alert"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Missing image: <code>${escapeHtml(node.url)}</code></div>`,
        };
      }
    });
  };
}
