import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://foundationalmile.com',
  trailingSlash: 'never',
  integrations: [tailwind()],
  output: 'static',
});
