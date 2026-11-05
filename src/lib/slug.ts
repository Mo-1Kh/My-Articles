// src/lib/slug.ts
// Pure Unicode-aware slugification helpers with zero Astro dependencies.

export function slugify(text: string): string {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Matches github-slugger (used by Astro for markdown heading IDs)
 * so [[Note#Heading]] anchors match generated <h2 id="..."> attributes.
 */
export function slugifyHeading(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, '')
    .replace(/\s/g, '-');
}
