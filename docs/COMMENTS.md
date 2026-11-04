# Setting Up Giscus Comments (GitHub Discussions)

Mo's Articles uses [Giscus](https://giscus.app) to provide privacy-friendly, zero-tracking comments powered entirely by GitHub Discussions.

Comments are:
- **Lazy-Loaded**: Only initialized when a reader scrolls near the bottom of an article (`IntersectionObserver`), ensuring zero impact on initial page speed.
- **Theme-Synchronized**: Automatically switch between Latte (light) and Espresso (dark) coffee themes via `postMessage`.
- **Configurable**: Can be globally toggled or disabled per-article via frontmatter `comments: false`.
- **Zero-Failure**: If disabled or IDs are empty, the blog compiles cleanly and renders nothing.

---

## 1. Prerequisites (One-Time Setup)

### Step 1: Enable GitHub Discussions on your Repository
1. On GitHub, navigate to your repository (e.g. `https://github.com/Mo-1Kh/My-Articles`).
2. Go to **Settings** &rarr; **General**.
3. Under the **Features** section, check the box for **Discussions**.
4. Click **Set up discussions** to initialize the default categories.

### Step 2: Install the Giscus GitHub App
1. Visit the [Giscus App page](https://github.com/apps/giscus).
2. Click **Install**.
3. Choose **Only select repositories** and select your blog repository (`My-Articles`).
4. Click **Install & Authorize**.

---

## 2. Obtaining your Giscus Repository & Category IDs

1. Open [giscus.app](https://giscus.app).
2. In the **Repository** section, enter your repository name:
   ```text
   Mo-1Kh/My-Articles
   ```
   *(Ensure your repository is **public** so readers can view and post comments).*
3. Under **Page ↔ Discussions Mapping**, select:
   ```text
   Discussion title contains page pathname
   ```
4. Under **Discussion Category**, select:
   ```text
   Announcements
   ```
   *(Using Announcements ensures that only discussion threads created by Giscus can be written to, avoiding clutter in other categories).*
5. Scroll down to the **Enable Giscus** code snippet. Look for the following two values:
   - `data-repo-id="R_kgDO..."`
   - `data-category-id="DIC_kwDO..."`

---

## 3. Configuring `site.config.ts`

Open `site.config.ts` and update the `comments` configuration:

```typescript
// site.config.ts
export const siteConfig: SiteConfig = {
  // ...
  comments: {
    enabled: true,                // Set to true to activate comments
    provider: "giscus",
    repo: "Mo-1Kh/My-Articles",
    repoId: "R_kgDOXXXXXXXX",     // Your data-repo-id from giscus.app
    category: "Announcements",
    categoryId: "DIC_kwDOXXXXXXXX", // Your data-category-id from giscus.app
    mapping: "pathname",
    reactionsEnabled: true,
    emitMetadata: false,
    theme: "preferred_color_scheme",
  },
  // ...
};
```

---

## 4. Disabling Comments on Specific Articles

To disable comments on any individual article (e.g., announcements, personal notes, or drafts), simply add `comments: false` to its frontmatter:

```markdown
---
title: "A Reflection on Simplicity"
published: "2026-05-01"
comments: false
---

Content goes here...
```

Comments will never be rendered on the Home page, the 404 page, or the Style Guide.

---

## 5. Author Moderation & Replying

Because Giscus is built directly on GitHub Discussions:
1. Whenever a reader posts a comment, a new discussion thread is created under the **Announcements** tab of your repository.
2. You will receive standard GitHub notifications for new comments and replies.
3. You can reply directly on your blog or from the GitHub Discussions UI.
4. As the repository owner, you have full moderation capabilities: editing, hiding, locking, or deleting comments directly on GitHub.
