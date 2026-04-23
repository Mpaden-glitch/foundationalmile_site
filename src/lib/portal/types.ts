export type PortalRole = 'viewer' | 'requester';

export interface PortalUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: number;
  lastSeenAt: number;
}

export interface PortalAuthorizedSite {
  id: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  domain: string;
  displayName: string;
  role: PortalRole;
}

export interface PortalRequest {
  id: string;
  siteId: string;
  submittedBy: string;
  title: string;
  description: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface PortalAuthContext {
  user: PortalUser;
  authorizedSites: PortalAuthorizedSite[];
  authorizedSiteIds: Set<string>;
  roleBySiteId: Map<string, PortalRole>;
}

export interface AccessJwtClaims {
  email: string;
  name: string | null;
  iss: string;
  aud: string | string[];
  exp: number;
}

export interface CreateRequestInput {
  siteId: string;
  submittedBy: string;
  title: string;
  description: string;
}

export interface AuditLogInput {
  userId?: string | null;
  clientId?: string | null;
  siteId?: string | null;
  action: string;
  detail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
