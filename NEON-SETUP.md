# GeoInTime on Neon

The app stays on Next.js/Vercel. Neon Postgres stores quotes and targets in `geointime.records`; the private `assets` bucket stores generated PDF versions. All reads and writes go through authenticated Next.js handlers. The original proposal template and fonts are unchanged.

## Provision

```sh
npx neon@latest init -y --org-id org-frosty-sound-49278805 --project-id damp-feather-96963980 --branch production --services postgres,object-storage
npx neon@latest config plan
npx neon@latest deploy
npm run db:migrate
npm run build
npm start
```

Complete `neon login` if requested. The `neon.ts` config declares the private `assets` bucket. Object Storage needs a supported Neon project region. Postgres application traffic uses `pg` with a pooled `DATABASE_URL` and Vercel's `attachDatabasePool`. Migrations use `DATABASE_URL_UNPOOLED`.

`neon deploy` provisions services and pulls their variables into `.env.local` (or `.env` when it exists); it does not publish the Next.js frontend. Keep your existing `APP_PASSWORD` and `SESSION_SECRET`. Add all Neon variables from `.env.example` to the Vercel project/account you actually deploy, then redeploy that app. No credentials belong in GitHub.

## Verify real services

```sh
npm run verify:neon
```

This starts the production app with a generated test login, creates one uniquely named test quotation through HTTP, reads it, tests revision conflicts, generates a PDF, verifies the private S3 object against the response, downloads it through the authenticated app again, then removes only its own test row and object. It requires the migrated live database and storage credentials; it does not substitute mocks for the real services.

## Existing Supabase data

Creating a Neon schema does not move existing Supabase records. Before switching production, export/import existing records with their owner/id/revision and timestamps, then verify row counts and representative PDFs. Keep Supabase available until this is verified. Do not remove old credentials or change the production datasource until migration and end-to-end verification pass.
