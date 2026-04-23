import type {
  AuditLogInput,
  CreateRequestInput,
  PortalAuthorizedSite,
  PortalRequest,
  PortalUser,
} from './types';

const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: number;
  last_seen_at: number;
}

interface AuthorizedSiteRow {
  site_id: string;
  client_id: string;
  client_name: string;
  client_slug: string;
  site_domain: string;
  site_display_name: string;
  role: PortalAuthorizedSite['role'];
}

interface RequestRow {
  id: string;
  site_id: string;
  submitted_by: string;
  title: string;
  description: string;
  status: string;
  created_at: number;
  updated_at: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 200);
}

function mapRequest(row: RequestRow): PortalRequest {
  return {
    id: row.id,
    siteId: row.site_id,
    submittedBy: row.submitted_by,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertUserByEmail(
  db: Env['DB'],
  email: string,
  displayName: string | null,
): Promise<PortalUser> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDisplayName = normalizeDisplayName(displayName);
  const now = Date.now();

  const existing = await db
    .prepare(
      `SELECT id, email, display_name, created_at, last_seen_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
    )
    .bind(normalizedEmail)
    .first<UserRow>();

  if (!existing) {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO users (id, email, display_name, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, normalizedEmail, normalizedDisplayName, now, now)
      .run();

    return {
      id,
      email: normalizedEmail,
      displayName: normalizedDisplayName,
      createdAt: now,
      lastSeenAt: now,
    };
  }

  const shouldUpdateLastSeen = now - existing.last_seen_at >= LAST_SEEN_UPDATE_INTERVAL_MS;
  const shouldUpdateDisplayName =
    normalizedDisplayName !== null &&
    normalizedDisplayName.length > 0 &&
    normalizedDisplayName !== existing.display_name;

  const nextLastSeenAt = shouldUpdateLastSeen ? now : existing.last_seen_at;
  const nextDisplayName = shouldUpdateDisplayName ? normalizedDisplayName : existing.display_name;

  if (shouldUpdateLastSeen || shouldUpdateDisplayName) {
    await db
      .prepare(
        `UPDATE users
         SET display_name = ?, last_seen_at = ?
         WHERE id = ?`,
      )
      .bind(nextDisplayName, nextLastSeenAt, existing.id)
      .run();
  }

  return {
    id: existing.id,
    email: existing.email,
    displayName: nextDisplayName,
    createdAt: existing.created_at,
    lastSeenAt: nextLastSeenAt,
  };
}

export async function listAuthorizedSitesForUser(
  db: Env['DB'],
  userId: string,
): Promise<PortalAuthorizedSite[]> {
  const result = await db
    .prepare(
      `SELECT
         usr.site_id,
         s.client_id,
         c.name AS client_name,
         c.slug AS client_slug,
         s.domain AS site_domain,
         s.display_name AS site_display_name,
         usr.role
       FROM user_site_roles usr
       INNER JOIN sites s ON s.id = usr.site_id
       INNER JOIN clients c ON c.id = s.client_id
       WHERE usr.user_id = ?
       ORDER BY c.name ASC, s.display_name ASC`,
    )
    .bind(userId)
    .all<AuthorizedSiteRow>();

  return (result.results ?? []).map((row) => ({
    id: row.site_id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientSlug: row.client_slug,
    domain: row.site_domain,
    displayName: row.site_display_name,
    role: row.role,
  }));
}

export async function listRequestsForSite(db: Env['DB'], siteId: string): Promise<PortalRequest[]> {
  const result = await db
    .prepare(
      `SELECT id, site_id, submitted_by, title, description, status, created_at, updated_at
       FROM requests
       WHERE site_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(siteId)
    .all<RequestRow>();

  return (result.results ?? []).map(mapRequest);
}

export async function createRequestForSite(
  db: Env['DB'],
  input: CreateRequestInput,
): Promise<PortalRequest> {
  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO requests
       (id, site_id, submitted_by, title, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
    )
    .bind(id, input.siteId, input.submittedBy, input.title, input.description, now, now)
    .run();

  return {
    id,
    siteId: input.siteId,
    submittedBy: input.submittedBy,
    title: input.title,
    description: input.description,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
}

export async function insertAuditLog(db: Env['DB'], entry: AuditLogInput): Promise<void> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();

  await db
    .prepare(
      `INSERT INTO audit_logs
       (id, user_id, client_id, site_id, action, detail, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      entry.userId ?? null,
      entry.clientId ?? null,
      entry.siteId ?? null,
      entry.action,
      entry.detail ?? null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
      createdAt,
    )
    .run();
}
