export class PortalError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PortalError';
    this.status = status;
    this.code = code;
  }
}

export function unauthorizedError(): PortalError {
  return new PortalError(401, 'unauthorized', 'Unauthorized.');
}

export function forbiddenError(): PortalError {
  return new PortalError(403, 'forbidden', 'Forbidden.');
}

export function badRequestError(message: string): PortalError {
  return new PortalError(400, 'bad_request', message);
}

export function serverError(message = 'Server configuration error.'): PortalError {
  return new PortalError(500, 'server_error', message);
}

export function coercePortalError(error: unknown): PortalError {
  if (error instanceof PortalError) {
    return error;
  }

  console.error('Unhandled portal error:', error);
  return new PortalError(500, 'internal_error', 'Internal server error.');
}
