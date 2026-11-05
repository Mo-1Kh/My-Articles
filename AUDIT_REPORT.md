# Codebase Audit: Bugs, SEO, Performance & Image Performance

**Project:** Mo's Articles (Astro 5 + Obsidian vault → GitHub Pages at `https://mo-1kh.github.io/My-Articles/`)
**Audit date:** 2026-11-05
**Constraint respected:** Every fix here works on **GitHub Pages**. Nothing requires moving to another host.

> **Note:** `content/` has no articles right now (the test notes were deleted in `e7b405c`). Where this report talks about rendered output, it uses the last build that's still in `dist/` (the `coffee/` and `writing/` sample articles). Every issue was checked against the source code, and the ones marked ✅ were reproduced.

---

## Table of Contents

1. [Priority Summary](#1-priority-summary)
2. [Functional Bugs](#2-functional-bugs)
3. [SEO Issues](#3-seo-issues)
4. [Performance Issues (non-image)](#4-performance-issues-non-image)
5. [Image Performance & Quality Issues](#5-image-performance--quality-issues)
6. [GitHub Pages–Specific Notes](#6-github-pagesspecific-notes)
7. [Accessibility Issues That Also Affect SEO/UX](#7-accessibility-issues-that-also-affect-seoux)
8. [Suggested Fix Order](#8-suggested-fix-order)

---

## 1. Priority Summary

| # | Issue | Area | Severity |
|---|-------|------|----------|
| B1 | Wikilinks are missing the `/My-Articles` base path, so every internal wikilink 404s in production | Bug / SEO | 🔴 Critical |
| S1 | `siteConfig.description` is empty, so the home page, RSS and WebSite JSON-LD have an empty meta description ✅ | SEO | 🔴 Critical |
| B2 | Duplicate `<h1>` when the title comes from the first `# Heading` in the body ✅ | Bug / SEO | 🟠 High |
| B3 | The excerpt generator leaks code-block contents and mangles `snake_case` into meta descriptions ✅ | Bug / SEO | 🟠 High |
| B4 | `slugify()` deletes all non-ASCII characters, so Arabic/RTL slugs, tags and categories come out empty ✅ | Bug | 🟠 High |
| B5 | Obsidian `%% private comments %%` leak if they span paragraphs or contain formatting | Bug / Privacy | 🟠 High |
| S2 | `robots.txt` at `/My-Articles/robots.txt` is never read by crawlers | SEO | 🟠 High |
| I1 | The cover image is preloaded at high priority but never rendered on the page | Image perf | 🟠 High |
| P1 | The preloaded heading font (Fraunces 700) isn't the weight headings use (600) | Perf | 🟠 High |
| I2 | Photo OG covers are saved as **palette (256-color) PNG**, so they're lossy, banded and large | Image quality | 🟠 High |
| B6 | Mermaid source isn't HTML-escaped, so diagrams with `<` break | Bug | 🟡 Medium |
| B7 | External `![](https://…)` images get replaced by a "Missing image" alert | Bug | 🟡 Medium |
| B8 | Lightbox close button is invisible but still focusable (hidden overlay is still rendered) | Bug / A11y | 🟡 Medium |
| I3 | LQIP placeholder stays behind transparent PNGs/SVGs forever; animated GIFs get an *animated* LQIP | Image quality | 🟡 Medium |
| P2 | Client-side DOM injection (code headers, anchors, external icons) causes layout shift (CLS) | Perf | 🟡 Medium |
| … | See the full lists below | | |

---

## 2. Functional Bugs

### B1 🔴 Wikilinks ignore the base path, so all internal wikilinks 404 in production

**File:** [remark-obsidian.ts](file:///home/mohamed/My-Articles/src/plugins/remark-obsidian.ts#L107-L111)

```ts
url: `/${categorySlug}/${fileSlug}/`,   // ← no "/My-Articles" prefix
```

On GitHub Pages the site lives at `/My-Articles/`, so `[[Some Note]]` links to `https://mo-1kh.github.io/coffee/some-note/`, which 404s. The vault map also:
- ignores the frontmatter `slug:` override (`articles.ts` respects it, this file doesn't), so links break whenever `slug:` is set;
- links to drafts, future-dated posts and `_`-prefixed notes, none of which get built (more 404s);
- reads `title:` with a regex that matches **anywhere** in the file, not just the frontmatter;
- is built once when the plugin starts, so in `astro dev` new notes aren't picked up until a restart.

**Fix:**
```ts
import { getPath } from '../../site.config';
// ...
const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
const fmSlug = fm?.[1].match(/^slug:\s*["']?([^"'\r\n]+)["']?/m)?.[1];
const isDraft = /^draft:\s*true/m.test(fm?.[1] ?? '');
if (isDraft) continue; // or mark as broken
const articleSlug = slugify(fmSlug || filename);
const target = { categorySlug, articleSlug, url: getPath(`/${categorySlug}/${articleSlug}/`) };
```
A cleaner long-term option is to build the map from the same `getArticles()` logic (one source of truth), e.g. by writing a small JSON route map in a pre-build script next to the image manifest.

---

### B2 🟠 Duplicate `<h1>` on articles whose title comes from the body ✅

**Files:** [articles.ts `extractTitle`](file:///home/mohamed/My-Articles/src/lib/articles.ts#L57-L73), [[slug].astro](file:///home/mohamed/My-Articles/src/pages/%5Bcategory%5D/%5Bslug%5D.astro#L175)

With no `title:` in the frontmatter, the title is taken from the first `# Heading`. The page renders it as `<h1 class="article-title">`, **and** the body still contains that `# Heading`, which renders as a second `<h1>`. Confirmed in `dist/coffee/pour-over-brewing/index.html` (2 × `<h1>`).

**Fix:** In `remarkObsidian`, remove the first depth-1 heading when it's the title source (or demote all body H1s to H2):
```ts
// at the start of the transformer
const firstH1Index = tree.children.findIndex((n: any) => n.type === 'heading' && n.depth === 1);
if (firstH1Index !== -1 && !file.data.astro?.frontmatter?.title) {
  tree.children.splice(firstH1Index, 1);
}
// and demote any remaining H1s:
visit(tree, 'heading', (n: any) => { if (n.depth === 1) n.depth = 2; });
```
(The transformer signature becomes `(tree, file) => …`.) Also strip that first H1 in `generateExcerpt` (see B3) and in the RSS renderer.

---

### B3 🟠 The excerpt / meta-description generator leaks code and mangles words ✅

**File:** [excerpt.ts](file:///home/mohamed/My-Articles/src/lib/excerpt.ts)

Reproduced output for a body with a title, a fenced code block and `my_var`:
```
"My Title Intro text here. ``js const secretkey = 1; `` More myvar and other_var text."
```
Problems:
1. **Order bug:** inline-code stripping (step 9) runs *before* fenced-code removal (step 10). The inline regex eats the triple backticks, the fenced regex then never matches, and **code ends up in your meta descriptions**.
2. `_([^_]+)_` and `*([^*]+)*` turn `my_var and other_var` into `myvar and other_var`.
3. The first `# Title` heading is kept, so the description starts by repeating the title.
4. `$5 and $10` becomes `5 and 10` (the inline-math regex treats prices as math).
5. `#tags`, footnote markers `[^1]`, table pipes and `---` rules aren't stripped.
6. Uses `...` instead of `…`.

**Fix (order matters):**
```ts
text = text.replace(/^---[\s\S]*?---\s*/, '');
text = text.replace(/%%[\s\S]*?%%/g, '');
text = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');      // fenced code FIRST
text = text.replace(/^#\s+.+$/m, '');                          // drop the first H1 (title)
text = text.replace(/\$\$[\s\S]*?\$\$/g, '');
text = text.replace(/\[\^[^\]]+\]/g, '');                      // footnotes
text = text.replace(/(^|\s)#[\w/-]+/g, '$1');                  // tags
text = text.replace(/^\|.*\|$/gm, '');                         // tables
text = text.replace(/(^|\W)[*_]{1,2}(\S[^*_]*?\S|\S)[*_]{1,2}(?=\W|$)/g, '$1$2'); // word-bounded emphasis
// ...rest
return `${truncated.substring(0, lastSpace)}…`;
```
Better still, generate the excerpt from the rendered HTML (`render(entry)` → strip tags) or from the mdast with `mdast-util-to-string`. Then markdown edge cases can't leak.

---

### B4 🟠 `slugify()` deletes non-ASCII characters, which breaks RTL/Arabic support ✅

**File:** [slug.ts](file:///home/mohamed/My-Articles/src/lib/slug.ts)

`[^\w\s-]` only keeps ASCII. Reproduced: `slugify("قهوة مختصة") === ""`. The schema explicitly supports `lang`/`dir: rtl`, but:
- an Arabic filename gives slug `""`, so the route becomes `/category//` (build error or collision);
- Arabic tags are skipped silently (`if (!tagSlug) continue`);
- Arabic category folders give an empty category slug;
- wikilink heading anchors to Arabic headings come out empty.

There's a second, related bug: **heading anchors don't match Astro's IDs.** Astro generates heading IDs with `github-slugger`, but wikilinks use `slugify()`:
`"C++ & Rust"` gives `c--rust` from github-slugger and `c-rust` from `slugify`, so `[[Note#C++ & Rust]]` jumps nowhere.

**Fix:**
```ts
// slug.ts – Unicode-aware
export function slugify(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```
and for heading anchors use the same slugger Astro uses:
```ts
import { slug as githubSlug } from 'github-slugger';
const href = heading ? `${resolved.url}#${githubSlug(heading)}` : resolved.url;
```
Also update the **duplicate copy** of `slugify` in [validate-vault.mjs](file:///home/mohamed/My-Articles/scripts/validate-vault.mjs). It behaves differently today (keeps `_`, while the site turns `_` into `-`), so `my_post.md` and `my-post.md` collide on the site but the validator doesn't flag it. Import one shared implementation in both places.

---

### B5 🟠 `%% comments %%` can leak private notes into the published HTML

**File:** [remark-obsidian.ts](file:///home/mohamed/My-Articles/src/plugins/remark-obsidian.ts#L133-L138)

Comments are stripped **per text node**. In these cases the comment is published:
- a comment that spans paragraphs (`%%\nprivate\n\nstill private\n%%`);
- a comment containing `**bold**`, a link or inline code (the `%%` markers end up in different nodes);
- a comment inside a list or table.

**Fix:** Strip comments from the **raw markdown before parsing**. A small Vite/remark preprocess works, but the simplest reliable option is a custom glob loader `generateDigest`/`parseData` hook, or a remark plugin that works on `file.value` before parsing:
```ts
// astro.config.mjs → markdown.remarkPlugins: first entry
function remarkStripObsidianComments() {
  return function (this: any) {
    const parser = this.parser;
    this.parser = (doc: string, file: any) =>
      parser(String(doc).replace(/%%[\s\S]*?%%/g, ''), file);
  };
}
```
(If you prefer not to touch the parser, run the regex in the content loader and pass the cleaned body.) The excerpt, reading-time and RSS code already strip comments from the raw body, so only the HTML render is affected.

---

### B6 🟡 Mermaid source isn't HTML-escaped

**File:** [remark-obsidian.ts](file:///home/mohamed/My-Articles/src/plugins/remark-obsidian.ts#L141-L148)

```ts
value: `<pre class="mermaid">${node.value}</pre>`,
```
Diagrams using `<|--` (class diagrams), `<-->`, `<br>` or `A<B` are parsed as HTML tags by the browser, so the diagram breaks or swallows text. Mermaid reads `textContent`, so escaping is safe:
```ts
value: `<pre class="mermaid">${escapeHtml(node.value)}</pre>`,
```

---

### B7 🟡 External images and malformed URLs

**File:** [remark-obsidian.ts](file:///home/mohamed/My-Articles/src/plugins/remark-obsidian.ts#L291-L313)

- `![alt](https://example.com/photo.jpg)` goes through `resolveImage`, which fails, and the image is **replaced by a "Missing image" alert**. Worse, `resolveImage` matches on basename, so an external `…/cover.png` can silently be swapped for a *local* `cover.png`.
- `decodeURIComponent(node.url)` throws `URIError` on a stray `%` (e.g. `50%-off.png`), which **crashes the build**.

**Fix:**
```ts
visit(tree, 'image', (node, index, parent) => {
  if (/^(https?:)?\/\//i.test(node.url) || node.url.startsWith('data:')) {
    node.data = { hProperties: { loading: 'lazy', decoding: 'async' } };
    return; // leave external images alone
  }
  let cleanUrl = node.url;
  try { cleanUrl = decodeURIComponent(node.url); } catch {}
  // ...
});
```

---

### B8 🟡 Lightbox overlay is always rendered, so its invisible close button can be focused

**File:** [ImageLightbox.astro](file:///home/mohamed/My-Articles/src/components/ImageLightbox.astro#L20-L42)

`.lightbox-overlay { display: flex }` overrides the UA rule `[hidden] { display: none }`. The overlay is never removed from layout, just set to `opacity: 0` / `pointer-events: none`. Keyboard users tab onto an **invisible "Close enlarged view" button**, and screen readers can announce the dialog. There's also no focus trap.

**Fix:** Use a native `<dialog>` (gives you a focus trap, Esc and inert background for free), or:
```css
.lightbox-overlay[hidden] { display: flex; visibility: hidden; }
.lightbox-overlay { transition: opacity .2s, visibility 0s linear .2s; }
.lightbox-overlay:not([hidden]) { visibility: visible; transition-delay: 0s; }
```
Also: the lightbox sets `src` to the full-size **AVIF** with no fallback (`data-full`), so browsers without AVIF show a broken image. Copy the `<picture>`'s `srcset` into the lightbox `<img>` with `sizes="100vw"`, or point `data-full` at the largest **WebP**.

---

### B9 🟡 Tags: wrong extraction, `##double` hashes, nested tags dropped

**Files:** [articles.ts](file:///home/mohamed/My-Articles/src/lib/articles.ts#L173-L176), [remark-obsidian.ts](file:///home/mohamed/My-Articles/src/plugins/remark-obsidian.ts#L167)

- Inline tags are taken from the **raw body including code blocks**: `#include`, `#define`, CSS `#main`, shell `#comment` all become tag pages.
- Frontmatter `tags: ["#test"]` (your deleted test note did this) keeps the `#`, so it displays as `##test`.
- Obsidian nested tags `#coffee/espresso` are rendered by the remark plugin (`/` allowed) but `articles.ts` doesn't extract them (the lookahead fails on `/`). The two regexes disagree.
- Frontmatter `tags: coffee` (a single string, which Obsidian allows) is ignored because only arrays are accepted.
- `tags` isn't in the zod schema, so it's never validated.

**Fix:**
```ts
const bodyNoCode = rawBody.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '').replace(/`[^`\n]*`/g, '').replace(/%%[\s\S]*?%%/g, '');
const fmTags = ([] as string[]).concat(entry.data?.tags ?? []).map(t => String(t).replace(/^#/, '').trim());
const inline = [...bodyNoCode.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map(m => m[1]);
```
And add `tags: z.union([z.string(), z.array(z.string())]).optional()` to [content.config.ts](file:///home/mohamed/My-Articles/src/content.config.ts).

---

### B10 🟡 Frontmatter typos are silently ignored

**File:** [content.config.ts](file:///home/mohamed/My-Articles/src/content.config.ts#L23)

The schema uses `.passthrough()`, so `publishDate:` / `modifiedDate:` (used in your deleted `test1.md`) are accepted and **ignored**. The dates silently fall back to git. Add a warning in `validate-vault.mjs` for unknown keys, or alias them:
```ts
published: z.coerce.date().optional(),
publishDate: z.coerce.date().optional(), // alias → merge in articles.ts
```

---

### B11 🟡 Cover image edge cases produce invalid `og:image`

**File:** [[slug].astro](file:///home/mohamed/My-Articles/src/pages/%5Bcategory%5D/%5Bslug%5D.astro#L66-L81), [SEO.astro](file:///home/mohamed/My-Articles/src/components/SEO.astro#L229)

- An **SVG** cover has no `ogUrl` (the SVG branch of the optimizer never creates one), so `og:image` becomes an `.svg`. Facebook, LinkedIn, X and WhatsApp **don't support SVG**.
- An unresolved cover falls back to the raw string (`attachments/x.png`), so `og:image` points to a file that's never deployed.
- `og:image:type` is hard-coded to `image/png`, which is wrong for external JPG covers.

**Fix:** For SVG covers, rasterize a 1200×630 PNG in `optimize-images.mjs` (sharp can read SVG). For unresolved covers, fall back to the generated `/og/<cat>/<slug>.png`. Only emit `og:image:type` when you know it.

---

### B12 🟡 Image manifest collisions

**File:** [optimize-images.mjs](file:///home/mohamed/My-Articles/scripts/optimize-images.mjs#L237-L238)

- Entries are keyed by **basename**. Two files named `image.png` (or Obsidian's `Pasted image 2026….png` in different folders) overwrite each other, so one article shows the other's image.
- The "legacy canonical" copy `${name}.webp` has no hash, so it collides the same way. It also **duplicates the largest variant** (extra bytes in every deploy) and nothing uses it (`src` is the hashed file).
- `Object.keys(manifest).length / 2` reports the wrong count for root-level files (relKey === baseKey).

**Fix:** Keep `relKey` as the primary key and only register `baseKey` if it's unique (warn on duplicates in `validate-vault`). Delete the canonical `.webp` copy and set `optimizedUrl = largestWebp.src`.

---

### B13 🟡 SVG handling in the optimizer

**File:** [optimize-images.mjs](file:///home/mohamed/My-Articles/scripts/optimize-images.mjs#L38-L44)

- `minifySvg` collapses `>\s+<` and multiple spaces **globally**. That joins words in `<text>`/`<tspan>` (`<tspan>Hello</tspan> <tspan>World</tspan>` becomes "HelloWorld") and breaks `xml:space="preserve"` content. This is visible quality damage on diagrams (Excalidraw/draw.io exports).
- `/\bwidth=["'](\d+…)/` also matches `stroke-width="2"` (`\b` matches after `-`), so SVGs without a `viewBox` can get `width=2`, a wrong aspect ratio and layout shift.
- The `viewBox` regex fails on comma-separated values (`0,0,800,600`).

**Fix:** Use [`svgo`](https://github.com/svg/svgo) with the default preset (it's whitespace-safe), and parse dimensions with `/<svg\b[^>]*\swidth=["']([\d.]+)/i`.

---

### B14 🟢 Git date resolution: shell injection and fragility

**File:** [git-dates.ts](file:///home/mohamed/My-Articles/src/lib/git-dates.ts#L79-L131)

`execSync(\`git log … -- "${relativePath}"\`)` passes filenames through a shell. A note named `Why $HOME matters.md` or one containing `` ` `` or `"` breaks the command (dates silently fall back to "now"), and `$(…)` in a filename would execute. Obsidian allows all of these characters.

**Fix:** Use `execFileSync('git', ['log', '--follow', '--format=%H|%aI', '--', relativePath], { cwd })`. Same for `git show`.

---

### B15 🟢 Other bugs (low severity)

| Location | Bug | Fix |
|---|---|---|
| [Analytics.astro](file:///home/mohamed/My-Articles/src/components/Analytics.astro#L7) | Plausible needs a `websiteId` to render even though it doesn't use one, and `host` is reused as `data-domain` | Gate Plausible on `provider === 'plausible'` alone; add a separate `domain` field |
| [FontLoader.astro](file:///home/mohamed/My-Articles/src/components/FontLoader.astro#L8-L15) | `siteConfig.fonts.*.weights` / `family` are ignored. Imports are hard-coded, so editing the config changes nothing (code weight `500` is never loaded) | Treat the config as documentation only, or generate the imports |
| [Comments.astro](file:///home/mohamed/My-Articles/src/components/Comments.astro#L141) | `data-lang="en"` is hard-coded even for `lang: ar` articles | Pass `article.lang` |
| [Comments.astro](file:///home/mohamed/My-Articles/site.config.ts) | Giscus `mapping: 'pathname'` stores `/My-Articles/...`. If you ever add a custom domain (still GitHub Pages), every discussion is orphaned | Switch to `mapping: 'specific'` with `data-term="<category>/<slug>"` **before** you get real comments |
| [rehype-obsidian-callouts.ts](file:///home/mohamed/My-Articles/src/plugins/rehype-obsidian-callouts.ts#L42-L56) | A callout title with formatting (`> [!note] **Bold** title`) loses the title. Types like `success`, `question`, `bug`, `example`, `quote`, `abstract`, `todo` have no colors | Collect all inline nodes up to the first line break as the title; add CSS for the remaining types |
| [og-image.ts](file:///home/mohamed/My-Articles/src/lib/og-image.ts#L22-L37) | Titles longer than 3 lines are cut with no ellipsis. A single word over 30 characters overflows the card. Non-Latin titles render as tofu (CI only installs Latin fonts) | Add `…` to the 3rd line when truncated; hard-break long words; install `fonts-noto-core` (or the Arabic fontsource subset) in the workflow |
| [rss.xml.ts](file:///home/mohamed/My-Articles/src/pages/rss.xml.ts#L43-L46) | `alt` isn't escaped (a `"` in alt text breaks the `<img>`). `<author>` must be an email per RSS 2.0. `<language>en-us</language>` is hard-coded | Escape alt; use `customData`/`dc:creator` for the author name |
| [[...redirect].astro](file:///home/mohamed/My-Articles/src/pages/%5B...redirect%5D.astro) | A redirect entry can overwrite a real page (e.g. `redirects: ["coffee"]` replaces the category hub). Entries starting with `/My-Articles/` get double-prefixed | Validate redirects against real routes in `validate-vault.mjs`; strip a leading base path |
| Multiple components | `document.addEventListener('astro:after-swap', …)` is dead code (no `<ClientRouter />`). If you ever add it, listeners like the lightbox's document `keydown` stack up on every navigation | Remove, or switch to `astro:page-load` with cleanup |
| [deploy.yml](file:///home/mohamed/My-Articles/.github/workflows/deploy.yml#L7-L9) | GitHub **disables scheduled workflows after 60 days with no repo activity**, so scheduled (future-dated) posts would stop publishing during a writing break | Keep a periodic commit, or re-enable from the Actions tab; mention it in the README |
| [deploy.yml](file:///home/mohamed/My-Articles/.github/workflows/deploy.yml#L56-L62) | The image cache restores with `restore-keys: images-` and re-saves everything, so stale variants pile up in the cache indefinitely | Prune `.cache/images` of files not in the new manifest at the end of `optimize-images.mjs` |
| [optimize-images.mjs](file:///home/mohamed/My-Articles/scripts/optimize-images.mjs#L90) | `public/images/optimized/` is never cleaned locally, so deleted images keep getting copied into `dist` on local builds | `fs.rm(OUT, { recursive: true, force: true })` before writing |

---

## 3. SEO Issues

### S1 🔴 Empty site description ✅

**File:** [site.config.ts](file:///home/mohamed/My-Articles/site.config.ts) → `description: ""`

The built `dist/index.html` has `<meta name="description" content>`. The same empty string goes into the home `<p class="home-desc">`, `og:description`, `twitter:description`, the WebSite JSON-LD and the RSS channel description. Google will make up its own snippet, and social cards will have no text.

**Fix:** Write a 140–160 character description. (Your `site.webmanifest` already has a good one you can reuse.) Then make the build fail if it's empty: add a check in `validate-vault.mjs` or `test-seo.mjs`.

---

### S2 🟠 `robots.txt` is never read by search engines

**File:** [robots.txt.ts](file:///home/mohamed/My-Articles/src/pages/robots.txt.ts)

Crawlers only request `https://mo-1kh.github.io/robots.txt` (host root). Yours is served at `/My-Articles/robots.txt`, so it's **ignored**, along with its `Sitemap:` line. `Disallow: /style-guide/` is also missing the base path.

**Fix (still GitHub Pages):**
1. Create (or reuse) the **user site repo `Mo-1Kh/Mo-1Kh.github.io`**. Anything in it is served from the host root. Put a `robots.txt` there:
   ```
   User-agent: *
   Allow: /
   Sitemap: https://mo-1kh.github.io/My-Articles/sitemap.xml
   ```
   That repo can also redirect `/` to `/My-Articles/` if you want.
2. Register a **URL-prefix property** for `https://mo-1kh.github.io/My-Articles/` in Google Search Console and Bing Webmaster Tools. Verify with the meta tag (`verification.google` / `verification.bing` in `site.config.ts` are already wired up, just empty), then submit `sitemap.xml` by hand.
3. Fix the path in the generated file anyway (`Disallow: /My-Articles/style-guide/`) for when you add a custom domain.

---

### S3 🟠 Duplicate H1 → see [B2](#b2--duplicate-h1-on-articles-whose-title-comes-from-the-body-)

### S4 🟠 Bad auto-generated meta descriptions → see [B3](#b3--the-excerpt--meta-description-generator-leaks-code-and-mangles-words-)

### S5 🔴 Broken internal wikilinks (crawl 404s, lost link equity) → see [B1](#b1--wikilinks-ignore-the-base-path-so-all-internal-wikilinks-404-in-production)

---

### S6 🟡 Home page H1 and title

**Files:** [index.astro](file:///home/mohamed/My-Articles/src/pages/index.astro#L27), [site.config.ts](file:///home/mohamed/My-Articles/site.config.ts)

- The home `<h1>` is `"A place just for me"`. It says nothing about the topics, and it's the strongest on-page signal you have. Use something like `"Mohamed Khairy: essays on software engineering and technical writing"` and keep the personal line as a subtitle.
- Tagline casing: `"Software Engineering & technical Writing"`. Change it to `"Technical Writing"` (it appears in the `<title>`).

---

### S7 🟡 Structured data URLs without a trailing slash and with a mixed-case host

**File:** [SEO.astro](file:///home/mohamed/My-Articles/src/components/SEO.astro#L59-L60)

```ts
const siteRootUrl = `${siteOrigin}${getBasePath() || '/'}`; // → https://Mo-1Kh.github.io/My-Articles   (no slash)
```
The Person `url`, the WebSite `url`, the breadcrumb "Home" item and the Person `@id` all point to a URL that **301-redirects** (`trailingSlash: 'always'`). The same happens in [rss.xml.ts](file:///home/mohamed/My-Articles/src/pages/rss.xml.ts#L121). Canonicals also use `https://Mo-1Kh.github.io` (mixed case). Hosts are case-insensitive, but string-comparing tools (Facebook debugger, some SEO crawlers, Giscus) treat them as different URLs.

**Fix:**
```ts
// site.config.ts
return `https://${siteConfig.githubUser.toLowerCase()}.github.io`;
// SEO.astro / rss.xml.ts
const siteRootUrl = getCanonicalUrl('/');   // → https://mo-1kh.github.io/My-Articles/
```

---

### S8 🟡 Thin tag pages are indexed

**Files:** [tags/[tag]/index.astro](file:///home/mohamed/My-Articles/src/pages/tags/%5Btag%5D/index.astro), [sitemap.xml.ts](file:///home/mohamed/My-Articles/src/pages/sitemap.xml.ts#L95-L106)

Every tag gets an indexable page in the sitemap, even with a single article. Combined with B9 (tags extracted from code), that's a lot of near-empty pages, which spends crawl budget and looks thin.

**Fix:** For tags with fewer than 2–3 articles, emit `<meta name="robots" content="noindex, follow">` and leave them out of the sitemap. Note that `noIndex` currently outputs `noindex, nofollow`. Add a `follow` variant so link equity still flows to the articles.

---

### S9 🟡 Wrong schema type on hub pages

**File:** [SEO.astro](file:///home/mohamed/My-Articles/src/components/SEO.astro#L95-L106)

Every `ogType="website"` page (home, every category, every tag) outputs the same `WebSite` JSON-LD. `WebSite` belongs **only on the home page**. Category and tag pages should use `CollectionPage` (with `mainEntity` → `ItemList` of the article URLs) plus a `BreadcrumbList`.

---

### S10 🟡 The cover image is used for SEO but never shown on the page

**File:** [[slug].astro](file:///home/mohamed/My-Articles/src/pages/%5Bcategory%5D/%5Bslug%5D.astro#L66-L127)

`cover:` feeds `og:image`, the JSON-LD `image` and the image sitemap, but it's **never rendered** in the article. Google prefers structured-data and sitemap images that actually appear on the page. Render the cover as a hero `<picture>` (which also fixes [I1](#i1--cover-image-preloaded-but-never-displayed)).

---

### S11 🟢 Smaller SEO improvements

| Item | Recommendation |
|---|---|
| Large image previews | Add `<meta name="robots" content="max-image-preview:large">` on indexable pages. It's needed for big thumbnails in Google Discover and Search |
| Tag pills in the body aren't links | `#tag` in the article body becomes a `<span class="tag">`. Make it `<a href="/My-Articles/tags/<slug>/">` for internal linking |
| Redirect stubs | [[...redirect].astro](file:///home/mohamed/My-Articles/src/pages/%5B...redirect%5D.astro#L50-L52) sets **both** `noindex` and `canonical`, which are contradictory signals. Keep `canonical` + `meta refresh 0` (Google treats that as a permanent redirect) and drop `noindex` |
| `og:title` | Includes `· Mo's Articles`. Social platforms already show `og:site_name`, so use the bare article title for `og:title`/`twitter:title` |
| Image alt fallback | Without alt text, the alt becomes the humanized filename (`"Pasted image 20261104"`). `validate-vault` already warns. Consider failing CI on `MISSING_IMAGE_ALT` |
| `og:locale` | `lang: "ja"` gives `ja_JA` (invalid). Use a small map (`ja → ja_JP`, `ar → ar_AR`, `en → en_US` …) |
| Image sitemap | Uses the AVIF URL. It's fine for Google, but other engines and tools handle WebP/JPEG better. Use the largest WebP |
| Web manifest | Only SVG + a 180px icon. Add 192×192 and 512×512 PNGs (Lighthouse and installability checks) |
| `theme-color` | Static per `prefers-color-scheme`, so it doesn't follow the manual theme toggle. Update the meta tag in `ThemeToggle` |

---

## 4. Performance Issues (non-image)

### P1 🟠 The preloaded font isn't the one the headings use

**Files:** [FontLoader.astro](file:///home/mohamed/My-Articles/src/components/FontLoader.astro#L14-L36), [theme.css](file:///home/mohamed/My-Articles/src/styles/theme.css#L233-L236)

- Preloaded: `fraunces-latin-700-normal.woff2`. That weight is only used by the navbar brand.
- `h1…h6` use **`font-weight: 600`**, so the article `<h1>` (often the LCP element) waits for an un-preloaded font, and you get a FOUT/reflow on the title.

**Fix (pick one):**
- Preload `fraunces-latin-600-normal.woff2` instead, **or**
- Better: set the brand to 600 too and drop the 700 import entirely. That's one less font file on every page, and the difference is barely visible.

---

### P2 🟡 Client-side DOM injection causes layout shift

**Files:** [CodeBlockEnhancer.astro](file:///home/mohamed/My-Articles/src/components/CodeBlockEnhancer.astro), [HeadingAnchors.astro](file:///home/mohamed/My-Articles/src/components/HeadingAnchors.astro), [ExternalLinks.astro](file:///home/mohamed/My-Articles/src/components/ExternalLinks.astro)

After the page renders, JS wraps every code block in a container with a ~30px header, appends `#` anchors to headings, and adds icons to external links. Each code-block header pushes the content below it down, which adds CLS and work on the main thread on long articles.

**Fix:** Do the static parts at build time and keep JS only for behavior:
- Code header: a small rehype plugin (or a Shiki `transformers` entry in `shikiConfig`) that outputs `<div class="code-block-container"><div class="code-block-header"><span>ts</span><button class="code-copy-btn">Copy</button></div><pre>…</pre></div>`. The client script then only attaches click handlers.
- Heading anchors: `rehype-autolink-headings` (`behavior: 'append'`).
- External links: `rehype-external-links` (`target: '_blank'`, `rel: ['noopener']`, plus an icon as `content`).

---

### P3 🟡 Faux italics and faux bold (rendering quality)

You load no italic faces, but `em`, `blockquote` (`font-style: italic`) and `figcaption` (italic) are used a lot, so the browser **slants the roman font** (faux oblique). The code font gets `font-weight: 600` (`.code-lang-label`) with only a 400 face loaded, so you get faux bold.

**Fix (quality improvement, not preloaded so no LCP cost):**
```ts
import '@fontsource/source-serif-4/latin-400-italic.css';
```
and use `font-weight: 400`/`500` for JetBrains Mono labels (or import `latin-500`). Add `font-synthesis: none;` to `html` to catch future regressions.

---

### P4 🟡 KaTeX fonts use `font-display: block`

**File:** [public/vendor/katex/katex.min.css](file:///home/mohamed/My-Articles/public/vendor/katex/katex.min.css)

Math is **invisible for up to 3 seconds** on slow connections. Replace `font-display:block` with `font-display:swap` in the vendored file, or (better) stop vendoring it and copy it from `node_modules/katex/dist` in a pre-build step. That also guarantees the CSS version always matches the `katex@0.19.1` that `rehype-katex` renders with, which nothing enforces today.

---

### P5 🟢 Build-time performance

| Item | Detail | Fix |
|---|---|---|
| `getArticles()` recomputed | Called by the home page, every category/tag/article `getStaticPaths`, RSS, sitemap, OG and redirects. Each call re-runs `getCollection`, the regexes and `fs.existsSync` per article | Memoize: `let cache: Promise<Article[]> \| null = null; export const getArticles = () => (cache ??= loadArticles());` |
| Git process spawns | 2× `git log --follow` + N× `git show` per article (dates are cached per process, but each run still spawns all of them). Obsidian-git's frequent "vault backup" commits make histories long | Fine for now. If builds slow down, get all dates in one `git log --name-only --format=…` call over `content/` and index it in memory |
| `astro check` in `build` | Adds roughly 10–30s to every CI build | Keep it, but run it as a separate parallel CI job, or only in `pnpm test` |

---

### P6 🟢 Smaller runtime items

| Item | Recommendation |
|---|---|
| `prefetch.prefetchAll` + `experimental.clientPrerender` | Prerendering on hover renders whole pages in the background (including scripts and any future analytics pageviews). It's experimental and may change between Astro versions. Plain prefetch (`clientPrerender: false`) gets most of the speed benefit with fewer side effects |
| Header `backdrop-filter: blur(8px)` | The header background is **opaque** (`var(--bg)`), so the blur is invisible but still costs GPU compositing on every scroll frame. Remove it, or make the background semi-transparent if you want the effect |
| ~32 KB of inline CSS per page | `inlineStylesheets: 'always'` is a sensible choice on GitHub Pages (10-minute cache, see §6). Shrink it instead: the dark palette is duplicated in `[data-theme=espresso]` **and** `@media (prefers-color-scheme: dark)`. Since the inline theme script always sets `data-theme`, keep the media-query copy only as a `<noscript>`-style fallback, or use CSS `light-dark()` |
| JSON-LD is pretty-printed | `JSON.stringify(schema, null, 2)` adds whitespace to every page. Use `JSON.stringify(schema)` |
| Root font size in `px` | `html { font-size: 17px }` overrides the user's browser font-size setting (accessibility). Use `font-size: 106.25%` |
| Mermaid | Lazy-loading through `IntersectionObserver` is already good. The core is ~680 KB plus a chunk per diagram type, and it re-renders every diagram on theme toggle. Optional: pre-render diagrams to SVG at build time (e.g. `rehype-mermaid` with the `img-svg` strategy and light/dark variants) to ship **0 KB of JS** |

---

## 5. Image Performance & Quality Issues

Your pipeline is already good (responsive AVIF + WebP, EXIF rotation, ICC preservation, photo vs. graphic tuning, LQIP, caching). The issues below cost bytes or visual quality without any benefit.

### I1 🟠 Cover image preloaded but never displayed

**File:** [[slug].astro](file:///home/mohamed/My-Articles/src/pages/%5Bcategory%5D/%5Bslug%5D.astro#L119-L127)

If an article has a `cover:`, the page adds `<link rel="preload" as="image" imagesrcset="…avif…">` at **high priority**. The cover is never rendered, so on every article with a cover the browser downloads a 100–300 KB image that competes for bandwidth with the real LCP element and the fonts. Chrome will also log "preloaded but not used".

**Fix:** Either render the cover as a hero image, or remove the preload:
```astro
{coverInfo && (
  <figure class="article-cover">
    <picture>
      <source type="image/avif" srcset={avifSrcset} sizes="(min-width: 760px) 720px, calc(100vw - 2rem)" />
      <img src={coverInfo.optimizedUrl} srcset={webpSrcset} sizes="(min-width: 760px) 720px, calc(100vw - 2rem)"
           width={coverInfo.width} height={coverInfo.height} alt={coverAlt}
           fetchpriority="high" loading="eager" decoding="async" />
    </picture>
  </figure>
)}
```
With the hero in the HTML, you don't need the preload at all (the preload scanner finds `<img>` in the initial HTML). If you do render the cover, make sure the **first in-body image** is no longer `fetchpriority="high"` (see I4).

---

### I2 🟠 OG covers saved as 256-color palette PNG (lossy and large)

**File:** [optimize-images.mjs](file:///home/mohamed/My-Articles/scripts/optimize-images.mjs#L198-L208)

```js
.resize(1200, 630, { fit: 'cover', position: 'attention' })
.png({ palette: true, quality: 90, compressionLevel: 9 })
```
`palette: true` quantizes a **photograph** to 256 colors, which causes banding in skies and gradients and dithering noise on skin and food. The file also comes out *bigger* than an equivalent JPEG. WhatsApp, LinkedIn and Facebook re-compress anyway, and some (WhatsApp) skip images over ~300 KB.

**Fix (better quality, roughly 3–5× smaller):**
```js
const ogName = `${base}.${hash}-og.jpg`;
await sharp(buf).rotate()
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .flatten({ background: '#1B1D23' })            // in case of alpha
  .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' })
  .toFile(cachedOg);
```
For **graphic** sources (screenshots/diagrams, `isGraphic === true`) keep PNG but **without** `palette: true`. Then update `og:image:type` from the file extension.

The same applies to the generated text OG cards ([og-image.ts](file:///home/mohamed/My-Articles/src/lib/og-image.ts#L139-L141)) and [`public/og-default.png`](file:///home/mohamed/My-Articles/public/og-default.png) (an 8-bit colormap PNG). The radial "glow" gradient is exactly the content that bands under 256-color quantization. Use `palette: false` (lossless, a bit larger) or `.jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' })`, which keeps text crisp at ~40–60 KB.

---

### I3 🟡 LQIP placeholder problems

**Files:** [optimize-images.mjs](file:///home/mohamed/My-Articles/scripts/optimize-images.mjs#L210-L218), [remark-obsidian.ts](file:///home/mohamed/My-Articles/src/plugins/remark-obsidian.ts#L53-L57)

1. **It never goes away.** The blurred placeholder is a permanent CSS `background` on the `<img>`. For PNG/WebP with **transparency** (logos, diagrams, screenshots with rounded corners), the blurry colored blob **shows through the transparent areas** after the image loads.
2. **Animated sources get an animated LQIP.** `pipeline` was created with `{ animated: true }`, so `.resize(16).webp()` encodes *every frame*. For a 100-frame GIF that's a multi-KB base64 string inlined into the HTML.
3. A 16 px image stretched with `center/cover` looks blocky, not blurred.

**Fix:**
```js
// LQIP from the first frame only, skip for alpha images
const lqipBuf = meta.hasAlpha
  ? null
  : await sharp(buf, { pages: 1 }).rotate().resize(16).webp({ quality: 40 }).toBuffer();
```
```html
<!-- remove the background once loaded -->
<img … style="background:url(data:…) center/cover no-repeat"
     onload="this.style.background='none'" />
```
Add CSS `filter: blur(…)` only on the placeholder layer if you want a smoother blur (e.g. a wrapper `::before`), never on the image itself.

---

### I4 🟡 "First image" always gets `loading="eager"` + `fetchpriority="high"`

**File:** [remark-obsidian.ts](file:///home/mohamed/My-Articles/src/plugins/remark-obsidian.ts#L48)

The first image in the markdown is treated as LCP **wherever it is**. If an article's first image is halfway down a 3,000-word essay, it downloads at high priority on page load and competes with fonts and CSS.

**Fix:** Only promote an image if it appears within the first ~3 top-level blocks of the article (check the index in `tree.children`). Otherwise use `loading="lazy"` with no `fetchpriority`. If you render a cover hero (I1), the cover is the LCP and no body image should be promoted.

---

### I5 🟡 `sizes` for fixed-width embeds overstates the size on small screens

**File:** [remark-obsidian.ts](file:///home/mohamed/My-Articles/src/plugins/remark-obsidian.ts#L49-L51)

`![[img.png|600]]` gives `sizes="600px"`, even on a 360 px phone where the image is shown at about 330 px. The browser picks variants for 600 px × DPR, so it over-downloads.

**Fix:**
```ts
const sizesAttr = explicitWidth
  ? `(max-width: ${explicitWidth + 32}px) calc(100vw - 2rem), ${explicitWidth}px`
  : '(min-width: 760px) 720px, calc(100vw - 2rem)';
```

---

### I6 🟡 Lightbox loads AVIF without a fallback → see [B8](#b8--lightbox-overlay-is-always-rendered-so-its-invisible-close-button-can-be-focused)

Also consider loading the full-size image **on intent** (`pointerenter`/`focus` on the thumbnail → `new Image().src = full`) so the zoom opens instantly without preloading every full-size image.

---

### I7 🟢 Animated GIFs → consider video

Animated GIFs are converted to animated AVIF/WebP, which is much better than GIF. For anything longer than a few seconds, an `<video autoplay muted loop playsinline>` with an H.264 MP4 (and optionally VP9/AV1 WebM) is usually **5–10× smaller** at the same visual quality. Animated AVIF also needs Safari 16.4+. Optional: detect `animated && sizeBytes > 500 KB` and emit a video with `ffmpeg` in the pre-build step (CI runners have ffmpeg installed).

---

### I8 🟢 Optimizer fine-tuning (no quality loss)

| Item | Recommendation |
|---|---|
| Wasted duplicate file | The non-hashed `${name}.webp` copy of the largest variant (see B12). Delete it to save the bytes of your biggest image, every time, in every deploy |
| SVG minifier | Replace with SVGO (see B13). It's safer **and** produces smaller files |
| Width ladder | `[480, 768, 1080, 1440, 2160]` against a 720 CSS-px column: a 2× phone (≈ 360–412 px) wants ~720–830, a 3× phone wants ~1080–1240, and 2× desktop wants 1440. Adding **`1200`** gives 3× phones a closer match than 1440 (≈ 25–30% fewer bytes for them). Keep 2160 for the lightbox |
| `effort: 6` for AVIF | Good for quality and cached, so it's fine. Just note that a cold cache in CI is slow; the cache key is already set up |
| Metadata | Sharp already strips EXIF/GPS (only ICC is kept). Good for privacy, nothing to change |
| Stale outputs | Clean `public/images/optimized` before each run and prune `.cache/images` (see B15) so deleted images don't get deployed |

---

## 6. GitHub Pages–Specific Notes

These are platform limits. The aim is to work **with** them, not to move away.

1. **`public/_headers` does nothing on GitHub Pages.** That file format is for Netlify/Cloudflare Pages. GitHub Pages ignores it and serves **every** file with `Cache-Control: max-age=600`. The `Cache-Control` header set in [the OG endpoint](file:///home/mohamed/My-Articles/src/pages/og/%5Bcategory%5D/%5Bslug%5D.png.ts#L48) is also discarded (it's a static build). **Action:** delete `_headers` so nobody is misled. You can't set custom headers on GitHub Pages, so get the most out of what you can control:
   - Keep **content hashes** in filenames (already true for `_astro/*` and optimized images). After the 10-minute expiry, the browser revalidates with ETag and gets a cheap `304`.
   - Keep inlining critical CSS (`inlineStylesheets: 'always'`). It avoids a revalidation round-trip per page on a 10-minute-cache host.
   - Self-host fonts (already done, good).
2. **`robots.txt` must live at the host root.** Use the `Mo-1Kh.github.io` user-site repo (see S2).
3. **Security headers** (`X-Content-Type-Options`, `Referrer-Policy`) can't be set as headers. Add the referrer policy as a meta tag:
   ```html
   <meta name="referrer" content="strict-origin-when-cross-origin" />
   ```
   A CSP can also be delivered with `<meta http-equiv="Content-Security-Policy" …>` if you want one (`frame-ancestors` doesn't work in meta).
4. **Compression:** GitHub Pages already serves gzip. Brotli isn't available, which is one more reason to keep HTML and inline CSS small (P6).
5. **Size limits:** a GitHub Pages site should stay under 1 GB and has a soft 100 GB/month bandwidth limit. Removing duplicate image copies (B12/I8) and old variants keeps you far below both.
6. **Scheduled builds** stop after 60 days without repo activity (see B15).

---

## 7. Accessibility Issues That Also Affect SEO/UX

| Issue | File | Fix |
|---|---|---|
| No "skip to content" link (there's a sticky header with 7+ focusable links before the content) | [BaseLayout.astro](file:///home/mohamed/My-Articles/src/layouts/BaseLayout.astro#L63) | `<a class="sr-only focus:not-sr-only" href="#main-content">Skip to content</a>` as the first child of `<body>` |
| Invisible but focusable lightbox close button | [ImageLightbox.astro](file:///home/mohamed/My-Articles/src/components/ImageLightbox.astro) | See B8 |
| Alt text duplicated as `<figcaption>` (screen readers read it twice) | [remark-obsidian.ts](file:///home/mohamed/My-Articles/src/plugins/remark-obsidian.ts#L72) | Support a separate caption syntax (e.g. image `title`), or leave out the caption when it equals the alt |
| Callout SVG icons have no `aria-hidden` | [rehype-obsidian-callouts.ts](file:///home/mohamed/My-Articles/src/plugins/rehype-obsidian-callouts.ts#L5-L21) | Add `aria-hidden="true" focusable="false"` |
| `scroll-margin-top` only applies inside `HeadingAnchors`, so other anchor targets (footnotes, `#comments`) end up hidden under the sticky header | [theme.css](file:///home/mohamed/My-Articles/src/styles/theme.css) | `:target, [id] { scroll-margin-top: 5rem; }` globally |
| Email in a plain `mailto:` (scraped by spam bots) | [Navbar.astro](file:///home/mohamed/My-Articles/src/components/Navbar.astro) | Optional: use a contact form/alias, or build the address in JS |

---

## 8. Suggested Fix Order

1. **Quick wins (≈ 1 hour, biggest impact)**
   - S1: write the site description
   - B1: add `getPath()` to wikilink URLs
   - P1: preload Fraunces 600 (or drop 700)
   - I1: remove the unused cover preload (or render the cover)
   - S7: lowercase the host and add the trailing slash in JSON-LD
   - Delete `public/_headers`; add the referrer meta tag
2. **Correctness (½ day)**
   - B2 duplicate H1, B3 excerpt rewrite, B5 comment stripping, B6 Mermaid escaping, B7 external images
   - B4 Unicode slugify + github-slugger anchors (and unify with `validate-vault.mjs`)
   - B9 tag extraction, B10/B11 frontmatter & cover validation
3. **Image quality and bytes (½ day)**
   - I2 JPEG OG covers / non-palette OG cards, I3 LQIP fixes, I4 smarter priority, I5 `sizes`, B12 manifest keys + delete duplicate `.webp`, B13 SVGO
4. **SEO structure (½ day)**
   - S2 user-site `robots.txt` + Search Console verification, S8 noindex thin tags, S9 `CollectionPage` schema, S10 render the cover, S11 extras
5. **Polish**
   - P2 build-time code headers/anchors/external links, P3 italic face, P4 KaTeX `swap`, P5 memoize `getArticles`, accessibility table

After each group, run `pnpm build && pnpm test:seo`, and check one article in **Lighthouse** (mobile) and the [Rich Results Test](https://search.google.com/test/rich-results).
