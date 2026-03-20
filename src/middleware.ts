import { defineMiddleware } from 'astro:middleware';

/**
 * Security headers middleware.
 * Applied to all HTML responses only — skips static assets (JS, CSS, images).
 */
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();

  // Only apply headers to HTML responses
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const csp = [
    "default-src 'self'",
    // Turnstile script from Cloudflare only — no unsafe-inline needed since Astro bundles scripts
    "script-src 'self' https://challenges.cloudflare.com",
    // Tailwind uses inline <style> blocks via is:global — unsafe-inline required for styles
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // No direct browser calls to third-party APIs — form goes through /api/contact
    "connect-src 'self' https://challenges.cloudflare.com",
    "img-src 'self' data:",
    // Turnstile renders its challenge UI inside an iframe served from Cloudflare
    "frame-src https://challenges.cloudflare.com",
    // Form submissions only allowed to our own origin
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', csp);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
