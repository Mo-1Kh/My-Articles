// src/plugins/remark-obsidian.ts
// Handles Obsidian comments, highlights, wikilinks, tags, and image embeds in remark AST.
import { visit } from 'unist-util-visit';
import fs from 'node:fs';
import path from 'node:path';
import { slugify } from '../lib/slug.js';

interface WikiTarget {
  categorySlug: string;
  articleSlug: string;
  url: string;
}

// Build a fast lookup map of articles in ./content
function buildVaultMap(): Map<string, WikiTarget> {
  const map = new Map<string, WikiTarget>();
  const contentDir = path.resolve(process.cwd(), 'content');

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
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

        // Read frontmatter title or slug if available
        let titleSlug = fileSlug;
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const titleMatch = content.match(/^title:\s*["']?([^"'\r\n]+)["']?/m);
          if (titleMatch) {
            titleSlug = slugify(titleMatch[1]);
          }
        } catch {}

        const target: WikiTarget = {
          categorySlug,
          articleSlug: fileSlug,
          url: `/${categorySlug}/${fileSlug}/`,
        };

        // Index by filename, relative path, fileSlug, and title
        map.set(filename.toLowerCase(), target);
        map.set(rel.replace(/\.md$/, '').toLowerCase(), target);
        map.set(fileSlug.toLowerCase(), target);
        map.set(titleSlug.toLowerCase(), target);
      }
    }
  }

  scanDir(contentDir);
  return map;
}

export function remarkObsidian() {
  const vaultMap = buildVaultMap();

  return (tree: any) => {
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

    // 2. Process text nodes for ==highlights==, [[wikilinks]], ![[embeds]], and #tags
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
        // Wikilink: [[target#heading|alias]] or ![[image.png|300]]
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

          // 2a. Embed: ![[image.png|width]]
          if (matchedStr.startsWith('![[')) {
            const inner = match[2];
            const [target, width] = inner.split('|').map((s: string) => s.trim());
            newChildren.push({
              type: 'html',
              value: `<img src="${target.startsWith('/') ? target : `/${target}`}" alt="${target}" ${width ? `width="${width}" style="max-width: 100%; width: ${width}px;"` : 'style="max-width: 100%;"'} loading="lazy" />`,
            });
          }
          // 2b. Wikilink: [[target#heading|alias]]
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
              const displayText = alias || heading || target;
              const href = heading ? `${resolved.url}#${slugify(heading)}` : resolved.url;
              newChildren.push({
                type: 'html',
                value: `<a href="${href}" class="wikilink">${displayText}</a>`,
              });
            } else {
              // Broken wikilinks render as plain text per requirement
              const displayText = alias || heading || target;
              newChildren.push({
                type: 'html',
                value: `<span class="wikilink-broken">${displayText}</span>`,
              });
            }
          }
          // 2c. Highlight: ==text==
          else if (matchedStr.startsWith('==')) {
            const highlightText = match[3];
            newChildren.push({
              type: 'html',
              value: `<mark class="highlight">${highlightText}</mark>`,
            });
          }
          // 2d. Tag: #tag
          else if (matchedStr.startsWith('#')) {
            const tagName = match[4];
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
  };
}
