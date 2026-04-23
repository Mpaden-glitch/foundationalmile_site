-- Optional local development seed data for portal testing.
-- Apply only to local/dev databases.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (id, email, display_name, created_at, last_seen_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'portal.requester@example.com', 'Portal Requester', 1735689600000, 1735689600000),
  ('22222222-2222-4222-8222-222222222222', 'portal.viewer@example.com', 'Portal Viewer', 1735689600000, 1735689600000);

INSERT OR IGNORE INTO clients (id, name, slug, created_at)
VALUES
  ('33333333-3333-4333-8333-333333333333', 'Example Client', 'example-client', 1735689600000);

INSERT OR IGNORE INTO sites (id, client_id, domain, display_name, created_at)
VALUES
  ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'example-client.org', 'Example Client Main Site', 1735689600000),
  ('55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333', 'staging.example-client.org', 'Example Client Staging Site', 1735689600000);

INSERT OR IGNORE INTO user_site_roles (user_id, site_id, role, granted_by, granted_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 'requester', 'system_seed', 1735689600000),
  ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 'requester', 'system_seed', 1735689600000),
  ('22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', 'viewer', 'system_seed', 1735689600000);

INSERT OR IGNORE INTO requests (id, site_id, submitted_by, title, description, status, created_at, updated_at)
VALUES
  (
    '66666666-6666-4666-8666-666666666666',
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'Homepage copy refresh',
    'Please update the homepage hero copy to match the latest campaign language.',
    'open',
    1735689600000,
    1735689600000
  );
