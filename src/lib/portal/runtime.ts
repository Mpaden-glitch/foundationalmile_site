import { serverError } from './errors';

export function getPortalRuntime(locals: App.Locals): { env: Env; db: Env['DB'] } {
  const runtime = locals.runtime;
  if (!runtime || !runtime.env || !runtime.env.DB) {
    throw serverError('Server configuration error.');
  }

  return {
    env: runtime.env,
    db: runtime.env.DB,
  };
}
