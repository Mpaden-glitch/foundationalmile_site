# Foundational Mile LLC — Website

Single-page static site for Foundational Mile LLC, built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com). Designed for deployment on **Cloudflare Pages** (fully static, no server-side dependencies).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Build for production

```bash
npm run build
```

Output is in `dist/`. Deploy that folder to Cloudflare Pages (connect the repo or upload the `dist` directory).

## Deploy to Cloudflare Pages (GitHub → auto deploy)

**1. Push the project to GitHub**

From the project folder:

```bash
cd /Users/brianamartin/Documents/Games/foundationalmile_site
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

(Create the repo on [github.com/new](https://github.com/new) first if needed — no need to add a README if this project already has one.)

**2. Connect the repo to Cloudflare Pages**

1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**.
2. Click **Create** → **Pages** → **Connect to Git**.
3. Choose **GitHub** and authorize Cloudflare if prompted.
4. Select your **repository** and **branch** (e.g. `main`).

**3. Set the build settings**

Use these values (Cloudflare will run the build on every push):

| Field | Value |
|-------|--------|
| **Framework preset** | Astro (or “None”) |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |

Click **Save and Deploy**. Later pushes to `main` will trigger new builds automatically.

You’ll get a URL like `https://your-project.pages.dev`. To use a custom domain, go to **Custom domains** in the project and add it.

## Contact form

The contact form uses **Netlify Forms** syntax as a placeholder (`data-netlify="true"`, hidden `form-name` input). When deploying to Cloudflare Pages, replace with:

- A [Cloudflare Worker](https://workers.cloudflare.com/) that forwards submissions to your email or CRM, or
- [Formspree](https://formspree.io/) (or similar) by updating the form `action` and removing the Netlify attributes.

## Tech stack

- **Astro** — static site generator
- **Tailwind CSS** — styling via `@astrojs/tailwind`
- No external UI libraries; single `src/pages/index.astro` plus config files
