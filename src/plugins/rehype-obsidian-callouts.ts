// src/plugins/rehype-obsidian-callouts.ts
// Transforms Obsidian callout blockquotes into semantic, accessible callout containers.
import { visit } from 'unist-util-visit';

function getCalloutIcon(type: string): string {
  switch (type.toLowerCase()) {
    case 'tip':
    case 'hint':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`;
    case 'warning':
    case 'caution':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    case 'danger':
    case 'error':
    case 'failure':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    case 'note':
    case 'info':
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
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

      // Check for callout marker: [!type] or [!type]+ or [!type]- Title
      const match = firstTextChild.value.match(/^\[!([a-zA-Z0-9_-]+)\]([+-])?(?:\s+(.*))?/);
      if (!match) {
        return;
      }

      const calloutType = match[1].toLowerCase();
      const foldability = match[2]; // '+' or '-' or undefined
      const customTitle = match[3] ? match[3].trim() : '';
      const displayTitle = customTitle || (calloutType.charAt(0).toUpperCase() + calloutType.slice(1));
      const isFoldable = foldability === '+' || foldability === '-';
      const isFoldedByDefault = foldability === '-';

      // Remove the marker line from the first paragraph
      const remainingInFirstP = firstTextChild.value.slice(match[0].length).trim();
      const contentChildren = [...node.children];

      if (remainingInFirstP) {
        firstTextChild.value = remainingInFirstP;
      } else {
        // Remove first text node or entire paragraph if empty
        firstP.children.shift();
        if (firstP.children.length === 0) {
          contentChildren.splice(contentChildren.indexOf(firstP), 1);
        }
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
          children: [{ type: 'text', value: displayTitle }],
        },
      ];

      if (isFoldable) {
        titleChildren.push({
          type: 'element',
          tagName: 'span',
          properties: { className: ['callout-fold-indicator'] },
          children: [{
            type: 'raw',
            value: `<svg class="fold-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
          }],
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
