import { defineConfig } from 'astro/config';
import { getSiteOrigin, getBasePath } from './site.config.ts';

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
});
