// src/plugins/rehype-article-enhancements.ts
// Build-time rehype plugin that performs DOM enhancements previously done on the client:
// 1. Wraps Shiki <pre class="astro-code"> blocks in .code-block-container with language label & copy button
// 2. Appends .heading-anchor permalink links to <h2> and <h3> elements with an id
// 3. Adds target="_blank", rel="noopener noreferrer", external icon SVG, and .sr-only label to external links

import { visit } from 'unist-util-visit';
import { getSiteOrigin } from '../../site.config.ts';

function extractText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) {
    return node.children.map(extractText).join('');
  }
  return '';
}

function getClassList(node: any): string[] {
  const cls = node?.properties?.className ?? node?.properties?.class;
  if (Array.isArray(cls)) return cls.map(String);
  if (typeof cls === 'string') return cls.split(/\s+/).filter(Boolean);
  return [];
}

function createCopyIconSvg(): any {
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '14',
      height: '14',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    children: [
      {
        type: 'element',
        tagName: 'rect',
        properties: { x: '9', y: '9', width: '13', height: '13', rx: '2', ry: '2' },
        children: [],
      },
      {
        type: 'element',
        tagName: 'path',
        properties: { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' },
        children: [],
      },
    ],
  };
}

function createExternalLinkIconSvg(): any {
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      className: ['external-link-icon'],
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    children: [
      {
        type: 'element',
        tagName: 'path',
        properties: { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' },
        children: [],
      },
      {
        type: 'element',
        tagName: 'polyline',
        properties: { points: '15 3 21 3 21 9' },
        children: [],
      },
      {
        type: 'element',
        tagName: 'line',
        properties: { x1: '10', y1: '14', x2: '21', y2: '3' },
        children: [],
      },
    ],
  };
}

export function rehypeArticleEnhancements() {
  const siteOrigin = getSiteOrigin();
  let siteHost = '';
  try {
    siteHost = new URL(siteOrigin).host;
  } catch {
    siteHost = '';
  }

  return (tree: any) => {
    visit(tree, 'element', (node: any, index: number | undefined, parent: any) => {
      if (!node || typeof node !== 'object') return;

      // 1. Wrap Shiki <pre class="astro-code"> in .code-block-container
      if (node.tagName === 'pre' && parent && typeof index === 'number') {
        const classes = getClassList(node);
        const parentClasses = getClassList(parent);
        if (
          classes.includes('astro-code') &&
          !classes.includes('mermaid') &&
          !parentClasses.includes('code-block-container')
        ) {
          let lang = String(
            node.properties?.dataLanguage || node.properties?.['data-language'] || ''
          ).trim();
          if (!lang) {
            for (const cls of classes) {
              if (cls.startsWith('lang-') || cls.startsWith('language-')) {
                lang = cls.replace(/^(lang-|language-)/, '');
                break;
              }
            }
          }
          if (!lang) lang = 'code';

          const headerNode = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-block-header'] },
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['code-lang-label'] },
                children: [{ type: 'text', value: lang }],
              },
              {
                type: 'element',
                tagName: 'button',
                properties: {
                  type: 'button',
                  className: ['code-copy-btn'],
                  'aria-label': `Copy ${lang} code`,
                },
                children: [
                  createCopyIconSvg(),
                  {
                    type: 'element',
                    tagName: 'span',
                    properties: { className: ['copy-text'] },
                    children: [{ type: 'text', value: 'Copy' }],
                  },
                ],
              },
            ],
          };

          const containerNode = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-block-container'] },
            children: [headerNode, node],
          };

          parent.children[index] = containerNode;
          return;
        }
      }

      // 2. Append .heading-anchor to h2 and h3 with an id
      if (node.tagName === 'h2' || node.tagName === 'h3') {
        const id = node.properties?.id;
        if (id && Array.isArray(node.children)) {
          const hasAnchor = node.children.some(
            (child: any) =>
              child?.type === 'element' && getClassList(child).includes('heading-anchor')
          );
          if (!hasAnchor) {
            const headingText = extractText(node).trim();
            node.children.push({
              type: 'element',
              tagName: 'a',
              properties: {
                href: `#${id}`,
                className: ['heading-anchor'],
                'aria-label': `Permalink to section: ${headingText}`,
              },
              children: [
                {
                  type: 'element',
                  tagName: 'span',
                  properties: { 'aria-hidden': 'true' },
                  children: [{ type: 'text', value: '#' }],
                },
              ],
            });
          }
        }
        return;
      }

      // 3. Enhance external links with target="_blank", rel="noopener noreferrer", icon, and .sr-only text
      if (node.tagName === 'a' && node.properties?.href) {
        const href = String(node.properties.href);
        if (/^https?:\/\//i.test(href)) {
          try {
            const parsed = new URL(href);
            if (!siteHost || parsed.host !== siteHost) {
              node.properties.target = '_blank';
              node.properties.rel = 'noopener noreferrer';
              if (!Array.isArray(node.children)) {
                node.children = [];
              }
              const hasIcon = node.children.some(
                (child: any) =>
                  child?.type === 'element' && getClassList(child).includes('external-link-icon')
              );
              if (!hasIcon) {
                node.children.push(createExternalLinkIconSvg(), {
                  type: 'element',
                  tagName: 'span',
                  properties: { className: ['sr-only'] },
                  children: [{ type: 'text', value: ' (opens in a new tab)' }],
                });
              }
            }
          } catch {
            // Leave malformed URLs untouched
          }
        }
      }
    });
  };
}
