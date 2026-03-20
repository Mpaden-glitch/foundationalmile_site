/// <reference path="../.astro/types.d.ts" />

/**
 * Cloudflare Pages runtime environment variable bindings.
 * Set these in the Cloudflare Pages dashboard → Settings → Environment Variables.
 */
interface Env {
  /** Cloudflare Turnstile secret key — used to verify bot challenge tokens server-side */
  TURNSTILE_SECRET_KEY: string;
  /** Web3Forms access key — kept server-side, never exposed to the browser */
  WEB3FORMS_ACCESS_KEY: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
