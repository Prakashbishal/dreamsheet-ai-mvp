begin;

-- Stage 2 production cutover migration.
-- Apply only immediately before or with deployment of the authenticated app.
-- Until then, the current production app depends on the legacy anonymous INSERT
-- policy retained by the Stage 1 transition migration.

drop policy if exists "Allow anonymous submissions"
  on public.submissions;

revoke all on table public.submissions from anon;

-- Authenticated ownership policies and legacy rows are intentionally unchanged.

commit;
