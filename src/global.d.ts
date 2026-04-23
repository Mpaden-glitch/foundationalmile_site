/** Cloudflare Turnstile widget — loaded via external script on the contact page */
interface TurnstileWidget {
  reset(widgetId?: string): void;
  getResponse(widgetId?: string): string | undefined;
}

interface Window {
  turnstile?: TurnstileWidget;
}

interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
