# Obsidian Templater Integration & Writing Workflow

This guide explains how to configure the community **Templater** plugin in your Obsidian vault (`./content`) for fast, consistent article drafting.

---

## 1. Installing Templater in Obsidian

1. In Obsidian, open **Settings** (`Ctrl+,` or `Cmd+,`).
2. Go to **Community plugins** &rarr; Disable **Restricted mode**.
3. Search for **Templater** (by SilentVoid13) and click **Install**, then **Enable**.

---

## 2. Configuring the Template Folder

1. In Obsidian Settings, select **Templater** on the left sidebar.
2. Set **Template folder location** to:
   ```text
   docs/templates
   ```
   *(or copy `docs/templates/article.md` into your preferred templates folder inside `./content`).*
3. Enable **Trigger Templater on new file creation** if you want new files to automatically invoke the template.

---

## 3. Recommended Template Features

The provided template at [`docs/templates/article.md`](templates/article.md) includes:
- **Interactive Title Prompt**: If the file is named `Untitled`, Templater asks for the article title and renames the file automatically.
- **Date Automation**: Injects today's date in `YYYY-MM-DD` format into the `published:` frontmatter field.
- **Draft Toggle**: Defaults to `draft: false`. Set `draft: true` to keep the article hidden in production builds while editing.
- **Obsidian Callouts & Syntax**: Ready-to-use callout block and starter sections.

---

## 4. Frontmatter Reference

All frontmatter fields are strictly optional. The blog pipeline uses sensible defaults:

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | First `# Heading` or filename | Display title for article and SEO tags |
| `description` | `string` | Auto-excerpt (~155 chars) | Summary used for card descriptions and search meta |
| `published` | `string` (`YYYY-MM-DD`) | First Git commit timestamp | Initial publication date |
| `modified` | `string` (`YYYY-MM-DD`) | Latest Git commit timestamp | Updates "Modified <date>" only if on a subsequent calendar day |
| `draft` | `boolean` | `false` | When `true`, hides article from production builds |
| `tags` | `string[]` | Inline `#tags` | Topic tags for RSS categories and meta tags |
| `cover` | `string` | Auto-generated coffee OG card | Path or URL to custom share image |
| `minor` | `boolean` | `false` | When `true`, commit edits do not update `modified` date |

---

## 5. CLI Alternative

If you prefer terminal commands over Obsidian UI prompts, use the built-in scaffolding CLI:

```bash
# Create a new article under content/coffee/
pnpm run new "Dialing Espresso Ratios" --category coffee --tags espresso,technique

# Create a draft article under content/writing/
pnpm run new "The Quiet Power of Habit" --draft
```
