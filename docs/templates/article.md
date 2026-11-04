<%*
let title = tp.file.title;
if (!title || title.startsWith("Untitled")) {
  title = await tp.system.prompt("Article Title:");
  if (title) {
    await tp.file.rename(title);
  } else {
    title = "Untitled Article";
  }
}
_%>---
title: "<% title %>"
description: ""
published: "<% tp.date.now("YYYY-MM-DD") %>"
tags: []
draft: false
---

# <% title %>

> [!note] Summary
> A brief introductory thought or abstract of this article.

Write your article here using standard Markdown and Obsidian features:
- [[wikilinks]]
- Images with optional width `![[image.png|400]]`
- Callouts `> [!tip]`, `> [!warning]`, etc.
- Math expressions `$E = mc^2$`
- Code blocks with syntax highlighting
- Tag concepts with `#tags`
