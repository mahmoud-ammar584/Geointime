# GeoInTime Commercial Studio

Private workspace for quotations, proposal PDFs, collections, commissions and targets.

## Production architecture

- Next.js 16 / Node.js 22 on Vercel.
- Owner password login with signed, seven-day, HTTP-only, SameSite=Strict cookies. Static workspace assets and API routes require authentication.
- Neon Postgres stores records in `geointime.records`. Server-only `pg` connections use the pooled `DATABASE_URL` and Vercel's `attachDatabasePool`.
- Atomic revision checks prevent one session from overwriting another session's changes.
- Generated proposal versions are archived in Neon's private `assets` bucket. Downloads pass through the authenticated API.
- Pricing, commission policy, proposal design and bundled fonts are preserved.

## Vercel settings

Use the existing `geointime` project, framework Next.js, root directory default, Node.js 22.x, install `pnpm install --frozen-lockfile`, build `pnpm build`.

Configure these server-only variables in Vercel; never commit their values:

| Variable | Purpose |
| --- | --- |
| APP_PASSWORD | Owner password, at least 10 characters |
| SESSION_SECRET | Independent random signing secret, at least 32 characters |
| DATABASE_URL | Pooled Neon Postgres connection |
| DATABASE_URL_UNPOOLED | Direct Neon connection for migrations |
| AWS_ENDPOINT_URL_S3 | Storage endpoint for the same Neon branch |
| AWS_REGION | Neon storage region |
| AWS_ACCESS_KEY_ID | Branch credential with storage read/write access |
| AWS_SECRET_ACCESS_KEY | Corresponding S3 signing secret |

Production and Preview use separate Neon branches and credentials. Keep Vercel deployment protection on Preview; production uses the app's password login.

## Database and local verification

After linking the intended Vercel project and configuring environment variables:

```sh
corepack pnpm install --frozen-lockfile
# Supply a development .env.local using .env.example as the key reference.
corepack pnpm db:migrate
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
corepack pnpm verify:neon
```

The versioned migration is `db/migrations/001_records.sql`. It creates only the private `geointime` schema, table and index. It is safe to rerun and does not delete existing records.

`verify:neon` starts the production build against the configured services, logs in, creates a uniquely named test quote, checks persistence and revision conflicts, generates and archives a PDF, verifies the second download, and removes only its own test row/object.

## Production smoke test

Open `/login`, sign in, save a quotation, reload, edit the quote, and generate/download its PDF. Check the ledger and targets. Anonymous `/api/records` and `/api/proposal` must return 401, while the workspace redirects to login. Cross-origin writes must return 403.

## Data continuity

The former Supabase implementation was replaced by Neon. `supabase-schema.sql` remains only as a historical reference; it is not the Neon migration. Existing data from another host is not part of this repository and requires a separate export/import if present. Never point Preview deployments at production data.

Keep database backups and retain original commercial approval notes; the app does not invent approval for custom pricing, renewal rates or uncertain commission rules.
