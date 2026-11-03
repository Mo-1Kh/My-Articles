// src/lib/reading-time.ts
// Calculates reading time based on 200 words per minute.

export function countWords(text: string): number {
  if (!text) return 0;
  let cleanText = text.replace(/^---[\s\S]*?---/, '');
  cleanText = cleanText.replace(/```[\s\S]*?```/g, '');
  cleanText = cleanText.replace(/<[^>]+>/g, '');
  cleanText = cleanText.replace(/%%[\s\S]*?%%/g, '');
  return cleanText.trim().split(/\s+/).filter(Boolean).length;
}

export function calculateReadingTime(text: string): string {
  const words = countWords(text);
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}
