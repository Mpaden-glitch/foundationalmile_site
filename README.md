# Foundational Mile Website + Portal

Astro SSR website for Foundational Mile, deployed to Cloudflare. The public marketing site remains unchanged, and a lean Phase 1 client portal is available under `/portal/*`.

## Tech stack

- Astro 5 + Tailwind
- Cloudflare adapter (`output: 'server'`)
- Cloudflare Access (outer auth)
- Cloudflare D1 (portal data)

## Install

```bash
npm install
```

## Required environment variables

Set these in Cloudflare for deployed environments, and in `.dev.vars` for local Worker runtime:

- `TURNSTILE_SECRET_KEY`
- `PUBLIC_TURNSTILE_SITE_KEY`
- `WEB3FORMS_ACCESS_KEY`
- `CF_ACCESS_TEAM_NAME`
- `CF_ACCESS_AUD`
- `DEV_PORTAL_EMAIL` (optional, localhost-only dev bypass)

A starter file is included at `.dev.vars.example`.

Contact form notes:

- `PUBLIC_TURNSTILE_SITE_KEY` is the browser/site key rendered on the contact page.
- `TURNSTILE_SECRET_KEY` must be the matching secret for that same Turnstile widget.

## D1 setup

1. Create a D1 database:

```bash
npx wrangler d1 create foundationalmile-portal
```

2. Copy the returned database ID into `wrangler.jsonc` under `d1_databases[0].database_id`.

3. Apply the schema migration:

```bash
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote
```

4. Optional local seed data:

```bash
npx wrangler d1 execute DB --local --file seeds/portal.dev.sql
```

## Cloudflare Access expectations

Create a Cloudflare Access application that protects:

- `/portal*`
- `/api/portal*`

Then set:

- `CF_ACCESS_TEAM_NAME` to your team name
- `CF_ACCESS_AUD` to that Access application's audience value

The app verifies `Cf-Access-Jwt-Assertion` against Access JWKS (`/cdn-cgi/access/certs`) and trusts only verified email from the JWT.

## Local development workflow

For public-page-only iteration you can still use:

```bash
npm run dev
```

For portal testing (auth + D1 + Worker runtime):

1. Create `.dev.vars` from `.dev.vars.example`.
2. Build once:

```bash
npm run build
```

3. Run Worker locally:

```bash
npx wrangler dev --local --persist-to .wrangler/state
```

4. Visit `http://127.0.0.1:8787/portal`.

Note: `DEV_PORTAL_EMAIL` bypass is only honored for localhost hostnames and is ignored for non-local hosts.

## Build

```bash
npm run build
```

## Checks

```bash
npm run check
npm run lint
npm run check:sitemap
```

## Deploy

Deploy with Cloudflare Pages/Workers using this repo and ensure all runtime vars + D1 binding are configured in the target environment.
