-- Task 6.4W follow-up hardening after 0005 was exercised locally.
-- Rollback: use a reviewed forward migration to restore the previous fixed search path only if
-- a documented PostgreSQL compatibility issue requires it. Never rewrite either applied file.

alter function public.refresh_signature_practice_summary()
  set search_path = pg_catalog, pg_temp;
