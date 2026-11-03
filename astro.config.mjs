import { defineConfig } from 'astro/config';
import { getSiteOrigin, getBasePath } from './site.config.ts';
import { remarkObsidian } from './src/plugins/remark-obsidian.ts';
import { rehypeObsidianCallouts } from './src/plugins/rehype-obsidian-callouts.ts';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  site: getSiteOrigin(),
  base: getBasePath(),
  output: 'static',
  build: {
    format: 'directory',
  },
  server: {
    port: 4321,
    host: true,
  },
  markdown: {
    remarkPlugins: [remarkObsidian, remarkMath],
    rehypePlugins: [rehypeObsidianCallouts, rehypeKatex],
    shikiConfig: {
      theme: 'css-variables',
      wrap: true,
    },
  },
});
