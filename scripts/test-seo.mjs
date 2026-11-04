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
assert(sitemapContent.includes('<loc>https://Mo-1Kh.github.io/My-Articles/</loc>'), 'sitemap has home URL');
assert(sitemapContent.includes('/coffee/espresso-extraction/'), 'sitemap has espresso article URL');
assert(sitemapContent.includes('<lastmod>'), 'sitemap has <lastmod> dates');
assert(!sitemapContent.includes('/style-guide/'), 'sitemap excludes /style-guide/');

// 2. Verify robots.txt
console.log('\n2. Checking robots.txt...');
const robotsPath = path.join(distDir, 'robots.txt');
assert(fs.existsSync(robotsPath), 'dist/robots.txt exists');
const robotsContent = fs.readFileSync(robotsPath, 'utf-8');
assert(robotsContent.includes('User-agent: *'), 'robots.txt allows all user agents');
assert(robotsContent.includes('Disallow: /style-guide/'), 'robots.txt disallows style-guide');
assert(robotsContent.includes('Sitemap: https://Mo-1Kh.github.io/My-Articles/sitemap.xml'), 'robots.txt points to sitemap');

// 3. Verify rss.xml
console.log('\n3. Checking rss.xml...');
const rssPath = path.join(distDir, 'rss.xml');
assert(fs.existsSync(rssPath), 'dist/rss.xml exists');
const rssContent = fs.readFileSync(rssPath, 'utf-8');
assert(rssContent.includes('<rss version="2.0"'), 'rss.xml is version 2.0');
assert(rssContent.includes('<channel>'), 'rss.xml has <channel>');
assert(rssContent.includes('<content:encoded>'), 'rss.xml has full <content:encoded>');
assert(rssContent.includes('<title>The Physics of Espresso Extraction</title>'), 'rss.xml contains espresso article');

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

// 6. Verify Article Page SEO (espresso-extraction)
console.log('\n6. Checking Article Page SEO (espresso-extraction)...');
const articlePath = path.join(distDir, 'coffee', 'espresso-extraction', 'index.html');
assert(fs.existsSync(articlePath), 'Article page HTML exists');
const articleHtml = fs.readFileSync(articlePath, 'utf-8');

assert(articleHtml.includes('<html lang="en"'), 'Article has <html lang="en">');
assert(articleHtml.includes('<meta name="viewport"'), 'Article has meta viewport');
assert(articleHtml.includes('<link rel="canonical" href="https://Mo-1Kh.github.io/My-Articles/coffee/espresso-extraction/"'), 'Article has canonical URL');
assert(articleHtml.includes('<meta property="og:type" content="article"'), 'Article has og:type="article"');
assert(articleHtml.includes('<meta property="og:image" content="https://Mo-1Kh.github.io/My-Articles/og/coffee/espresso-extraction.png"'), 'Article has auto-generated OG image');
assert(articleHtml.includes('<meta name="twitter:card" content="summary_large_image"'), 'Article has twitter:card summary_large_image');
assert(articleHtml.includes('<meta property="article:published_time"'), 'Article has article:published_time');
assert(articleHtml.includes('<meta property="article:section" content="Coffee"'), 'Article has article:section');
assert(articleHtml.includes('<meta property="article:tag" content="espresso"'), 'Article has article:tag');

// Validate JSON-LD
assert(articleHtml.includes('"@type": "BlogPosting"'), 'Article has BlogPosting JSON-LD');
assert(articleHtml.includes('"@type": "BreadcrumbList"'), 'Article has BreadcrumbList JSON-LD');
assert(articleHtml.includes('"headline": "The Physics of Espresso Extraction"'), 'BlogPosting has correct headline');

// 7. Verify OG Image Generation
console.log('\n7. Checking Generated OG Image Files...');
const ogImageEspresso = path.join(distDir, 'og', 'coffee', 'espresso-extraction.png');
assert(fs.existsSync(ogImageEspresso), 'og/coffee/espresso-extraction.png exists');
const ogStat = fs.statSync(ogImageEspresso);
assert(ogStat.size > 10000, `OG image has non-trivial size (${ogStat.size} bytes)`);

// 8. Verify Audit Fixes (Responsive AVIF/WebP Images, Canonicals, Hub Pages, Twitter @handle)
console.log('\n8. Checking Audit SEO & Image Pipeline Improvements...');
assert(
  notFoundContent.includes('<link rel="canonical" href="https://Mo-1Kh.github.io/My-Articles/404/"'),
  '404 page canonical has no double base path'
);
assert(
  articleHtml.includes('<meta name="twitter:creator" content="@Mo_1Khairy"'),
  'Article twitter:creator uses @handle'
);
assert(
  articleHtml.includes('<meta property="og:locale" content="en_US"'),
  'Article includes og:locale'
);
assert(
  articleHtml.includes('"@type": "ImageObject"'),
  'BlogPosting JSON-LD uses ImageObject'
);
assert(
  articleHtml.includes('"wordCount":'),
  'BlogPosting JSON-LD includes wordCount'
);
assert(
  articleHtml.includes('<source type="image/avif" srcset="'),
  'Article renders <picture> with responsive AVIF srcset'
);
assert(
  articleHtml.includes('alt="Thick golden crema on a freshly pulled double espresso shot"'),
  'Article renders descriptive Obsidian alt text'
);
assert(
  fs.existsSync(path.join(distDir, 'images', 'optimized', 'v60-dripper.webp')),
  'Optimized images are present in dist/images/optimized/'
);
assert(
  fs.existsSync(path.join(distDir, 'coffee', 'index.html')),
  'Category hub page /coffee/ exists'
);
assert(
  fs.existsSync(path.join(distDir, 'tags', 'coffee', 'index.html')),
  'Tag hub page /tags/coffee/ exists'
);
assert(
  !fs.existsSync(path.join(distDir, 'about', 'index.html')),
  'Author page /about/ does not exist (removed as requested)'
);
assert(
  sitemapContent.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'),
  'Sitemap includes Google Image Sitemap namespace and entries'
);

console.log('\n=====================================================');
console.log('ALL PHASE 7 SEO & DISCOVERABILITY CHECKS PASSED!');
console.log('=====================================================');
