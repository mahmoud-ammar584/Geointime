# GeoInTime Commercial Studio — Vercel-ready source

Private, single-owner workspace for pricing, quotations, proposal PDFs (using the supplied original design), CRM records, collections, commission reporting, quarter targets and conditional salary estimates.

## Deployment architecture

- **Next.js 16 (Node runtime)** on Vercel; no Cloudflare Worker, Vinext or D1 binding.
- **Private password login** with a signed, seven-day, HTTP-only, SameSite=Strict cookie. The entire workspace and its static resources are protected by the Next.js `proxy.ts`; API routes independently check the signed session. Never trust client-supplied identity headers on Vercel.
- **Dedicated Supabase Postgres** for cross-device persistent storage. Server uses PostgREST with service-role credential stored only in server-side environment variables. No Supabase credentials are shipped to the browser. Service-role key must not be stored in Git.
- **Optimistic concurrency:** per-record revision checks, and revision-conditional updates. No first-run sample deals are inserted.
- **PDF generation server-side**, from persisted, validated quotes; the supplied template and fonts are included in source.
- **Noindex** private workspace; public GitHub repository metadata still remains public unless you change GitHub visibility.

## One-time setup

1. Create a **new dedicated Supabase project** (do not reuse BNormalized/Sarih databases). In Supabase SQL Editor, execute `supabase-schema.sql` once.
2. In **Vercel**, import this GitHub repository with framework preset `Next.js`, Root Directory `.`, build `pnpm build`, output framework default. Node.js **22.x**. The default production branch is `main`.
3. In Vercel → Project → Settings → Environment Variables add the **four required secrets/settings** from `.env.example` (for Production and Preview, or only the environments you intend to use):
   - `APP_PASSWORD`: unique, high-entropy **16+ character** owner-only password, not reused on other websites.
   - `SESSION_SECRET`: independent random **32+ character** value. Rotating it signs out all sessions.
   - `SUPABASE_URL`: the new project's `https://<ref>.supabase.co` base URL.
   - `SUPABASE_SECRET_KEY`: **secret** `sb_secret_...` credential from the new Supabase project. **Never prefix with `NEXT_PUBLIC_` or share it with the client.**
4. Deploy, open `/login`, sign in, create a test quotation, reload the page, export PDF, and inspect quota/commission views. Confirm that visiting `/studio.html` and `/api/records` without a session redirects to login/returns HTTP 401.

To generate secrets locally (paste generated values directly into Vercel; never commit them):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use **different** generated values for `APP_PASSWORD` and `SESSION_SECRET`.

## Run locally

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
# Fill .env.local with dev credentials and a dedicated test database.
pnpm dev
```

For tests (tests don't require running database):

```bash
node --test tests/*.test.mjs
pnpm exec tsc --noEmit
pnpm build
```

## Product policy preserved

- Three subscription tiers: 30–49, 50–99, 100+ billed employees. Essentials, Essentials + Operations and Full.
- Annual 0% uplift, quarterly/semiannual 3%, monthly 8%.
- Separate implementation, optional Locator hardware (editable starting reference EGP 2,700 per device), extras, commercial discount approval and tax assumptions.
- Discount never silently applies to one-off hardware and implementation. Quotation data and computed snapshots are validated server-side.
- Saved quotes and closing/monthly reports preserve commissions, collection entries, salary retroactivity and user-editable quarter targets.
- The PDF uses the actual supplied EGY Sales-Proposal design. Visual output should be rechecked after deployment, especially customer name rendering.
- Commercial policy ambiguity is not magically resolved: for some semiannual commission and complex exception rules, management confirmation is required.

## Data/security considerations

- This app is not multi-user SaaS; it is one-password owner-only. Disable public GitHub repo visibility if you don't want source defaults (e.g. sales targets and commercial rates) visible publicly.
- Backup the dedicated Supabase database regularly. The ZIP/Git source **does not contain** the hosted database and does not automatically migrate records from the previous hosting database.
- The Vercel project will show an explicit storage error until the Supabase env variables and schema are configured. It will not silently use ephemeral memory or browser localStorage.
- For production, enable Vercel observability and consider upstream rate limiting for `/api/auth/login` (a long randomly generated password is mandatory; no distributed failed-login limiter is implemented).
