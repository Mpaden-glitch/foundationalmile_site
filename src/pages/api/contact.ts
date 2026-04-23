import type { APIRoute } from 'astro';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

/**
 * Simple in-memory rate limit: max 5 submissions per IP per hour.
 *
 * Cloudflare Workers may run multiple instances so this is not a strict global
 * rate limit — Turnstile is the primary bot defense. This is an additional layer.
 */
const submissionLog = new Map<string, number[]>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (submissionLog.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  submissionLog.set(ip, recent);
  return true;
}

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
    'unknown';

  if (!checkRateLimit(ip)) {
    return json({ success: false, message: 'Too many requests. Please try again later.' }, 429);
  }

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return json({ success: false, message: 'Invalid request body.' }, 400);
  }

  const name = body.get('name')?.toString().trim() ?? '';
  const email = body.get('email')?.toString().trim() ?? '';
  const organization = body.get('organization')?.toString().trim() ?? '';
  const message = body.get('message')?.toString().trim() ?? '';
  const turnstileToken = body.get('cf-turnstile-response')?.toString() ?? '';

  // Required field validation
  if (!name || !email || !message) {
    return json({ success: false, message: 'Name, email, and message are required.' }, 400);
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ success: false, message: 'Please enter a valid email address.' }, 400);
  }

  // Field length limits
  if (
    name.length > 200 ||
    email.length > 200 ||
    organization.length > 200 ||
    message.length > 5000
  ) {
    return json({ success: false, message: 'One or more fields exceed the allowed length.' }, 400);
  }

  // Turnstile token must be present
  if (!turnstileToken) {
    return json({ success: false, message: 'Bot verification is required.' }, 400);
  }

  // Validate Turnstile token server-side against Cloudflare's API
  const runtime = (locals as App.Locals).runtime;
  if (!runtime?.env) {
    console.error('Astro Cloudflare runtime env is not available');
    return json({ success: false, message: 'Server configuration error.' }, 500);
  }

  const { env } = runtime;

  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  if (!turnstileSecret) {
    console.error('TURNSTILE_SECRET_KEY environment variable is not configured');
    return json({ success: false, message: 'Server configuration error.' }, 500);
  }

  let turnstileDataSuccess = false;
  try {
    const turnstileRes = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: turnstileSecret, response: turnstileToken, remoteip: ip }),
    });

    if (!turnstileRes.ok) {
      console.error('Turnstile verification request failed:', turnstileRes.status);
      return json({ success: false, message: 'Verification service is unavailable.' }, 502);
    }

    const turnstileData = await turnstileRes.json() as { success?: unknown };
    turnstileDataSuccess = turnstileData.success === true;
  } catch (error) {
    console.error('Turnstile verification network error:', error);
    return json({ success: false, message: 'Verification service is unavailable.' }, 502);
  }

  if (!turnstileDataSuccess) {
    return json({ success: false, message: 'Bot verification failed. Please try again.' }, 400);
  }

  // Forward to Web3Forms with the access key kept server-side
  const accessKey = env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) {
    console.error('WEB3FORMS_ACCESS_KEY environment variable is not configured');
    return json({ success: false, message: 'Server configuration error.' }, 500);
  }

  const formData = new FormData();
  formData.append('access_key', accessKey);
  formData.append('subject', 'New Contact Form Submission — Foundational Mile');
  formData.append('from_name', 'Foundational Mile Website');
  formData.append('name', name);
  formData.append('email', email);
  if (organization) formData.append('organization', organization);
  formData.append('message', message);

  try {
    const web3Res = await fetch(WEB3FORMS_URL, { method: 'POST', body: formData });
    if (!web3Res.ok) {
      console.error('Web3Forms request failed with status:', web3Res.status);
      return json({ success: false, message: 'Failed to send. Please try again or email us directly.' }, 502);
    }

    const web3Data = await web3Res.json() as { success?: unknown };
    if (web3Data.success === true) {
      return json({ success: true, message: "Message sent. We'll be in touch soon." }, 200);
    }
  } catch (error) {
    console.error('Web3Forms network error:', error);
    return json({ success: false, message: 'Failed to send. Please try again or email us directly.' }, 502);
  }

  return json({ success: false, message: 'Failed to send. Please try again or email us directly.' }, 502);
};
