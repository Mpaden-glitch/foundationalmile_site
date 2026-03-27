import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ORIGIN = 'https://foundationalmile.com';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const pagesDir = path.join(projectRoot, 'src', 'pages');
const sitemapPath = path.join(projectRoot, 'public', 'sitemap.xml');

function normalizeRoute(route) {
  if (route !== '/' && route.endsWith('/')) return route.slice(0, -1);
  return route;
}

function routeFromPageFile(filePath) {
  const rel = path.relative(pagesDir, filePath);
  const noExt = rel.replace(/\.astro$/, '');
  const segments = noExt.split(path.sep);

  if (segments[0] === 'api') return null;
  if (segments.some((seg) => seg.startsWith('['))) return null;

  if (segments[segments.length - 1] === 'index') {
    segments.pop();
  }

  const route = `/${segments.join('/')}`.replace(/\/+/g, '/');
  return normalizeRoute(route === '' ? '/' : route);
}

async function walkAstroPages(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkAstroPages(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.astro')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseSitemapRoutes(xml) {
  const routeSet = new Set();
  const locRegex = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  let match;

  while ((match = locRegex.exec(xml)) !== null) {
    try {
      const url = new URL(match[1]);
      routeSet.add(normalizeRoute(url.pathname));
    } catch {
      // Ignore malformed loc entries; they will surface as missing routes below.
    }
  }

  return routeSet;
}

async function main() {
  const pageFiles = await walkAstroPages(pagesDir);
  const expectedRoutes = new Set(
    pageFiles
      .map(routeFromPageFile)
      .filter((route) => route !== null)
      .map((route) => normalizeRoute(route))
  );

  const sitemapXml = await fs.readFile(sitemapPath, 'utf8');
  const sitemapRoutes = parseSitemapRoutes(sitemapXml);

  const missing = [...expectedRoutes].filter((route) => !sitemapRoutes.has(route)).sort();
  const extra = [...sitemapRoutes].filter((route) => !expectedRoutes.has(route)).sort();

  if (missing.length === 0 && extra.length === 0) {
    console.log('Sitemap validation passed.');
    console.log(`Checked ${expectedRoutes.size} routes against ${SITE_ORIGIN}/sitemap.xml`);
    return;
  }

  console.error('Sitemap validation failed.');
  if (missing.length > 0) {
    console.error('Missing routes in sitemap:');
    for (const route of missing) {
      console.error(`  - ${route}`);
    }
  }
  if (extra.length > 0) {
    console.error('Routes present in sitemap but not in src/pages:');
    for (const route of extra) {
      console.error(`  - ${route}`);
    }
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error('Sitemap validation errored:', error);
  process.exitCode = 1;
});
