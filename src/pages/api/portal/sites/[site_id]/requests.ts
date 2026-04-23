import type { APIRoute } from 'astro';
import { assertRequesterRole, assertSiteAccess, requirePortalAuth } from '../../../../../lib/portal/auth';
import { createRequestForSite, insertAuditLog, listRequestsForSite } from '../../../../../lib/portal/db';
import { jsonData, jsonPortalError } from '../../../../../lib/portal/http';
import { getRequestMetadata } from '../../../../../lib/portal/request-meta';
import { getPortalRuntime } from '../../../../../lib/portal/runtime';
import { parseCreateRequestPayload, requireSiteId } from '../../../../../lib/portal/validation';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, params }) => {
  try {
    const { env, db } = getPortalRuntime(locals as App.Locals);
    const auth = await requirePortalAuth(request, env, db);
    const siteId = requireSiteId(params.site_id);
    const role = assertSiteAccess(siteId, auth);

    const requests = await listRequestsForSite(db, siteId);
    return jsonData({ siteId, role, requests });
  } catch (error) {
    return jsonPortalError(error);
  }
};

export const POST: APIRoute = async ({ request, locals, params }) => {
  try {
    const { env, db } = getPortalRuntime(locals as App.Locals);
    const auth = await requirePortalAuth(request, env, db);
    const siteId = requireSiteId(params.site_id);
    const role = assertSiteAccess(siteId, auth);
    assertRequesterRole(role);

    const payload = await parseCreateRequestPayload(request);
    const created = await createRequestForSite(db, {
      siteId,
      submittedBy: auth.user.id,
      title: payload.title,
      description: payload.description,
    });

    const site = auth.authorizedSites.find((candidate) => candidate.id === siteId) ?? null;
    const requestMeta = getRequestMetadata(request);
    await insertAuditLog(db, {
      userId: auth.user.id,
      clientId: site?.clientId ?? null,
      siteId,
      action: 'portal_request_created',
      detail: JSON.stringify({ requestId: created.id }),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return jsonData({ request: created }, 201);
  } catch (error) {
    return jsonPortalError(error);
  }
};
