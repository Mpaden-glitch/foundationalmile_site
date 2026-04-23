import { insertAuditLog, listAuthorizedSitesForUser, upsertUserByEmail } from './db';
import { PortalError, forbiddenError, serverError, unauthorizedError } from './errors';
import type { AccessJwtClaims, PortalAuthContext, PortalRole } from './types';

const ACCESS_JWT_HEADER = 'Cf-Access-Jwt-Assertion';
const DEFAULT_JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

interface AccessJwtHeader {
  alg?: unknown;
  kid?: unknown;
}

interface AccessJwtPayload {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iss?: unknown;
  name?: unknown;
  nbf?: unknown;
}

interface JwksResponse {
  keys?: JsonWebKey[];
}

interface JwksCacheEntry {
  expiresAt: number;
  keysByKid: Map<string, JsonWebKey>;
}

const jwksCache = new Map<string, JwksCacheEntry>();

function getExpectedIssuer(teamName: string): string {
  return `https://${teamName}.cloudflareaccess.com`;
}

function parseCacheMaxAge(cacheControl: string | null): number {
  if (!cacheControl) return DEFAULT_JWKS_CACHE_TTL_MS;

  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return DEFAULT_JWKS_CACHE_TTL_MS;

  const maxAgeSeconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
    return DEFAULT_JWKS_CACHE_TTL_MS;
  }

  return maxAgeSeconds * 1000;
}

function toBase64(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  return `${normalized}${'='.repeat(padLength)}`;
}

function base64UrlToBytes(input: string): Uint8Array {
  const decoded = atob(toBase64(input));
  const bytes = new Uint8Array(decoded.length);

  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function parseJsonBase64Url<T>(input: string): T {
  const text = new TextDecoder().decode(base64UrlToBytes(input));
  return JSON.parse(text) as T;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function getAudiences(aud: unknown): string[] {
  if (typeof aud === 'string') {
    return [aud];
  }

  if (isStringArray(aud)) {
    return aud;
  }

  return [];
}

function getLocalDevBypassEmail(request: Request, env: Env): string | null {
  if (!env.DEV_PORTAL_EMAIL) {
    return null;
  }

  const hostname = new URL(request.url).hostname.toLowerCase();
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

  if (!localHosts.has(hostname)) {
    return null;
  }

  return normalizeEmail(env.DEV_PORTAL_EMAIL);
}

function getRequestIpAddress(request: Request): string | null {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    null
  );
}

function getRequestUserAgent(request: Request): string | null {
  return request.headers.get('User-Agent');
}

async function fetchJwks(env: Env): Promise<JwksCacheEntry> {
  if (!env.CF_ACCESS_TEAM_NAME) {
    throw serverError('Server configuration error.');
  }

  const issuer = getExpectedIssuer(env.CF_ACCESS_TEAM_NAME);
  const certsUrl = `${issuer}/cdn-cgi/access/certs`;
  const response = await fetch(certsUrl, { method: 'GET' });

  if (!response.ok) {
    throw unauthorizedError();
  }

  const jwks = (await response.json()) as JwksResponse;
  const keysByKid = new Map<string, JsonWebKey>();

  for (const key of jwks.keys ?? []) {
    const keyWithKid = key as JsonWebKey & { kid?: unknown };
    if (typeof keyWithKid.kid === 'string' && keyWithKid.kid.length > 0) {
      keysByKid.set(keyWithKid.kid, key);
    }
  }

  return {
    expiresAt: Date.now() + parseCacheMaxAge(response.headers.get('cache-control')),
    keysByKid,
  };
}

async function getJwkByKid(env: Env, kid: string): Promise<JsonWebKey> {
  if (!env.CF_ACCESS_TEAM_NAME) {
    throw serverError('Server configuration error.');
  }

  const issuer = getExpectedIssuer(env.CF_ACCESS_TEAM_NAME);
  const cached = jwksCache.get(issuer);

  if (cached && cached.expiresAt > Date.now() && cached.keysByKid.has(kid)) {
    return cached.keysByKid.get(kid) as JsonWebKey;
  }

  const refreshed = await fetchJwks(env);
  jwksCache.set(issuer, refreshed);

  const key = refreshed.keysByKid.get(kid);
  if (!key) {
    throw unauthorizedError();
  }

  return key;
}

async function verifyJwtSignature(token: string, env: Env): Promise<AccessJwtPayload> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw unauthorizedError();
    }

    const [headerPart, payloadPart, signaturePart] = parts;
    const header = parseJsonBase64Url<AccessJwtHeader>(headerPart);
    const payload = parseJsonBase64Url<AccessJwtPayload>(payloadPart);

    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
      throw unauthorizedError();
    }

    const jwk = await getJwkByKid(env, header.kid);
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify'],
    );

    const signedData = toArrayBuffer(new TextEncoder().encode(`${headerPart}.${payloadPart}`));
    const signature = toArrayBuffer(base64UrlToBytes(signaturePart));

    const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData);
    if (!isValid) {
      throw unauthorizedError();
    }

    return payload;
  } catch (error) {
    if (error instanceof PortalError) {
      throw error;
    }

    throw unauthorizedError();
  }
}

async function verifyAccessJwt(token: string, env: Env): Promise<AccessJwtClaims> {
  if (!env.CF_ACCESS_TEAM_NAME || !env.CF_ACCESS_AUD) {
    throw serverError('Server configuration error.');
  }

  const payload = await verifyJwtSignature(token, env);
  const issuer = getExpectedIssuer(env.CF_ACCESS_TEAM_NAME);

  if (typeof payload.iss !== 'string' || payload.iss !== issuer) {
    throw unauthorizedError();
  }

  const audiences = getAudiences(payload.aud);
  if (!audiences.includes(env.CF_ACCESS_AUD)) {
    throw unauthorizedError();
  }

  if (typeof payload.exp !== 'number') {
    throw unauthorizedError();
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    throw unauthorizedError();
  }

  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== 'number' || payload.nbf > nowSeconds) {
      throw unauthorizedError();
    }
  }

  if (typeof payload.email !== 'string' || payload.email.trim().length === 0) {
    throw unauthorizedError();
  }

  const email = normalizeEmail(payload.email);
  const name = typeof payload.name === 'string' && payload.name.trim().length > 0
    ? payload.name.trim()
    : null;

  return {
    email,
    name,
    iss: payload.iss,
    aud: payload.aud as string | string[],
    exp: payload.exp,
  };
}

export interface RequirePortalAuthOptions {
  auditBootstrap?: boolean;
}

export async function requirePortalAuth(
  request: Request,
  env: Env,
  db: Env['DB'],
  options: RequirePortalAuthOptions = {},
): Promise<PortalAuthContext> {
  let verifiedEmail: string;
  let displayName: string | null = null;
  let authSource = 'cf_access_jwt';

  const devBypassEmail = getLocalDevBypassEmail(request, env);
  if (devBypassEmail) {
    verifiedEmail = devBypassEmail;
    authSource = 'dev_portal_email';
  } else {
    const token = request.headers.get(ACCESS_JWT_HEADER);
    if (!token) {
      throw unauthorizedError();
    }

    const claims = await verifyAccessJwt(token, env);
    verifiedEmail = claims.email;
    displayName = claims.name;
  }

  const user = await upsertUserByEmail(db, verifiedEmail, displayName);
  const authorizedSites = await listAuthorizedSitesForUser(db, user.id);

  if (options.auditBootstrap) {
    await insertAuditLog(db, {
      userId: user.id,
      action: 'portal_access_bootstrap',
      detail: authSource,
      ipAddress: getRequestIpAddress(request),
      userAgent: getRequestUserAgent(request),
    });
  }

  return {
    user,
    authorizedSites,
    authorizedSiteIds: new Set(authorizedSites.map((site) => site.id)),
    roleBySiteId: new Map(authorizedSites.map((site) => [site.id, site.role])),
  };
}

export function assertSiteAccess(siteId: string, auth: PortalAuthContext): PortalRole {
  const role = auth.roleBySiteId.get(siteId);
  if (!role) {
    throw forbiddenError();
  }

  return role;
}

export function assertRequesterRole(role: PortalRole): void {
  if (role !== 'requester') {
    throw forbiddenError();
  }
}
