# Mo's Articles ☕

> An artisanal, hyper-fast, static-only personal blog crafted with **Astro 5**, **TypeScript**, **vanilla CSS**, self-hosted typography, and a native **Obsidian markdown vault**.

Designed for deep reading, zero client-side bloat, and a seamless writer workflow directly from Obsidian or your favorite markdown editor.

---

## Highlights & Features

- **Obsidian Vault First-Class Citizen**: Write in `./content/` using standard markdown or Obsidian conventions. Category subfolders become URL paths automatically.
- **Obsidian Rich Syntax**: Full support for `[[WikiLinks]]`, `[[WikiLinks|Custom Labels]]`, Obsidian Callouts (`[!note]`, `[!tip]`, `[!warning]`, etc.), KaTeX math (`$E=mc^2$`), Mermaid diagrams, and footnote popovers/anchors.
- **Git-Derived Publication & Modification Dates**: Never manually maintain timestamps again. Dates are pulled from actual `git log --follow` history:
  - **Published Date**: Extracted from the very first commit of the file.
  - **Modified Date**: Extracted from the latest commit, displayed only if on a different calendar day.
  - **Minor Edit Exclusion**: Commits with `minor: true` in frontmatter or commit message do not bump the updated date.
- **Artisanal Coffee Palette**:
  - **Latte (Light)**: Base `#CFAD85`
  - **Espresso (Dark)**: Base `#211409`
  - Instant zero-FOUC theme toggle with auto-detection for `prefers-color-scheme`.
  - Shiki syntax highlighting driven by custom CSS variables matching the palette.
- **Typography & Assets**:
  - Self-hosted local fonts via `@fontsource`: **Fraunces** (display/titles), **Source Serif 4** (body prose), and **JetBrains Mono** (code).
  - Responsive images with lazy loading, captions, and zoom lightbox.
  - Dynamic social card (Open Graph) generation via Sharp (`/og/[category]/[slug].png`).
- **Reader Quality of Life**:
  - Subtle reading progress bar.
  - Estimated reading time and word count.
  - Floating back-to-top button.
  - Sticky table of contents with active section highlighting.
  - Interactive footnote popovers.
  - Keyboard navigation: `h` (home), `t` (theme toggle), `k` or `/` (search/TOC), `Esc` (dismiss).
- **Writer Quality of Life**:
  - CLI scaffolding tool: `pnpm run new "Article Title" --category coffee --tags guide,espresso`.
  - Obsidian Templater template ready to use in `docs/templates/article.md`.
  - Vault validation linter: `pnpm run validate` (detects broken links, missing images, uncommitted files, slug collisions).
  - Draft mode (`draft: true`) with local preview in `pnpm run dev`.
  - Future-dated scheduled articles automatically published via daily GitHub Actions cron.
- **Giscus Comments**:
  - GitHub Discussions-backed comments with zero analytics or tracking.
  - Lazy-loaded via `IntersectionObserver` when scrolled into view.
  - Seamless theme synchronization (`giscus-latte.css` and `giscus-espresso.css`).
  - Disabled by default out of the box; easily activated via `site.config.ts`.
- **Static & SEO Optimized**:
  - Semantic HTML5, Schema.org `BlogPosting` and `BreadcrumbList` JSON-LD.
  - Valid RSS 2.0 feed (`/rss.xml`) with full article contents.
  - Automated `sitemap.xml` with last-modified timestamps and `robots.txt`.
  - Custom branded 404 page.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Architecture](#project-architecture)
3. [Configuration](#configuration)
4. [Obsidian Vault Workflow](#obsidian-vault-workflow)
5. [Git Dates System](#git-dates-system)
6. [Writer Tooling](#writer-tooling)
7. [Theming & Typography](#theming--typography)
8. [Comments Setup](#comments-setup)
9. [Deployment (GitHub Pages)](#deployment-github-pages)
10. [Test & Validation Suites](#test--validation-suites)
11. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Quick Start

### Prerequisites
- **Node.js**: v22.x or later
- **pnpm**: v11.x (`corepack enable pnpm` or `npm install -g pnpm@latest`)
- **Git**: Installed and initialized in your repository

### Installation
```bash
# Clone the repository (remember fetch-depth 0 if cloning elsewhere)
git clone https://github.com/your-username/my-articles.git
cd my-articles

# Install dependencies
pnpm install
```

### Local Development
```bash
# Start Astro local development server (includes drafts and scheduled posts)
pnpm run dev
```
Open [http://localhost:4321](http://localhost:4321) in your browser.

### Building for Production
```bash
# Validates TypeScript, checks vault integrity, and compiles static HTML to dist/
pnpm run build

# Preview the production build locally
pnpm run preview
```

---

## Project Architecture

```
.
├── .github/workflows/deploy.yml   # GitHub Pages automated deployment workflow
├── content/                       # Obsidian Markdown Vault
│   ├── _private/                  # Ignored from build (notes, scratchpads)
│   ├── attachments/               # Shared images and figures
│   ├── coffee/                    # Category folder (mapped to /coffee/[slug])
│   │   ├── espresso-extraction.md
│   │   └── v60-guide.md
│   ├── life/                      # Category folder
│   └── tech/                      # Category folder
├── docs/                          # Documentation & Obsidian templates
│   ├── COMMENTS.md                # Giscus comments setup guide
│   ├── TEMPLATES.md               # Obsidian Templater integration guide
│   └── templates/article.md       # Obsidian article starter template
├── public/                        # Static assets (fonts, icons, Giscus styles)
│   ├── fonts/                     # Self-hosted WOFF2 font files
│   ├── favicon.svg                # Coffee bean SVG favicon
│   ├── giscus-latte.css           # Custom latte light theme for Giscus
│   ├── giscus-espresso.css        # Custom espresso dark theme for Giscus
│   └── robots.txt                 # Search engine directives
├── scripts/                       # CLI helpers and automated test suites
│   ├── new-article.mjs            # CLI article generator (`pnpm run new`)
│   ├── validate-vault.mjs         # Vault linter and checker (`pnpm run validate`)
│   ├── test-git-dates.mjs         # Phase 3 git dates verification
│   ├── test-seo.mjs               # Phase 7 SEO & meta verification
│   ├── test-writer-qol.mjs        # Phase 8 writer tools verification
│   └── test-comments.mjs          # Phase 9 comments verification
├── src/
│   ├── components/                # Astro UI components (zero client JS bloat)
│   │   ├── Analytics.astro        # Pluggable privacy-focused analytics
│   │   ├── BackToTop.astro        # Floating return button
│   │   ├── Callout.astro          # Obsidian callout renderer
│   │   ├── Comments.astro         # Lazy-loaded Giscus container
│   │   ├── Header.astro           # Nav bar and theme switch
│   │   ├── Lightbox.astro         # Image lightbox zoom
│   │   ├── ReadingProgress.astro  # Top progress bar
│   │   ├── TableOfContents.astro  # Sticky section observer
│   │   └── ThemeScript.astro      # Inline head script to prevent FOUC
│   ├── layouts/
│   │   ├── BaseLayout.astro       # Root HTML document wrapper
│   │   └── ArticleLayout.astro    # Full article template with meta & schema
│   ├── pages/
│   │   ├── 404.astro              # Custom 404 page
│   │   ├── index.astro            # Home page with category filters & search
│   │   ├── rss.xml.ts             # Full-content RSS 2.0 feed generator
│   │   ├── sitemap.xml.ts         # Dynamic sitemap with <lastmod>
│   │   ├── style-guide.astro      # Living typography & component showcase
│   │   ├── [category]/[slug].astro# Article renderer
│   │   └── og/[category]/[slug].png.ts # Dynamic Sharp OpenGraph cards
│   ├── styles/
│   │   └── global.css             # Vanilla CSS design tokens & coffee palette
│   └── utils/
│       ├── git-dates.ts           # Pure Git history parser & cache
│       ├── markdown.ts            # WikiLinks & callout preprocessors
│       └── reading-time.ts        # Reading duration estimator
├── astro.config.mjs               # Astro configuration (Markdown, Shiki, Vite)
├── site.config.ts                 # Central site metadata and feature flags
├── tsconfig.json                  # TypeScript configuration
└── package.json
```

---

## Configuration

Site metadata and feature toggles are centralized in `site.config.ts`:

```typescript
export const siteConfig = {
  // Production site URL (no trailing slash)
  siteUrl: "https://your-username.github.io",
  base: "/my-articles", // Set to "" if deploying to root custom domain

  title: "Mo's Articles",
  description: "An artisanal, thoughtful personal blog exploring craft, technology, and coffee.",
  author: "Mohamed",

  // Comments (Giscus via GitHub Discussions)
  comments: {
    enabled: false, // Set to true once configured
    repo: "your-username/my-articles",
    repoId: "R_xxxxxxxxxx",
    category: "Announcements",
    categoryId: "DIC_xxxxxxxxxx",
    mapping: "pathname",
    reactionsEnabled: true,
  },

  // Pluggable analytics (optional)
  analytics: {
    provider: "none", // 'plausible' | 'umami' | 'cloudflare' | 'none'
    domain: "",
  },
};
```

---

## Obsidian Vault Workflow

The blog engine is designed to sit directly on top of an Obsidian vault located in `./content`. You can point Obsidian to open `./content` directly as a vault.

### Category Folders
Top-level folders under `./content/` map directly to article categories and URL routes:
- `content/coffee/espresso-extraction.md` → `/coffee/espresso-extraction/`
- `content/tech/git-dates.md` → `/tech/git-dates/`
- `content/life/daily-routine.md` → `/life/daily-routine/`

Any folder starting with an underscore (like `content/_private/` or `content/_drafts/`) is completely ignored by the build engine.

### Frontmatter Fields
All frontmatter fields are optional:

```yaml
---
title: "Understanding Espresso Extraction"   # If omitted, inferred from first # H1 or filename
description: "A deep dive into grind size, water temperature, and flow rate."
tags: ["coffee", "espresso", "craft"]
draft: false                                 # Set to true to exclude from production builds
date: 2026-01-15                             # Optional manual override for published date
modified: 2026-01-20                         # Optional manual override for modified date
cover: "./attachments/espresso-crema.png"    # Featured image
comments: true                               # Set to false to disable comments for this specific article
---
```

### Supported Obsidian Markdown Syntaxes
- **Internal WikiLinks**:
  - `[[v60-guide]]` → Links directly to the matching article.
  - `[[v60-guide|Pour Over Handbook]]` → Links with custom text.
- **Embedded Images**:
  - `![[v60-dripper.png]]` or standard markdown `![Pour over dripper](./attachments/v60-dripper.png)`.
  - Supports image captions via standard markdown italics underneath the image.
- **Callouts**:
  ```markdown
  > [!tip] Fresh Beans Matter
  > Always rest freshly roasted specialty coffee 7-14 days before brewing.
  ```
  Supported types: `[!note]`, `[!tip]`, `[!important]`, `[!warning]`, `[!caution]`, `[!danger]`, `[!quote]`, `[!todo]`.
- **Math**: Inline `$c = \pm\sqrt{a^2 + b^2}$` or display `$$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$$` rendered via KaTeX.
- **Footnotes**: `Here is a statement.[^1]` and `[^1]: Footnote details.` with hover previews and back-links.

---

## Git Dates System

Instead of tedious manual timestamps in frontmatter, publication and modification dates are determined through Git history (`git log --follow`):

1. **Published Date**: The timestamp of the **first commit** that introduced the markdown file.
2. **Modified Date**: The timestamp of the **most recent commit** modifying the markdown file.
3. **Calendar Day Logic**: The updated date is only displayed if it falls on a **different calendar day** than the publication date.
4. **Minor Edits Exclusion**: If a commit message includes `minor: true` (or `[minor]` / `minor:`), or the commit has a frontmatter marker, the update is considered minor and does **not** change the displayed modified date.
5. **Local Uncommitted Fallback**: During local development on uncommitted new files, the system falls back to filesystem timestamps with a subtle dev indicator.

> [!IMPORTANT]
> Because Git history is used to compute dates, your CI/CD runner must perform a full clone (`fetch-depth: 0`). Shallow clones will cause all articles to show the deployment commit date.

---

## Writer Tooling

### CLI Article Generator
Create new articles with standard frontmatter in one command:
```bash
pnpm run new "My Next Article" --category tech --tags guide,typescript
```

### Obsidian Templater Integration
If using Obsidian's community plugin **Templater**, copy `docs/templates/article.md` into your Obsidian templates folder. See `docs/TEMPLATES.md` for complete setup instructions.

### Vault Integrity Validation
Run the linter to verify link health, image attachments, and slug collisions before committing:
```bash
pnpm run validate
```
This script checks:
- WikiLink targets exist.
- Image attachments referenced in markdown exist on disk.
- Slug collisions across category folders.
- Warns if new articles have not yet been committed to Git.

---

## Theming & Typography

### Coffee Palette
The design uses an artisanal, warm palette configured via CSS custom properties:
- **Latte (Light Mode)**: Primary background `#CFAD85`, warm cream surfaces, roasted-coffee text.
- **Espresso (Dark Mode)**: Primary background `#211409`, rich dark roast surfaces, warm latte text.

### Zero-FOUC Theme Switcher
The theme toggle is situated in the header. To prevent flash-of-unformatted-content (FOUC), `src/components/ThemeScript.astro` runs synchronously in the HTML `<head>`, checking `localStorage.getItem('theme')` and falling back to `window.matchMedia('(prefers-color-scheme: dark)')`.

### Syntax Highlighting
Code blocks use Astro's built-in **Shiki** with the `css-variables` theme, allowing the code backgrounds and syntax tokens to adapt dynamically to the latte and espresso color tokens.

### Typography
Self-hosted fonts are bundled under `public/fonts/` and imported via `@fontsource`:
- **Headings & Display**: `Fraunces` (variable serif with warm soft optical sizing).
- **Body Text**: `Source Serif 4` (crisp, highly legible book serif).
- **Code & Monospace**: `JetBrains Mono` (ligature-rich developer font).

---

## Comments Setup

Comments are powered by [Giscus](https://giscus.app), a zero-tracking comment system backed by GitHub Discussions.

1. Ensure your repository has **GitHub Discussions** enabled:
   - Go to your repository **Settings** → **Features** → check **Discussions**.
2. Install the [Giscus GitHub App](https://github.com/apps/giscus).
3. Visit [giscus.app](https://giscus.app) and input your repository details to retrieve your `repoId` and `categoryId`.
4. Open `site.config.ts` and populate:
   ```typescript
   comments: {
     enabled: true,
     repo: "your-username/my-articles",
     repoId: "R_...",
     category: "Announcements",
     categoryId: "DIC_...",
     mapping: "pathname",
     reactionsEnabled: true,
   }
   ```
5. Custom coffee themes (`public/giscus-latte.css` and `public/giscus-espresso.css`) ensure comments visually match the rest of the blog.

For detailed step-by-step instructions, see `docs/COMMENTS.md`.

---

## Deployment (GitHub Pages)

The repository includes a production-ready GitHub Actions workflow in `.github/workflows/deploy.yml`.

### Enabling GitHub Pages
1. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
2. In your GitHub repository:
   - Navigate to **Settings** → **Pages**.
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. The workflow runs on:
   - Every push to `main`.
   - Daily cron at `06:00 UTC` (to automatically publish scheduled articles).
   - Manual trigger (`workflow_dispatch`).

### Custom Domain Setup
If using a custom domain (e.g. `https://articles.example.com`):
1. In `site.config.ts`, set `siteUrl: "https://articles.example.com"` and `base: ""`.
2. Add a `public/CNAME` file containing your custom domain.

---

## Test & Validation Suites

Run automated test suites locally or in CI:

```bash
# Run Git dates verification (5 scenarios)
pnpm run test:dates

# Run SEO, RSS, sitemap, 404, and Open Graph card verification
pnpm run test:seo

# Run writer QoL verification (CLI, validator, drafts, preview mode)
pnpm run test:writer

# Run comments verification (stylesheets, lazy loading, theme synchronization)
pnpm run test:comments

# Full end-to-end audit (type check + validation + static build)
pnpm run build
```

---

## Troubleshooting & FAQ

#### Why do all my articles show the same publish date on GitHub Pages?
Your checkout step in GitHub Actions might be doing a shallow clone. Ensure `.github/workflows/deploy.yml` specifies `fetch-depth: 0`.

#### How do I hide an unfinished article from production?
Add `draft: true` to the article's frontmatter, or move it into an underscore directory (e.g. `content/_drafts/`). It will still be visible when running `pnpm run dev`.

#### Why does an edit to fix a typo not update the "Modified" date?
Add `minor: true` to your commit message (e.g., `git commit -m "fix typo in espresso extraction [minor]"` or `minor: true` in frontmatter). Minor edits intentionally preserve the previous modification date.

#### How do I add math equations or diagrams?
- For KaTeX math, enclose expressions in `$inline$` or `$$block$$`.
- For Mermaid diagrams, use code blocks with language `mermaid`.

---

## License

Artisanal content and code released under the MIT License. Feel free to use this template for your own digital garden or personal writing space.
