// scripts/test-git-dates.mjs
// Automated verification suite for Section 6 Git Dates
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveArticleDates, clearDateCache } from '../src/lib/git-dates.ts';

function toDayString(date) {
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
}

function run() {
  console.log('=====================================================');
  console.log('Running Section 6 Git Dates Automated Verification');
  console.log('=====================================================\n');

  // Create an isolated temporary git repository
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-dates-test-'));
  const contentDir = path.join(tempDir, 'content');
  fs.mkdirSync(contentDir, { recursive: true });

  const git = (cmd) => {
    return execSync(cmd, {
      cwd: tempDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test Author',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test Committer',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  };

  try {
    // 0. Initialize git repository
    git('git init');
    git('git config user.name "Test Author"');
    git('git config user.email "test@example.com"');

    const testFileRel = 'content/test-article.md';
    const testFileAbs = path.join(tempDir, testFileRel);

    // ------------------------------------------------------------------
    // SCENARIO 1: First publish (no Modified)
    // ------------------------------------------------------------------
    console.log('Testing Scenario 1: First publish (no Modified)...');
    fs.writeFileSync(
      testFileAbs,
      `---
title: "Testing Git Dates"
---
Initial content of the article.`
    );
    git('git add content/test-article.md');
    git('git commit --date="2026-01-01T10:00:00Z" -m "Initial publish"');

    clearDateCache();
    const s1 = resolveArticleDates(testFileRel, {}, tempDir);
    const s1Pub = toDayString(s1.published);
    const s1Mod = toDayString(s1.modified);

    console.log(`  Published: ${s1Pub} (expected 2026-01-01)`);
    console.log(`  Modified:  ${s1Mod} (expected undefined)`);
    if (s1Pub === '2026-01-01' && s1Mod === undefined) {
      console.log('  -> PASS Scenario 1\n');
    } else {
      throw new Error(`Scenario 1 failed: published=${s1Pub}, modified=${s1Mod}`);
    }

    // ------------------------------------------------------------------
    // SCENARIO 2: After an edit on a later calendar day (Modified appears)
    // ------------------------------------------------------------------
    console.log('Testing Scenario 2: After an edit (Modified appears)...');
    fs.appendFileSync(testFileAbs, '\nAdded second section on Day 3.');
    git('git add content/test-article.md');
    git('git commit --date="2026-01-03T14:30:00Z" -m "Second edit"');

    clearDateCache();
    const s2 = resolveArticleDates(testFileRel, {}, tempDir);
    const s2Pub = toDayString(s2.published);
    const s2Mod = toDayString(s2.modified);

    console.log(`  Published: ${s2Pub} (expected 2026-01-01)`);
    console.log(`  Modified:  ${s2Mod} (expected 2026-01-03)`);
    if (s2Pub === '2026-01-01' && s2Mod === '2026-01-03') {
      console.log('  -> PASS Scenario 2\n');
    } else {
      throw new Error(`Scenario 2 failed: published=${s2Pub}, modified=${s2Mod}`);
    }

    // ------------------------------------------------------------------
    // SCENARIO 3: After another edit (Modified updates)
    // ------------------------------------------------------------------
    console.log('Testing Scenario 3: After another edit (Modified updates)...');
    fs.appendFileSync(testFileAbs, '\nAdded third section on Day 5.');
    git('git add content/test-article.md');
    git('git commit --date="2026-01-05T18:00:00Z" -m "Third edit"');

    clearDateCache();
    const s3 = resolveArticleDates(testFileRel, {}, tempDir);
    const s3Pub = toDayString(s3.published);
    const s3Mod = toDayString(s3.modified);

    console.log(`  Published: ${s3Pub} (expected 2026-01-01)`);
    console.log(`  Modified:  ${s3Mod} (expected 2026-01-05)`);
    if (s3Pub === '2026-01-01' && s3Mod === '2026-01-05') {
      console.log('  -> PASS Scenario 3\n');
    } else {
      throw new Error(`Scenario 3 failed: published=${s3Pub}, modified=${s3Mod}`);
    }

    // ------------------------------------------------------------------
    // SCENARIO 4: Minor edit (no update)
    // ------------------------------------------------------------------
    console.log('Testing Scenario 4: Minor edit (no update)...');
    fs.writeFileSync(
      testFileAbs,
      `---
title: "Testing Git Dates"
minor: true
---
Initial content with typo fixed on Day 8.`
    );
    git('git add content/test-article.md');
    git('git commit --date="2026-01-08T12:00:00Z" -m "Minor typo correction"');

    clearDateCache();
    const s4 = resolveArticleDates(testFileRel, { minor: true }, tempDir);
    const s4Pub = toDayString(s4.published);
    const s4Mod = toDayString(s4.modified);

    console.log(`  Published: ${s4Pub} (expected 2026-01-01)`);
    console.log(`  Modified:  ${s4Mod} (expected 2026-01-05, Day 8 ignored)`);
    if (s4Pub === '2026-01-01' && s4Mod === '2026-01-05') {
      console.log('  -> PASS Scenario 4\n');
    } else {
      throw new Error(`Scenario 4 failed: published=${s4Pub}, modified=${s4Mod}`);
    }

    // ------------------------------------------------------------------
    // SCENARIO 5: Renamed file (publish date kept)
    // ------------------------------------------------------------------
    console.log('Testing Scenario 5: Renamed file (publish date kept)...');
    const renamedRel = 'content/renamed-test-article.md';
    git(`git mv ${testFileRel} ${renamedRel}`);
    git('git commit --date="2026-01-12T09:00:00Z" -m "Rename article"');

    clearDateCache();
    const s5 = resolveArticleDates(renamedRel, {}, tempDir);
    const s5Pub = toDayString(s5.published);
    const s5Mod = toDayString(s5.modified);

    console.log(`  Published: ${s5Pub} (expected 2026-01-01, original preserved)`);
    console.log(`  Modified:  ${s5Mod} (expected 2026-01-12 or 2026-01-05)`);
    if (s5Pub === '2026-01-01') {
      console.log('  -> PASS Scenario 5\n');
    } else {
      throw new Error(`Scenario 5 failed: published=${s5Pub}, modified=${s5Mod}`);
    }

    // ------------------------------------------------------------------
    // BONUS: Future-dated article
    // ------------------------------------------------------------------
    console.log('Testing Bonus: Future-dated article suppression...');
    const futureDate = new Date(Date.now() + 86400000 * 30);
    const futureResult = resolveArticleDates(renamedRel, { published: futureDate }, tempDir);
    if (futureResult.isFuture === true) {
      console.log('  -> PASS Future-dated suppression\n');
    } else {
      throw new Error('Future dated suppression failed');
    }

    // ------------------------------------------------------------------
    // BONUS: Frontmatter override
    // ------------------------------------------------------------------
    console.log('Testing Bonus: Frontmatter override...');
    const overrideResult = resolveArticleDates(
      renamedRel,
      { published: '2023-05-15', modified: '2023-08-20' },
      tempDir
    );
    if (
      toDayString(overrideResult.published) === '2023-05-15' &&
      toDayString(overrideResult.modified) === '2023-08-20'
    ) {
      console.log('  -> PASS Frontmatter override\n');
    } else {
      throw new Error('Frontmatter override failed');
    }

    console.log('=====================================================');
    console.log('ALL 5 PHASE 3 SCENARIOS PASSED WITH ZERO FAILURES');
    console.log('=====================================================');
  } finally {
    // Cleanup temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

run();
