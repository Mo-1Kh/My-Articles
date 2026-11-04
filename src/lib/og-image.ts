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
    category = 'Article',
    siteName = "Mo's Articles",
    author = 'Mohamed',
  } = options;

  const escapedCategory = escapeXml(category.toUpperCase());
  const escapedSiteName = escapeXml(siteName);
  const escapedAuthor = escapeXml(author);

  const titleLines = wrapText(title, 30);
  const titleYStart = 270 - ((titleLines.length - 1) * 35);

  const titleSpans = titleLines
    .map((line, index) => {
      const y = titleYStart + (index * 70);
      return `<text x="100" y="${y}" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="54" font-weight="700" fill="#F3E4D3" letter-spacing="-0.02em">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient (Rich Dark Espresso with warm crema glow) -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1A0F06" />
      <stop offset="60%" stop-color="#211409" />
      <stop offset="100%" stop-color="#2E1C0F" />
    </linearGradient>

    <!-- Warm Coffee Radial Ambient Glow -->
    <radialGradient id="glow" cx="80%" cy="25%" r="65%">
      <stop offset="0%" stop-color="#CFAD85" stop-opacity="0.16" />
      <stop offset="50%" stop-color="#8B572A" stop-opacity="0.06" />
      <stop offset="100%" stop-color="#211409" stop-opacity="0" />
    </radialGradient>

    <!-- Subtle Grid Pattern -->
    <pattern id="coffeePattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1" fill="#CFAD85" fill-opacity="0.06" />
    </pattern>
  </defs>

  <!-- Background Rectangles -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <rect width="1200" height="630" fill="url(#coffeePattern)" />
  <rect width="1200" height="630" fill="url(#glow)" />

  <!-- Artisanal Outer Coffee Frame -->
  <rect x="40" y="40" width="1120" height="550" rx="16" fill="none" stroke="#442D1A" stroke-width="2" />
  <rect x="52" y="52" width="1096" height="526" rx="10" fill="none" stroke="#CFAD85" stroke-opacity="0.25" stroke-width="1" />

  <!-- Corner Coffee Accents -->
  <circle cx="52" cy="52" r="3" fill="#CFAD85" fill-opacity="0.8" />
  <circle cx="1148" cy="52" r="3" fill="#CFAD85" fill-opacity="0.8" />
  <circle cx="52" cy="578" r="3" fill="#CFAD85" fill-opacity="0.8" />
  <circle cx="1148" cy="578" r="3" fill="#CFAD85" fill-opacity="0.8" />

  <!-- Category Badge Pill -->
  <g transform="translate(100, 110)">
    <rect width="${Math.max(120, escapedCategory.length * 13 + 36)}" height="38" rx="8" fill="#321F13" stroke="#B8946C" stroke-width="1.5" />
    <text x="${(Math.max(120, escapedCategory.length * 13 + 36)) / 2}" y="24" font-family="'JetBrains Mono', Courier, monospace" font-size="15" font-weight="600" fill="#CFAD85" text-anchor="middle" letter-spacing="0.1em">${escapedCategory}</text>
  </g>

  <!-- Article Title (Multi-line) -->
  ${titleSpans}

  <!-- Footer Divider Line -->
  <line x1="100" y1="480" x2="1100" y2="480" stroke="#442D1A" stroke-width="1.5" />

  <!-- Footer Branding -->
  <g transform="translate(100, 520)">
    <!-- Coffee Cup Icon -->
    <path d="M0 6h18v10a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V6zm18 3h4a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-4V9zM-3 26h28" fill="none" stroke="#CFAD85" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    
    <!-- Site Name & Author -->
    <text x="36" y="17" font-family="Fraunces, Georgia, serif" font-size="22" font-weight="700" fill="#CFAD85">${escapedSiteName}</text>
    <text x="${36 + escapedSiteName.length * 13.5}" y="17" font-family="'Source Serif 4', Georgia, serif" font-size="20" fill="#BFA893"> &#8226; By ${escapedAuthor}</text>
  </g>

  <!-- Artisanal Watermark / Right Badge -->
  <g transform="translate(940, 515)">
    <text x="160" y="22" font-family="'JetBrains Mono', Courier, monospace" font-size="14" fill="#BFA893" text-anchor="end" letter-spacing="0.05em">ARTISANAL ESSAYS</text>
  </g>
</svg>
`.trim();

  return sharp(Buffer.from(svg))
    .png({ quality: 90, compressionLevel: 8 })
    .toBuffer();
}
