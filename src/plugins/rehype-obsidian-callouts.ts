// src/plugins/rehype-obsidian-callouts.ts
// Transforms Obsidian callout blockquotes into semantic, accessible callout containers.
import { visit } from 'unist-util-visit';

function getCalloutIcon(type: string): string {
  const attrs = `xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"`;
  switch (type.toLowerCase()) {
    case 'tip':
    case 'hint':
    case 'important':
      return `<svg ${attrs}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`;
    case 'success':
    case 'check':
    case 'done':
      return `<svg ${attrs}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    case 'question':
    case 'help':
    case 'faq':
      return `<svg ${attrs}><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    case 'warning':
    case 'caution':
    case 'attention':
      return `<svg ${attrs}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    case 'danger':
    case 'error':
    case 'failure':
    case 'fail':
    case 'missing':
      return `<svg ${attrs}><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    case 'bug':
      return `<svg ${attrs}><rect width="8" height="14" x="8" y="6" rx="4"></rect><path d="m19 7-3 2"></path><path d="m5 7 3 2"></path><path d="m19 19-3-2"></path><path d="m5 19 3-2"></path><path d="M20 13h-4"></path><path d="M4 13h4"></path><path d="m10 4 1 2"></path><path d="m14 4-1 2"></path></svg>`;
    case 'example':
    case 'abstract':
    case 'summary':
    case 'tldr':
      return `<svg ${attrs}><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
    case 'quote':
    case 'cite':
      return `<svg ${attrs}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path></svg>`;
    case 'todo':
      return `<svg ${attrs}><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>`;
    case 'note':
    case 'info':
    default:
      return `<svg ${attrs}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }
}

export function rehypeObsidianCallouts() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.tagName !== 'blockquote' || !node.children || node.children.length === 0) {
        return;
      }

      // Filter out whitespace text nodes
      const elements = node.children.filter((c: any) => c.type === 'element');
      if (elements.length === 0 || elements[0].tagName !== 'p') {
        return;
      }

      const firstP = elements[0];
      if (!firstP.children || firstP.children.length === 0) {
        return;
      }

      const firstTextChild = firstP.children[0];
      if (firstTextChild.type !== 'text' || !firstTextChild.value) {
        return;
      }

      // Check for callout marker at the start of the first text node: [!type] or [!type]+ or [!type]-
      const markerMatch = firstTextChild.value.match(/^\[!([a-zA-Z0-9_-]+)\]([+-])?[ \t]*/);
      if (!markerMatch) {
        return;
      }

      const calloutType = markerMatch[1].toLowerCase();
      const foldability = markerMatch[2]; // '+' or '-' or undefined
      const isFoldable = foldability === '+' || foldability === '-';
      const isFoldedByDefault = foldability === '-';

      // Strip the [!type][+-] prefix from the first text node
      firstTextChild.value = firstTextChild.value.slice(markerMatch[0].length);

      // Collect all inline nodes on the first line (up to the first '\n' or <br>) as the callout title
      const customTitleNodes: any[] = [];
      const remainingFirstPChildren: any[] = [];
      let foundNewline = false;

      for (const child of firstP.children) {
        if (foundNewline) {
          remainingFirstPChildren.push(child);
          continue;
        }

        if (child.type === 'text') {
          const nlIdx = child.value.indexOf('\n');
          if (nlIdx !== -1) {
            const before = child.value.slice(0, nlIdx);
            const after = child.value.slice(nlIdx + 1);
            if (before) {
              customTitleNodes.push({ type: 'text', value: before });
            }
            if (after) {
              remainingFirstPChildren.push({ type: 'text', value: after });
            }
            foundNewline = true;
          } else {
            if (child.value) {
              customTitleNodes.push(child);
            }
          }
        } else if (child.type === 'element' && child.tagName === 'br') {
          foundNewline = true;
        } else {
          customTitleNodes.push(child);
        }
      }

      // Trim leading/trailing whitespace on customTitleNodes text edges
      if (customTitleNodes.length > 0 && customTitleNodes[0].type === 'text') {
        customTitleNodes[0].value = customTitleNodes[0].value.replace(/^\s+/, '');
        if (!customTitleNodes[0].value) customTitleNodes.shift();
      }
      if (
        customTitleNodes.length > 0 &&
        customTitleNodes[customTitleNodes.length - 1].type === 'text'
      ) {
        const last = customTitleNodes[customTitleNodes.length - 1];
        last.value = last.value.replace(/\s+$/, '');
        if (!last.value) customTitleNodes.pop();
      }

      const defaultTitle = calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
      const finalTitleNodes =
        customTitleNodes.length > 0 ? customTitleNodes : [{ type: 'text', value: defaultTitle }];

      const contentChildren = [...node.children];
      if (remainingFirstPChildren.length > 0) {
        firstP.children = remainingFirstPChildren;
      } else {
        contentChildren.splice(contentChildren.indexOf(firstP), 1);
      }

      const iconSvg = getCalloutIcon(calloutType);

      // Create title node
      const titleChildren: any[] = [
        {
          type: 'element',
          tagName: 'span',
          properties: { className: ['callout-icon'] },
          children: [{ type: 'raw', value: iconSvg }],
        },
        {
          type: 'element',
          tagName: 'span',
          properties: { className: ['callout-title-text'] },
          children: finalTitleNodes,
        },
      ];

      if (isFoldable) {
        titleChildren.push({
          type: 'element',
          tagName: 'span',
          properties: { className: ['callout-fold-indicator'] },
          children: [
            {
              type: 'raw',
              value: `<svg class="fold-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
            },
          ],
        });
      }

      const titleElement = {
        type: 'element',
        tagName: isFoldable ? 'summary' : 'div',
        properties: { className: ['callout-title'] },
        children: titleChildren,
      };

      const contentElement = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['callout-content'] },
        children: contentChildren,
      };

      // Mutate blockquote into div or details
      node.tagName = isFoldable ? 'details' : 'div';
      node.properties = {
        ...node.properties,
        className: ['callout', `callout-${calloutType}`],
        'data-callout': calloutType,
      };

      if (isFoldable && !isFoldedByDefault) {
        node.properties.open = true;
      }

      node.children = [titleElement, contentElement];
    });
  };
}
