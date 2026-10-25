-- Apply once in a dedicated Supabase project (SQL Editor). No sample customer data.
create table if not exists public.records (
 owner text not null,
 id text not null,
 kind text not null check (kind in ('quote','settings')),
 data jsonb not null,
 revision integer not null default 1 check (revision >= 1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (owner,id)
);
create index if not exists records_owner_created_idx on public.records(owner,created_at desc);
alter table public.records enable row level security;
-- There are deliberately no anon/authenticated policies: only the server-side
-- service-role token may read/write; it must NEVER be exposed to the browser.
revoke all on table public.records from anon,authenticated;
