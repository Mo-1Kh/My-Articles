// src/lib/reading-time.ts
// Estimates reading time and word count based on 225 WPM (Section 10)

export interface ReadingStats {
  text: string;
  wordCount: number;
  minutes: number;
}

export function getReadingStats(rawMarkdown: string): ReadingStats {
  if (!rawMarkdown) {
    return { text: '1 min read', wordCount: 0, minutes: 1 };
  }

  let clean = rawMarkdown
    // Strip frontmatter if present
    .replace(/^---[\s\S]*?---/, '')
    // Strip Obsidian comments %% ... %%
    .replace(/%%[\s\S]*?%%/g, '')
    // Strip code block delimiters
    .replace(/```[\s\S]*?```/g, (match) => {
      // Count words inside code blocks at half weight or normal weight
      return match.replace(/```\w*\n?/g, '');
    })
    // Strip HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Strip image embeds ![[...]] and ![...](...)
    .replace(/!\[\[[^\]]+\]\]/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    // Replace wikilinks [[target|alias]] with alias or target
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');

  const words = clean
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const minutes = Math.max(1, Math.ceil(words / 225));
  return {
    text: `${minutes} min read`,
    wordCount: words,
    minutes,
  };
}

export function calculateReadingTime(rawMarkdown: string): string {
  return getReadingStats(rawMarkdown).text;
}
