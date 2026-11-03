// src/lib/reading-time.ts
// Calculates reading time based on 200 words per minute.

export function calculateReadingTime(text: string): string {
  if (!text) return '1 min read';

  // Strip frontmatter
  let cleanText = text.replace(/^---[\s\S]*?---/, '');

  // Strip code blocks
  cleanText = cleanText.replace(/```[\s\S]*?```/g, '');

  // Strip HTML tags
  cleanText = cleanText.replace(/<[^>]+>/g, '');

  // Strip Obsidian comments
  cleanText = cleanText.replace(/%%[\s\S]*?%%/g, '');

  // Count words
  const words = cleanText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));

  return `${minutes} min read`;
}
