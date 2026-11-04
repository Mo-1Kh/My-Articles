// scripts/validate-vault.mjs
// Build validation reporter per Section 12
// Checks for duplicate slugs (FATAL), broken wikilinks, missing images, oversized images, and missing descriptions (WARNINGS)

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const contentDir = path.join(process.cwd(), 'content');
const publicDir = path.join(process.cwd(), 'public');

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// 1. Collect all files in vault recursively
function collectFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

const allVaultFiles = collectFiles(contentDir);
const mdFiles = allVaultFiles.filter((f) => f.endsWith('.md'));
const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'];
const vaultImages = allVaultFiles.filter((f) =>
  imageExtensions.some((ext) => f.toLowerCase().endsWith(ext))
);

// Map of all available notes for wikilink resolution (by basename without .md, and lowercase)
const availableNotes = new Set(
  mdFiles.map((f) => path.basename(f, '.md').toLowerCase())
);

// Map of all available images (by basename and lowercase)
const availableImages = new Set([
  ...vaultImages.map((f) => path.basename(f).toLowerCase()),
  ...collectFiles(publicDir)
    .filter((f) => imageExtensions.some((ext) => f.toLowerCase().endsWith(ext)))
    .map((f) => path.basename(f).toLowerCase()),
]);

const fatalErrors = [];
const warnings = [];

// 2. Validate Slugs & Content
const slugMap = new Map();

for (const filePath of mdFiles) {
  const relPath = path.relative(contentDir, filePath);
  const parts = relPath.split(path.sep);

  // Check if inside attachment folder
  const lowerParts = parts.map((p) => p.toLowerCase());
  if (lowerParts.some((p) => ['attachments', 'images', 'assets', 'media'].includes(p))) {
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');

  // Simple frontmatter parser
  let data = {};
  let body = raw;
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fmMatch) {
    body = raw.slice(fmMatch[0].length);
    const lines = fmMatch[1].split('\n');
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (val === 'true') val = true;
        if (val === 'false') val = false;
        data[key] = val;
      }
    }
  }

  // Category resolution
  const category = parts.length > 1 ? parts[0] : 'uncategorized';
  const categorySlug = slugify(category);

  // Title resolution
  let title = data.title;
  if (!title) {
    const h1Match = body.match(/^#\s+(.+)$/m);
    if (h1Match) title = h1Match[1].trim();
  }
  if (!title) {
    title = path.basename(filePath, '.md');
  }

  // Final slug
  const finalSlug = slugify(data.slug || path.basename(filePath, '.md'));
  const canonicalRoute = `/${categorySlug}/${finalSlug}/`;

  // Check for duplicate slugs (FATAL)
  if (slugMap.has(canonicalRoute)) {
    fatalErrors.push({
      type: 'DUPLICATE_SLUG',
      message: `Duplicate URL route collision: "${canonicalRoute}" is produced by both:\n   - ${slugMap.get(canonicalRoute)}\n   - ${relPath}`,
      file: relPath,
    });
  } else {
    slugMap.set(canonicalRoute, relPath);
  }

  // Check missing description (WARNING)
  if (!data.description || String(data.description).trim() === '') {
    warnings.push({
      type: 'MISSING_DESCRIPTION',
      message: `No frontmatter description provided. Auto-excerpt fallback will be used in meta tags.`,
      file: relPath,
    });
  }

  // Check broken wikilinks [[target]] (excluding image embeds ![[...]]) (WARNING)
  const wikilinkMatches = [...body.matchAll(/(?<!\!)\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)];
  for (const match of wikilinkMatches) {
    const rawTarget = match[1].trim();
    if (!rawTarget) continue;
    const targetBase = path.basename(rawTarget, '.md').toLowerCase();
    if (!availableNotes.has(targetBase)) {
      warnings.push({
        type: 'BROKEN_WIKILINK',
        message: `Wikilink "[[${rawTarget}]]" does not match any markdown note in ./content`,
        file: relPath,
      });
    }
  }

  // Check missing images ![[image.png]] and ![alt](image.png) (WARNING)
  const obsidianImageMatches = [...body.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)];
  for (const match of obsidianImageMatches) {
    const imgName = match[1].trim().toLowerCase();
    if (!availableImages.has(imgName)) {
      warnings.push({
        type: 'MISSING_IMAGE',
        message: `Obsidian image "![[${match[1].trim()}]]" not found in ./content or ./public`,
        file: relPath,
      });
    }
  }

  const mdImageMatches = [...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)];
  for (const match of mdImageMatches) {
    const rawSrc = match[1].trim();
    if (rawSrc.startsWith('http://') || rawSrc.startsWith('https://')) continue;
    const imgName = path.basename(rawSrc).toLowerCase();
    if (!availableImages.has(imgName)) {
      warnings.push({
        type: 'MISSING_IMAGE',
        message: `Markdown image "![](${rawSrc})" not found in ./content or ./public`,
        file: relPath,
      });
    }
  }
}

// 3. Check for oversized images (> 500 KB) in ./content
for (const imgPath of vaultImages) {
  try {
    const stat = fs.statSync(imgPath);
    const sizeKB = stat.size / 1024;
    if (sizeKB > 500) {
      warnings.push({
        type: 'OVERSIZED_IMAGE',
        message: `Image is ${sizeKB.toFixed(1)} KB (exceeds recommended 500 KB threshold). Sharp will optimize it, but consider resizing source asset.`,
        file: path.relative(contentDir, imgPath),
      });
    }
  } catch (e) {
    // ignore
  }
}

// 4. Check for URL changes from git renames
try {
  const gitRenames = execSync('git log -M --diff-filter=R --summary -n 5', { encoding: 'utf-8' });
  const renameMatches = [...gitRenames.matchAll(/rename (.*?) => (.*)/g)];
  if (renameMatches.length > 0) {
    for (const match of renameMatches.slice(0, 3)) {
      warnings.push({
        type: 'FILE_RENAMED',
        message: `Git rename detected: "${match[1]}" => "${match[2]}". Ensure external links or redirects are updated.`,
        file: match[2].trim(),
      });
    }
  }
} catch (e) {
  // Not in a git repo or no commits yet, ignore
}

// 5. Output Report
console.log('=====================================================');
console.log('       VAULT BUILD VALIDATION REPORT');
console.log('=====================================================');
console.log(`Scanned ${mdFiles.length} markdown notes & ${vaultImages.length} images in ./content\n`);

if (fatalErrors.length === 0 && warnings.length === 0) {
  console.log('✨ All checks passed! No errors or warnings found.');
  console.log('=====================================================\n');
  process.exit(0);
}

if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} WARNING(S) FOUND (Non-blocking):`);
  for (const w of warnings) {
    console.log(`  • [${w.type}] ${w.file}`);
    console.log(`    ${w.message}`);
  }
  console.log('');
}

if (fatalErrors.length > 0) {
  console.log(`❌ ${fatalErrors.length} FATAL ERROR(S) FOUND (Build halted):`);
  for (const err of fatalErrors) {
    console.log(`  • [${err.type}] ${err.file}`);
    console.log(`    ${err.message}`);
  }
  console.log('\n=====================================================');
  process.exit(1);
}

console.log(`✓ 0 FATAL ERRORS (Build will proceed)`);
console.log('=====================================================\n');
process.exit(0);
