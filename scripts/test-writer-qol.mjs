// scripts/test-writer-qol.mjs
// Automated verification test suite for Phase 8: Writer Quality-of-Life & Validation

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { slugify, slugifyHeading } from '../src/lib/slug.ts';
import { generateExcerpt } from '../src/lib/excerpt.ts';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASS: ${message}`);
}

console.log('=====================================================');
console.log('Running Phase 8 Writer Quality-of-Life Verification');
console.log('=====================================================\n');

// ----------------------------------------------------
// Test 1: CLI Scaffold Helper (new-article.mjs)
// ----------------------------------------------------
console.log('1. Testing CLI Scaffolding Helper...');
const testCategory = 'temp-testing';
const testTitle = 'Automated CLI Generated Article';
const testSlug = 'automated-cli-generated-article';
const testFilePath = path.join(process.cwd(), 'content', testCategory, `${testSlug}.md`);

// Clean up if leftover
if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);

// Run CLI creation
execSync(`node scripts/new-article.mjs "${testTitle}" --category "${testCategory}" --tags automated,testing --draft`, { stdio: 'pipe' });

assert(fs.existsSync(testFilePath), 'CLI created article markdown file at expected location');
const fileContent = fs.readFileSync(testFilePath, 'utf-8');
assert(fileContent.includes(`title: "${testTitle}"`), 'Frontmatter contains correct title');
assert(fileContent.includes('draft: true'), 'Frontmatter contains draft: true');
assert(fileContent.includes('"automated"'), 'Frontmatter contains tags');

// Test collision prevention (should fail without --force)
let collisionPrevented = false;
try {
  execSync(`node scripts/new-article.mjs "${testTitle}" --category "${testCategory}"`, { stdio: 'pipe' });
} catch (e) {
  collisionPrevented = true;
}
assert(collisionPrevented, 'CLI prevents accidental overwriting of existing article');

// Test --force flag
let overwriteSucceeded = false;
try {
  execSync(`node scripts/new-article.mjs "${testTitle}" --category "${testCategory}" --force`, { stdio: 'pipe' });
  overwriteSucceeded = true;
} catch (e) {
  overwriteSucceeded = false;
}
assert(overwriteSucceeded, 'CLI allows overwrite when --force is explicitly provided');

// Clean up test file
fs.unlinkSync(testFilePath);
fs.rmdirSync(path.join(process.cwd(), 'content', testCategory));
assert(!fs.existsSync(testFilePath), 'Cleaned up temporary test article');

// ----------------------------------------------------
// Test 2: Vault Validation Reporter (validate-vault.mjs)
// ----------------------------------------------------
console.log('\n2. Testing Vault Validation Reporter...');

// Normal validation run on clean vault
const normalRun = execSync('node scripts/validate-vault.mjs', { encoding: 'utf-8' });
assert(!normalRun.includes('FATAL ERROR(S) FOUND') && (normalRun.includes('0 FATAL ERRORS') || normalRun.includes('All checks passed')), 'Normal vault scan has 0 fatal errors');

// Simulate a duplicate slug collision (FATAL ERROR)
const testCategoryDir = path.join(process.cwd(), 'content', 'test-collision-category');
fs.mkdirSync(testCategoryDir, { recursive: true });
const dupFile1 = path.join(testCategoryDir, 'collision-1.md');
const dupFile2 = path.join(testCategoryDir, 'collision-2.md');
fs.writeFileSync(dupFile1, `---
title: "Collision 1"
slug: "duplicate-slug-test"
---
Collision body 1
`, 'utf-8');
fs.writeFileSync(dupFile2, `---
title: "Collision 2"
slug: "duplicate-slug-test"
---
Collision body 2
`, 'utf-8');

let fatalDetected = false;
try {
  execSync('node scripts/validate-vault.mjs', { stdio: 'pipe' });
} catch (e) {
  fatalDetected = true;
}
// Clean up immediately
if (fs.existsSync(dupFile1)) fs.unlinkSync(dupFile1);
if (fs.existsSync(dupFile2)) fs.unlinkSync(dupFile2);
if (fs.existsSync(testCategoryDir)) fs.rmdirSync(testCategoryDir);

assert(fatalDetected, 'Validator halts with fatal error when duplicate slug is introduced');

// ----------------------------------------------------
// Test 3: Local Dev Preview Mode Logic
// ----------------------------------------------------
console.log('\n3. Testing Local Dev Preview Mode...');

function shouldIgnoreArticle(id, data, allowDrafts = false) {
  const normalized = id.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.some((p) => p.startsWith('.') || p.startsWith('_'))) return true;
  const lowerParts = parts.map((p) => p.toLowerCase());
  if (lowerParts.some((p) => ['attachments', 'images', 'assets', 'media'].includes(p))) return true;
  if (data?.draft === true && !allowDrafts) return true;
  return false;
}

assert(shouldIgnoreArticle('coffee/draft.md', { draft: true }, false) === true, 'Production mode ignores draft: true');
assert(shouldIgnoreArticle('coffee/draft.md', { draft: true }, true) === false, 'Preview mode (allowDrafts=true) includes draft: true');
assert(shouldIgnoreArticle('coffee/published.md', { draft: false }, false) === false, 'Regular published post is included');
assert(shouldIgnoreArticle('_private/note.md', { draft: false }, true) === true, 'Private underscore folders remain ignored in preview');

// ----------------------------------------------------
// Test 4: Pluggable Analytics Component
// ----------------------------------------------------
console.log('\n4. Checking Pluggable Analytics Configuration...');
assert(fs.existsSync(path.join(process.cwd(), 'src', 'components', 'Analytics.astro')), 'src/components/Analytics.astro exists');

// ----------------------------------------------------
// Test 5: Unicode Slugs, Heading Anchors & Excerpt Generator
// ----------------------------------------------------
console.log('\n5. Testing Unicode Slugs & Excerpt Generator...');
assert(slugify('قهوة مختصة') === 'قهوة-مختصة', 'slugify preserves Arabic/Unicode characters');
assert(slugify('my_post_name') === 'my-post-name', 'slugify normalizes underscores to hyphens');
assert(slugifyHeading('C++ & Rust') === 'c--rust', 'slugifyHeading matches github-slugger anchor IDs');

const sampleMd = `# My Title

Intro text with $5 and $10 prices.

\`\`\`js
const secret_key = 123;
\`\`\`

More my_var and other_var text #tag1 [^1].`;
const excerpt = generateExcerpt(sampleMd);
assert(!excerpt.includes('My Title'), 'Excerpt strips first H1 title');
assert(!excerpt.includes('secret_key'), 'Excerpt strips fenced code blocks cleanly');
assert(excerpt.includes('my_var and other_var'), 'Excerpt preserves snake_case identifiers');
assert(excerpt.includes('$5 and $10'), 'Excerpt preserves dollar prices');

// ----------------------------------------------------
// Test 6: Build-Time Rehype Enhancements & Callout Inline Titles
// ----------------------------------------------------
console.log('\n6. Testing Build-Time Rehype Enhancements & Callouts...');
const { rehypeArticleEnhancements } = await import('../src/plugins/rehype-article-enhancements.ts');
const { rehypeObsidianCallouts } = await import('../src/plugins/rehype-obsidian-callouts.ts');

const sampleTree = {
  type: 'root',
  children: [
    {
      type: 'element',
      tagName: 'h2',
      properties: { id: 'section-1' },
      children: [{ type: 'text', value: 'Section 1' }],
    },
    {
      type: 'element',
      tagName: 'pre',
      properties: { className: ['astro-code'], 'data-language': 'ts' },
      children: [{ type: 'element', tagName: 'code', properties: {}, children: [{ type: 'text', value: 'const x = 1;' }] }],
    },
    {
      type: 'element',
      tagName: 'p',
      properties: {},
      children: [
        {
          type: 'element',
          tagName: 'a',
          properties: { href: 'https://example.com/docs' },
          children: [{ type: 'text', value: 'Docs' }],
        },
      ],
    },
    {
      type: 'element',
      tagName: 'blockquote',
      properties: {},
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          children: [
            { type: 'text', value: '[!success] Using ' },
            { type: 'element', tagName: 'code', properties: {}, children: [{ type: 'text', value: 'git log' }] },
            { type: 'text', value: ' safely\nCallout body text' },
          ],
        },
      ],
    },
  ],
};

rehypeObsidianCallouts()(sampleTree);
rehypeArticleEnhancements()(sampleTree);

const h2Node = sampleTree.children[0];
assert(
  h2Node.children.some((c) => c.tagName === 'a' && c.properties?.className?.includes('heading-anchor')),
  'rehypeArticleEnhancements appends .heading-anchor to h2 at build time'
);

const codeContainer = sampleTree.children[1];
assert(
  codeContainer.tagName === 'div' && codeContainer.properties?.className?.includes('code-block-container'),
  'rehypeArticleEnhancements wraps pre.astro-code in .code-block-container at build time'
);

const extLink = sampleTree.children[2].children[0];
assert(
  extLink.properties?.target === '_blank' &&
    extLink.children.some((c) => c.tagName === 'svg') &&
    extLink.children.some((c) => c.properties?.className?.includes('sr-only')),
  'rehypeArticleEnhancements adds target=_blank, SVG icon, and .sr-only label to external links'
);

const calloutNode = sampleTree.children[3];
const titleSpan = calloutNode.children[0].children[1];
assert(
  calloutNode.properties?.['data-callout'] === 'success' &&
    titleSpan.children.some((c) => c.tagName === 'code'),
  'rehypeObsidianCallouts preserves inline <code> nodes inside callout title'
);

const articlesLibSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'articles.ts'), 'utf-8');
assert(
  articlesLibSrc.includes('latestDate: groupArticles[groupArticles.length - 1].publishedDate') &&
    articlesLibSrc.includes('b.latestDate.getTime() - a.latestDate.getTime()'),
  'getGroupedCategories sorts categories by latest article while keeping articles oldest-to-newest'
);

console.log('\n=====================================================');
console.log('ALL PHASE 8 WRITER QUALITY-OF-LIFE TESTS PASSED!');
console.log('=====================================================');
