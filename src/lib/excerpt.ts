// src/lib/excerpt.ts
// Generates clean, search-friendly ~155 character descriptions from markdown content

export function generateExcerpt(rawBody: string, maxLength: number = 155): string {
  if (!rawBody) return '';

  let text = rawBody;

  // 1. Strip YAML frontmatter if present
  text = text.replace(/^---[\s\S]*?---\s*/, '');

  // 2. Strip Obsidian comments %% ... %%
  text = text.replace(/%%[\s\S]*?%%/g, '');

  // 3. Strip KaTeX block math $$ ... $$ and inline math $ ... $
  text = text.replace(/\$\$[\s\S]*?\$\$/g, '');
  text = text.replace(/\$([^\$\n]+)\$/g, '$1');

  // 4. Strip Obsidian callout headers: > [!...]+ or > [!...]-
  text = text.replace(/^>\s*\[![^\]]+\][+-]?\s*.*$/gm, '');
  // Strip blockquote '>' prefixes
  text = text.replace(/^>\s*/gm, '');

  // 5. Strip Obsidian images ![[...]] and markdown images ![...] (...)
  text = text.replace(/!\[\[[^\]]*\]\]/g, '');
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 6. Replace wikilinks: [[note|alias]] -> alias, [[note]] -> note
  text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');

  // 7. Replace markdown links: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 8. Strip markdown headings (# Title)
  text = text.replace(/^#+\s+/gm, '');

  // 9. Strip bold, italic, strikethrough, highlights
  text = text.replace(/==([^=]+)==/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  text = text.replace(/~~([^~]+)~~/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');

  // 10. Strip code blocks ``` ... ```
  text = text.replace(/```[\s\S]*?```/g, '');

  // 11. Strip HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // 12. Strip list markers (- [x], - [ ], *, -, 1.)
  text = text.replace(/^(\s*[-*+]|\s*\d+\.)\s*(\[[ xX]\]\s*)?/gm, '');

  // 13. Normalize whitespace (collapse multiple newlines/spaces)
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  // Truncate at word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return `${truncated.substring(0, lastSpace)}...`;
  }
  return `${truncated}...`;
}
