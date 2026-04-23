/// <reference path="../.astro/types.d.ts" />

type D1Database = import('@cloudflare/workers-types').D1Database;

/**
 * Cloudflare Pages runtime environment variable bindings.
 * Set these in the Cloudflare Pages dashboard → Settings → Environment Variables.
 */
interface Env {
  /** D1 binding for the portal data layer */
  DB: D1Database;
  /** Cloudflare Access team name, used to fetch Access JWKS certs */
  CF_ACCESS_TEAM_NAME: string;
  /** Cloudflare Access application audience value */
  CF_ACCESS_AUD: string;
  /**
   * Local-only portal dev bypass identity.
   * Only honored for localhost requests.
   */
  DEV_PORTAL_EMAIL?: string;
  /** Cloudflare Turnstile secret key — used to verify bot challenge tokens server-side */
  TURNSTILE_SECRET_KEY: string;
  /** Resend API key used server-side to deliver contact form messages */
  RESEND_API_KEY: string;
  /** Sender identity configured in Resend, e.g. "Foundational Mile <contact@yourdomain.com>" */
  RESEND_FROM_EMAIL: string;
  /** Destination inbox for contact form submissions */
  CONTACT_TO_EMAIL: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
