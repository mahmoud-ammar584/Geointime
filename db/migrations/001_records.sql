-- Run with DATABASE_URL_UNPOOLED; no existing application tables are changed.
CREATE SCHEMA IF NOT EXISTS geointime;
REVOKE ALL ON SCHEMA geointime FROM PUBLIC;
CREATE TABLE IF NOT EXISTS geointime.records (
  owner text NOT NULL,
  id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('quote','settings')),
  data jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner,id)
);
CREATE INDEX IF NOT EXISTS records_owner_created_idx ON geointime.records(owner,created_at DESC);
ALTER TABLE geointime.records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON geointime.records FROM PUBLIC;
-- The application uses the server-only table-owner connection. There is no public Data API.
