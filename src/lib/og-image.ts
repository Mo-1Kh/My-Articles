// src/lib/og-image.ts
// Generates 1200x630 coffee-themed Open Graph social share images using SVG & Sharp

import sharp from 'sharp';

interface OgImageOptions {
  title: string;
  category?: string;
  siteName?: string;
  author?: string;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine: number = 32): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 3); // Max 3 lines to fit comfortably
}

export async function generateOgImage(options: OgImageOptions): Promise<Buffer> {
  const {
    title,
    category,
    siteName = "Mo's Articles",
    author = 'Mohamed Khairy',
  } = options;

  const hasCategory = Boolean(category && category.trim().length > 0);
  const escapedCategory = hasCategory ? escapeXml(category!.trim().toUpperCase()) : '';
  const escapedSiteName = escapeXml(siteName);
  const escapedAuthor = escapeXml(author);

  const titleLines = wrapText(title, 30);
  const titleYStart = 270 - ((titleLines.length - 1) * 35);

  const titleSpans = titleLines
    .map((line, index) => {
      const y = titleYStart + (index * 70);
      return `<text x="100" y="${y}" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="54" font-weight="700" fill="#E6EDF3" letter-spacing="-0.02em">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient (Deep midnight slate #1B1D23) -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14161A" />
      <stop offset="60%" stop-color="#1B1D23" />
      <stop offset="100%" stop-color="#23262E" />
    </linearGradient>

    <!-- Warm Radiant Ambient Glow (Smooth monotonic decay without dark middle spot) -->
    <radialGradient id="glow" cx="80%" cy="25%" r="60%">
      <stop offset="0%" stop-color="#E2B170" stop-opacity="0.18" />
      <stop offset="40%" stop-color="#E2B170" stop-opacity="0.08" />
      <stop offset="70%" stop-color="#E2B170" stop-opacity="0.02" />
      <stop offset="100%" stop-color="#E2B170" stop-opacity="0" />
    </radialGradient>

    <!-- Subtle Grid Pattern -->
    <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1" fill="#E2B170" fill-opacity="0.06" />
    </pattern>
  </defs>

  <!-- Background Rectangles -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <rect width="1200" height="630" fill="url(#gridPattern)" />
  <rect width="1200" height="630" fill="url(#glow)" />

  <!-- Outer Frame -->
  <rect x="40" y="40" width="1120" height="550" rx="16" fill="none" stroke="#313540" stroke-width="2" />
  <rect x="52" y="52" width="1096" height="526" rx="10" fill="none" stroke="#E2B170" stroke-opacity="0.25" stroke-width="1" />

  <!-- Corner Accents -->
  <circle cx="52" cy="52" r="3" fill="#E2B170" fill-opacity="0.8" />
  <circle cx="1148" cy="52" r="3" fill="#E2B170" fill-opacity="0.8" />
  <circle cx="52" cy="578" r="3" fill="#E2B170" fill-opacity="0.8" />
  <circle cx="1148" cy="578" r="3" fill="#E2B170" fill-opacity="0.8" />

  ${
    hasCategory
      ? `<!-- Category Badge Pill -->
  <g transform="translate(100, 110)">
    <rect width="${Math.max(140, escapedCategory.length * 11.5 + 44)}" height="40" rx="8" fill="#23262E" stroke="#E2B170" stroke-width="1.5" />
    <text x="${(Math.max(140, escapedCategory.length * 11.5 + 44)) / 2}" y="25" font-family="'JetBrains Mono', Courier, monospace" font-size="14" font-weight="600" fill="#E2B170" text-anchor="middle" letter-spacing="0.1em">${escapedCategory}</text>
  </g>`
      : ''
  }

  <!-- Article Title (Multi-line) -->
  ${titleSpans}

  <!-- Footer Divider Line -->
  <line x1="100" y1="480" x2="1100" y2="480" stroke="#313540" stroke-width="1.5" />

  <!-- Footer Left: Coffee Icon with Steam + Site Name -->
  <g transform="translate(100, 520)">
    <!-- Steam Trails -->
    <path d="M4 -2c-0.8 1.2 0.8 2 0 3.2 M9 -3c-0.8 1.4 0.8 2.2 0 3.6 M14 -2c-0.8 1.2 0.8 2 0 3.2" fill="none" stroke="#E2B170" stroke-width="1.5" stroke-linecap="round" opacity="0.85" />
    <!-- Cup Body -->
    <path d="M0 4h16v6a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V4z" fill="none" stroke="#E2B170" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Cup Handle -->
    <path d="M16 6h3a2.5 2.5 0 0 1 2.5 2.5v0a2.5 2.5 0 0 1-2.5 2.5H16" fill="none" stroke="#E2B170" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Saucer / Base -->
    <line x1="-2" y1="19" x2="23" y2="19" stroke="#E2B170" stroke-width="2" stroke-linecap="round" />
    
    <!-- Site Name (Vertically Centered with Icon) -->
    <text x="40" y="16" font-family="Fraunces, Georgia, serif" font-size="22" font-weight="700" fill="#E2B170">${escapedSiteName}</text>
  </g>

  <!-- Footer Right: Author Name -->
  <g transform="translate(1100, 520)">
    <text x="0" y="16" font-family="'Source Serif 4', Georgia, serif" font-size="20" font-weight="500" fill="#9DA7B3" text-anchor="end">By ${escapedAuthor}</text>
  </g>
</svg>
`.trim();

  return sharp(Buffer.from(svg))
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toBuffer();
}
