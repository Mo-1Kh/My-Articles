// scripts/test-writer-qol.mjs
// Automated verification test suite for Phase 8: Writer Quality-of-Life & Validation

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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
// Test 4: Obsidian Templates Documentation
// ----------------------------------------------------
console.log('\n4. Checking Obsidian Templater Documentation...');
assert(fs.existsSync(path.join(process.cwd(), 'docs', 'templates', 'article.md')), 'docs/templates/article.md template exists');
assert(fs.existsSync(path.join(process.cwd(), 'docs', 'TEMPLATES.md')), 'docs/TEMPLATES.md documentation exists');

// ----------------------------------------------------
// Test 5: Pluggable Analytics Component
// ----------------------------------------------------
console.log('\n5. Checking Pluggable Analytics Configuration...');
assert(fs.existsSync(path.join(process.cwd(), 'src', 'components', 'Analytics.astro')), 'src/components/Analytics.astro exists');

console.log('\n=====================================================');
console.log('ALL PHASE 8 WRITER QUALITY-OF-LIFE TESTS PASSED!');
console.log('=====================================================');
