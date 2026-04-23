import { badRequestError } from './errors';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;

function normalizeInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function requireSiteId(siteId: string | undefined): string {
  const normalized = normalizeInput(siteId);
  if (!normalized) {
    throw badRequestError('Invalid site identifier.');
  }

  return normalized;
}

export interface CreateRequestPayload {
  title: string;
  description: string;
}

export async function parseCreateRequestPayload(request: Request): Promise<CreateRequestPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  let title = '';
  let description = '';

  if (contentType.includes('application/json')) {
    const body = (await request.json()) as { title?: unknown; description?: unknown };
    title = normalizeInput(body.title);
    description = normalizeInput(body.description);
  } else if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData();
    title = normalizeInput(form.get('title'));
    description = normalizeInput(form.get('description'));
  } else {
    throw badRequestError('Unsupported request format.');
  }

  if (!title || !description) {
    throw badRequestError('Title and description are required.');
  }

  if (title.length > MAX_TITLE_LENGTH) {
    throw badRequestError('Title is too long.');
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw badRequestError('Description is too long.');
  }

  return { title, description };
}
