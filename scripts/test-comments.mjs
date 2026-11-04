// scripts/test-comments.mjs
// Automated verification test suite for Phase 9: Comments (Giscus)

import fs from 'node:fs';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASS: ${message}`);
}

console.log('=====================================================');
console.log('Running Phase 9 Comments (Giscus) Verification');
console.log('=====================================================\n');

// ----------------------------------------------------
// Test 1: Verify Custom Giscus Stylesheets
// ----------------------------------------------------
console.log('1. Checking Custom Giscus Stylesheets...');
const latteCssPath = path.join(process.cwd(), 'public', 'giscus-latte.css');
assert(fs.existsSync(latteCssPath), 'public/giscus-latte.css exists');
const latteCss = fs.readFileSync(latteCssPath, 'utf-8');
assert(latteCss.includes('#F1EFEA'), 'giscus-latte.css uses user requested light #F1EFEA');
assert(latteCss.includes('--color-canvas-default'), 'giscus-latte.css defines GitHub Primer CSS variables');
assert(latteCss.includes('.gsc-comment-box'), 'giscus-latte.css defines card container rules');

const espressoCssPath = path.join(process.cwd(), 'public', 'giscus-espresso.css');
assert(fs.existsSync(espressoCssPath), 'public/giscus-espresso.css exists');
const espressoCss = fs.readFileSync(espressoCssPath, 'utf-8');
assert(espressoCss.includes('#1B1D23'), 'giscus-espresso.css uses user requested dark #1B1D23');
assert(espressoCss.includes('--color-canvas-default'), 'giscus-espresso.css defines GitHub Primer CSS variables');
assert(espressoCss.includes('.gsc-comment-box'), 'giscus-espresso.css defines card container rules');

// ----------------------------------------------------
// Test 2: Verify Comments Component File
// ----------------------------------------------------
console.log('\n2. Checking Comments Component...');
const commentsCompPath = path.join(process.cwd(), 'src', 'components', 'Comments.astro');
assert(fs.existsSync(commentsCompPath), 'src/components/Comments.astro exists');
const commentsComp = fs.readFileSync(commentsCompPath, 'utf-8');
assert(commentsComp.includes('IntersectionObserver'), 'Comments component implements IntersectionObserver lazy loading');
assert(commentsComp.includes('postMessage'), 'Comments component implements postMessage theme synchronization');
assert(commentsComp.includes('theme-change'), 'Comments component listens to site theme-change events');

// ----------------------------------------------------
// Test 3: Verify Built HTML Pages
// ----------------------------------------------------
console.log('\n3. Checking Production Built Pages...');
const distDir = path.join(process.cwd(), 'dist');

// Home page must NOT have comments
const homeHtmlPath = path.join(distDir, 'index.html');
if (fs.existsSync(homeHtmlPath)) {
  const homeHtml = fs.readFileSync(homeHtmlPath, 'utf-8');
  assert(!homeHtml.includes('giscus-container'), 'Home page does not contain comments');
}

// 404 page must NOT have comments
const notFoundHtmlPath = path.join(distDir, '404.html');
if (fs.existsSync(notFoundHtmlPath)) {
  const notFoundHtml = fs.readFileSync(notFoundHtmlPath, 'utf-8');
  assert(!notFoundHtml.includes('giscus-container'), '404 page does not contain comments');
}

// Style guide must NOT have comments
const styleGuideHtmlPath = path.join(distDir, 'style-guide', 'index.html');
if (fs.existsSync(styleGuideHtmlPath)) {
  const styleGuideHtml = fs.readFileSync(styleGuideHtmlPath, 'utf-8');
  assert(!styleGuideHtml.includes('giscus-container'), 'Style guide does not contain comments');
}

// Article page comments follow site.config.ts
const siteConfigRaw = fs.readFileSync(path.join(process.cwd(), 'site.config.ts'), 'utf-8');
const isCommentsConfigured = /enabled:\s*true/.test(siteConfigRaw) && /repoId:\s*["']R_/.test(siteConfigRaw);

const articleHtmlPath = path.join(distDir, 'coffee', 'espresso-extraction', 'index.html');
if (fs.existsSync(articleHtmlPath)) {
  const articleHtml = fs.readFileSync(articleHtmlPath, 'utf-8');
  if (isCommentsConfigured) {
    assert(articleHtml.includes('giscus-container'), 'Article page cleanly mounts comments when enabled in site.config.ts');
  } else {
    assert(!articleHtml.includes('giscus-container'), 'Article page cleanly excludes comments when unconfigured/disabled');
  }
}

console.log('\n=====================================================');
console.log('ALL PHASE 9 COMMENTS (GISCUS) TESTS PASSED!');
console.log('=====================================================');
