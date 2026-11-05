// src/lib/excerpt.ts
// Generates clean, search-friendly ~155 character descriptions from markdown content

export function generateExcerpt(rawBody: string, maxLength: number = 155): string {
  if (!rawBody) return '';

  let text = rawBody;

  // 1. Strip YAML frontmatter if present
  text = text.replace(/^---[\s\S]*?---\s*/, '');

  // 2. Strip Obsidian comments %% ... %%
  text = text.replace(/%%[\s\S]*?%%/g, '');

  // 3. Strip fenced code blocks FIRST (before inline code so triple backticks aren't broken)
  text = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');

  // 4. Drop the first H1 heading so the excerpt doesn't repeat the article title
  text = text.replace(/^#\s+.+$/m, '');

  // 5. Strip KaTeX block math $$ ... $$, \[ ... \], \( ... \), and non-price inline math $ ... $
  text = text.replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\)/g, '');
  text = text.replace(/(?<![\\\w])\$[^\s$][^$\n]*?\$(?!\d)/g, '');

  // 6. Strip Obsidian callout headers: > [!...]+ or > [!...]- and blockquote '>' prefixes
  text = text.replace(/^>\s*\[![^\]]+\][+-]?\s*.*$/gm, '');
  text = text.replace(/^>\s*/gm, '');

  // 7. Strip Obsidian images ![[...]] and markdown images ![...](...)
  text = text.replace(/!\[\[[^\]]*\]\]/g, '');
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 8. Replace wikilinks: [[note#heading|alias]] -> alias, [[note#heading]] -> heading/note
  text = text.replace(/\[\[([^[\]]+)\]\]/g, (_m, inner: string) => {
    if (inner.includes('|')) {
      return inner.split('|')[1].trim();
    }
    if (inner.includes('#')) {
      const parts = inner.split('#');
      return (parts[1] || parts[0]).trim();
    }
    return inner.trim();
  });

  // 9. Replace markdown links: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 10. Strip footnote definitions, inline footnote markers, tables, horizontal rules, and inline #tags
  text = text.replace(/^\[\^[^\]]+\]:.*$/gm, '');
  text = text.replace(/\[\^[^\]]+\]/g, '');
  text = text.replace(/^\|.*\|$/gm, '');
  text = text.replace(/^(?:[-*_]\s*){3,}$/gm, '');
  text = text.replace(/(?<=\s|^)#[\p{L}\p{N}_/-]+(?=\s|$|[.,;:!?])/gu, '');

  // 11. Strip remaining markdown heading markers (## Heading -> Heading)
  text = text.replace(/^#+\s+/gm, '');

  // 12. Strip bold, italic, strikethrough, highlights, and inline code (word-bounded so snake_case is preserved)
  text = text.replace(/`([^`\n]+)`/g, '$1');
  text = text.replace(/==([^=]+)==/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/(?<!\w)__([^_]+)__(?!\w)/g, '$1');
  text = text.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '$1');
  text = text.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '$1');
  text = text.replace(/~~([^~]+)~~/g, '$1');

  // 13. Strip HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // 14. Strip list markers (- [x], - [ ], *, -, 1.)
  text = text.replace(/^(\s*[-*+]|\s*\d+\.)\s*(\[[ xX]\]\s*)?/gm, '');

  // 15. Normalize whitespace (collapse multiple newlines/spaces)
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  // Truncate at word boundary with proper ellipsis character
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return `${truncated.substring(0, lastSpace)}…`;
  }
  return `${truncated}…`;
}
