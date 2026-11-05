#!/usr/bin/env node
// scripts/new-article.mjs
// CLI scaffold helper to create new articles per Section 12

import fs from 'node:fs';
import path from 'node:path';
import { slugify } from '../src/lib/slug.ts';

function parseArgs(args) {
  const options = {
    title: '',
    category: 'writing',
    tags: [],
    draft: false,
    force: false,
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--category' || arg === '-c') {
      options.category = args[++i] || 'writing';
    } else if (arg === '--tags' || arg === '-t') {
      const rawTags = args[++i] || '';
      options.tags = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
    } else if (arg === '--draft' || arg === '-d') {
      options.draft = true;
    } else if (arg === '--force' || arg === '-f') {
      options.force = true;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    options.title = positional.join(' ');
  }

  return options;
}

const args = process.argv.slice(2);
const options = parseArgs(args);

if (!options.title) {
  console.log(`
Usage:
  pnpm run new "Article Title" [options]

Options:
  --category, -c <name>   Category folder name (default: "writing")
  --tags, -t <tag1,tag2>  Comma-separated tags (e.g. coffee,brewing)
  --draft, -d             Create article as draft (draft: true)
  --force, -f             Overwrite existing file if present

Examples:
  pnpm run new "Dialing Espresso Ratios" --category coffee --tags espresso,technique
  pnpm run new "The Quiet Power of Routine" --draft
`);
  process.exit(1);
}

const categoryFolder = slugify(options.category);
const articleSlug = slugify(options.title);
const targetDir = path.join(process.cwd(), 'content', categoryFolder);
const targetFile = path.join(targetDir, `${articleSlug}.md`);

// Check if file exists
if (fs.existsSync(targetFile) && !options.force) {
  console.error(`\n❌ Error: File already exists at: ${path.relative(process.cwd(), targetFile)}`);
  console.error(`Pass --force to overwrite.\n`);
  process.exit(1);
}

// Ensure directory exists
fs.mkdirSync(targetDir, { recursive: true });

const today = new Date().toISOString().split('T')[0];
const tagsFormatted = options.tags.length > 0
  ? `[${options.tags.map((t) => `"${t}"`).join(', ')}]`
  : '[]';

const template = `---
title: "${options.title.replace(/"/g, '\\"')}"
description: ""
published: "${today}"
tags: ${tagsFormatted}
draft: ${options.draft}
---

Write your article here...
`;

fs.writeFileSync(targetFile, template, 'utf-8');

console.log(`
☕ Created new article successfully!
--------------------------------------------------
File:     content/${categoryFolder}/${articleSlug}.md
Title:    ${options.title}
Category: ${options.category}
Draft:    ${options.draft ? 'true (hidden in production build)' : 'false'}
Published Date: ${today}
--------------------------------------------------
Open this file in Obsidian or your favorite editor to begin writing.
`);
