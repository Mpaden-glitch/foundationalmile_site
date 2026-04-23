export function getRequestMetadata(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const ipAddress =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    null;

  const userAgent = request.headers.get('User-Agent');

  return { ipAddress, userAgent };
}
