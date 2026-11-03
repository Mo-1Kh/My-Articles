# Font System Guide

This site uses a modular, self-hosted font system configured exclusively through `site.config.ts`.
Zero external network calls (such as Google Fonts or Typekit) are made at runtime, ensuring optimal privacy, lightning-fast rendering, and zero layout flashes.

---

## Default Typography Rationale

1. **Heading: Fraunces**
   - **Why**: Fraunces is a warm, variable "wonky" serif inspired by early 20th-century type design. Its soft curves, distinctive quirks, and rich letterforms perfectly match the cozy, artisanal feel of the Latte and Espresso coffee palettes.
   - **Weights loaded**: `600` (Semi-bold) and `700` (Bold).

2. **Body: Source Serif 4**
   - **Why**: Designed by Frank Grießhammer for Adobe, Source Serif 4 is engineered specifically for extended screen reading. It offers exceptional legibility at reading sizes (16–18px), humanist proportions, and balanced contrast that feels natural on both light and dark backgrounds.
   - **Weights loaded**: `400` (Regular) and `600` (Semi-bold for emphasis).

3. **Code: JetBrains Mono**
   - **Why**: Created for developers, JetBrains Mono provides clear character distinction (such as `0` vs `O` and `1` vs `l`), consistent tabular figures, and clean horizontal proportioning that makes code snippets in articles effortlessly readable.
   - **Weights loaded**: `400` (Regular) and `500` (Medium).

---

## Configuration Overview (`site.config.ts`)

The `fonts` object in `site.config.ts` governs all typographic properties across the site:

```typescript
// site.config.ts
export const siteConfig = {
  // ...
  fonts: {
    baseFontSize: "17px",
    baseLineHeight: "1.75",
    contentWidth: "700px",
    heading: {
      family: "Fraunces",
      source: "fontsource",
      weights: [600, 700],
      fallback: "Georgia, 'Times New Roman', serif",
    },
    body: {
      family: "Source Serif 4",
      source: "fontsource",
      weights: [400, 600],
      fallback: "'Charter', 'Bitstream Charter', 'Sitka Text', Cambria, serif",
    },
    code: {
      family: "JetBrains Mono",
      source: "fontsource",
      weights: [400, 500],
      fallback: "'Courier New', Courier, monospace",
    },
  },
};
```

---

## How to Customize Fonts

### 1. Changing to Another `@fontsource` Font

To switch to a different open-source font (for example, switching the body font to **Lora**):

1. Install the font package:
   ```bash
   npm install @fontsource/lora
   ```
2. Update `site.config.ts`:
   ```typescript
   body: {
     family: "Lora",
     source: "fontsource",
     weights: [400, 600],
     fallback: "Georgia, serif",
   }
   ```
3. Update `src/components/FontLoader.astro` to import the new font weights:
   ```astro
   import '@fontsource/lora/400.css';
   import '@fontsource/lora/600.css';
   ```

### 2. Adding a Local Font File

If you have custom webfont files (`.woff2` or `.woff`):

1. Place your font file in the `public/fonts/` directory:
   ```
   public/fonts/CustomFont-Regular.woff2
   ```
2. In `src/styles/theme.css`, add the `@font-face` declaration:
   ```css
   @font-face {
     font-family: 'CustomFont';
     src: url('/fonts/CustomFont-Regular.woff2') format('woff2');
     font-weight: 400;
     font-style: normal;
     font-display: swap;
   }
   ```
3. Update `site.config.ts`:
   ```typescript
   heading: {
     family: "CustomFont",
     source: "local",
     weights: [400],
     fallback: "Georgia, serif",
   }
   ```

### 3. Using System Fonts

If you prefer zero webfont downloads for maximum speed:

1. Update `site.config.ts`:
   ```typescript
   body: {
     family: "system-ui",
     source: "system",
     weights: [400, 700],
     fallback: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
   }
   ```

### 4. Changing Font Size, Line Height, or Content Width

Modify the parameters in `site.config.ts`:
```typescript
fonts: {
  baseFontSize: "18px",   // Default is 17px
  baseLineHeight: "1.8",   // Default is 1.75
  contentWidth: "720px",   // Default is 700px
  // ...
}
```

These values are bound directly to CSS custom properties (`--font-size-base`, `--line-height-base`, and `--content-width`) used throughout the layout.
