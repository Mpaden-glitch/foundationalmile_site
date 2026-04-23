import { coercePortalError } from './errors';

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonData<T>(data: T, status = 200): Response {
  return json({ data }, status);
}

export function jsonPortalError(error: unknown): Response {
  const portalError = coercePortalError(error);
  return json(
    {
      error: {
        code: portalError.code,
        message: portalError.message,
      },
    },
    portalError.status,
  );
}
