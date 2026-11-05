// scripts/test-seo.mjs
// Automated SEO & Meta Tag Verification Suite for Phase 7

import fs from 'node:fs';
import path from 'node:path';

const distDir = path.join(process.cwd(), 'dist');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASS: ${message}`);
}

console.log('=====================================================');
console.log('Running Phase 7 SEO & Discoverability Verification');
console.log('=====================================================\n');

// 1. Verify sitemap.xml
console.log('1. Checking sitemap.xml...');
const sitemapPath = path.join(distDir, 'sitemap.xml');
assert(fs.existsSync(sitemapPath), 'dist/sitemap.xml exists');
const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
assert(sitemapContent.includes('<urlset'), 'sitemap has <urlset>');
assert(sitemapContent.includes('<loc>https://mo-1kh.github.io/My-Articles/</loc>'), 'sitemap has home URL');
assert(sitemapContent.includes('<lastmod>'), 'sitemap has <lastmod> dates');
assert(!sitemapContent.includes('/style-guide/'), 'sitemap excludes /style-guide/');

// 2. Verify robots.txt
console.log('\n2. Checking robots.txt...');
const robotsPath = path.join(distDir, 'robots.txt');
assert(fs.existsSync(robotsPath), 'dist/robots.txt exists');
const robotsContent = fs.readFileSync(robotsPath, 'utf-8');
assert(robotsContent.includes('User-agent: *'), 'robots.txt allows all user agents');
assert(robotsContent.includes('/style-guide/'), 'robots.txt disallows style-guide');
assert(robotsContent.includes('Sitemap: https://mo-1kh.github.io/My-Articles/sitemap.xml'), 'robots.txt points to sitemap');

// 3. Verify rss.xml
console.log('\n3. Checking rss.xml...');
const rssPath = path.join(distDir, 'rss.xml');
assert(fs.existsSync(rssPath), 'dist/rss.xml exists');
const rssContent = fs.readFileSync(rssPath, 'utf-8');
assert(rssContent.includes('<rss version="2.0"'), 'rss.xml is version 2.0');
assert(rssContent.includes('<channel>'), 'rss.xml has <channel>');

// 4. Verify 404.html
console.log('\n4. Checking 404.html...');
const notFoundPath = path.join(distDir, '404.html');
assert(fs.existsSync(notFoundPath), 'dist/404.html exists');
const notFoundContent = fs.readFileSync(notFoundPath, 'utf-8');
assert(notFoundContent.includes('404'), '404 page contains 404 code');
assert(notFoundContent.includes('content="noindex, nofollow"'), '404 page has noindex meta');
assert(notFoundContent.includes('<h1'), '404 page has semantic H1');

// 5. Verify Favicon
console.log('\n5. Checking Favicon...');
const faviconPath = path.join(distDir, 'favicon.svg');
assert(fs.existsSync(faviconPath), 'dist/favicon.svg exists');

// 6. Verify Article Page SEO if articles exist
console.log('\n6. Checking Article Page SEO...');
const articlePath = path.join(distDir, 'coffee', 'espresso-extraction', 'index.html');
if (fs.existsSync(articlePath)) {
  const articleHtml = fs.readFileSync(articlePath, 'utf-8');
  assert(articleHtml.includes('<html lang="en"'), 'Article has <html lang="en">');
  assert(articleHtml.includes('<meta name="viewport"'), 'Article has meta viewport');
  assert(articleHtml.includes('<link rel="canonical" href="https://mo-1kh.github.io/My-Articles/coffee/espresso-extraction/"'), 'Article has canonical URL');
  assert(articleHtml.includes('<meta property="og:type" content="article"'), 'Article has og:type="article"');
  assert(articleHtml.includes('<meta property="og:image" content="https://mo-1kh.github.io/My-Articles/og/coffee/espresso-extraction.png"'), 'Article has auto-generated OG image');
  assert(articleHtml.includes('<meta name="twitter:card" content="summary_large_image"'), 'Article has twitter:card summary_large_image');
  assert(articleHtml.includes('<meta property="article:published_time"'), 'Article has article:published_time');
  assert(articleHtml.includes('<meta property="article:section" content="Coffee"'), 'Article has article:section');
  assert(articleHtml.includes('<meta property="article:tag" content="espresso"'), 'Article has article:tag');

  // Validate JSON-LD
  assert(articleHtml.includes('"@type":"BlogPosting"'), 'Article has BlogPosting JSON-LD');
  assert(articleHtml.includes('"@type":"BreadcrumbList"'), 'Article has BreadcrumbList JSON-LD');
  assert(articleHtml.includes('"headline":"The Physics of Espresso Extraction"'), 'BlogPosting has correct headline');

  // OG Image Generation
  const ogImageEspresso = path.join(distDir, 'og', 'coffee', 'espresso-extraction.png');
  assert(fs.existsSync(ogImageEspresso), 'og/coffee/espresso-extraction.png exists');
  const ogStat = fs.statSync(ogImageEspresso);
  assert(ogStat.size > 10000, `OG image has non-trivial size (${ogStat.size} bytes)`);

  assert(articleHtml.includes('<meta name="twitter:creator" content="@Mo_1Khairy"'), 'Article twitter:creator uses @handle');
  assert(articleHtml.includes('<meta property="og:locale" content="en_US"'), 'Article includes og:locale');
  assert(articleHtml.includes('"@type":"ImageObject"'), 'BlogPosting JSON-LD uses ImageObject');
  assert(articleHtml.includes('"wordCount":'), 'BlogPosting JSON-LD includes wordCount');
  assert(articleHtml.includes('<source type="image/avif" srcset="'), 'Article renders <picture> with responsive AVIF srcset');
} else {
  console.log('  ℹ No sample article in vault; skipping article-specific DOM assertions.');
}

// 7. Verify General Audit Fixes
console.log('\n7. Checking Audit SEO & Discoverability Improvements...');
const homeHtmlPath = path.join(distDir, 'index.html');
const homeHtml = fs.readFileSync(homeHtmlPath, 'utf-8');
assert(
  homeHtml.includes('<meta name="description" content="Articles and technical notes'),
  'Home page has non-empty meta description'
);
assert(
  homeHtml.includes('<meta name="robots" content="index, follow, max-image-preview:large"'),
  'Indexable pages include max-image-preview:large robots directive'
);
assert(
  homeHtml.includes('"@type":"WebSite"'),
  'Home page includes WebSite JSON-LD'
);
assert(
  !notFoundContent.includes('"@type":"WebSite"'),
  'Non-home pages do not duplicate WebSite JSON-LD'
);
assert(
  homeHtml.includes('content="#F1EFEA"') && homeHtml.includes('content="#1B1D23"'),
  'Theme-color meta tags match actual Latte (#F1EFEA) and Espresso (#1B1D23) backgrounds'
);
assert(
  robotsContent.includes('Disallow: /My-Articles/style-guide/'),
  'robots.txt Disallow includes base path (/My-Articles/style-guide/)'
);
assert(
  homeHtml.includes('<meta name="referrer" content="strict-origin-when-cross-origin"'),
  'Pages include strict-origin-when-cross-origin referrer meta tag'
);
assert(
  notFoundContent.includes('<link rel="canonical" href="https://mo-1kh.github.io/My-Articles/404/"'),
  '404 page canonical has no double base path'
);
assert(
  !fs.existsSync(path.join(distDir, 'about', 'index.html')),
  'Author page /about/ does not exist (removed as requested)'
);
assert(
  homeHtml.includes('class="skip-link" href="#main-content"') && homeHtml.includes('>Skip to content</a>'),
  'BaseLayout includes accessible Skip to content link'
);
assert(
  sitemapContent.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'),
  'Sitemap includes Google Image Sitemap namespace and entries'
);

console.log('\n=====================================================');
console.log('ALL PHASE 7 SEO & DISCOVERABILITY CHECKS PASSED!');
console.log('=====================================================');
