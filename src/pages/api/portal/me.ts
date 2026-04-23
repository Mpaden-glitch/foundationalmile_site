import type { APIRoute } from 'astro';
import { requirePortalAuth } from '../../../lib/portal/auth';
import { jsonData, jsonPortalError } from '../../../lib/portal/http';
import { getPortalRuntime } from '../../../lib/portal/runtime';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const { env, db } = getPortalRuntime(locals as App.Locals);
    const auth = await requirePortalAuth(request, env, db, { auditBootstrap: true });

    return jsonData({
      user: auth.user,
      sites: auth.authorizedSites,
    });
  } catch (error) {
    return jsonPortalError(error);
  }
};
