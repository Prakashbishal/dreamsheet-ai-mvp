begin;

-- Stage 1 transition migration.
-- Keep the existing INSERT-only "Allow anonymous submissions" policy and the
-- anon table privileges it relies on until the authenticated app is ready for
-- production. Authenticated access is restricted by the ownership policies below.

alter table public.submissions
  add column if not exists user_id uuid null references auth.users(id) on delete cascade;

create index if not exists submissions_user_id_idx
  on public.submissions (user_id);

create index if not exists submissions_user_id_created_at_idx
  on public.submissions (user_id, created_at desc);

alter table public.submissions enable row level security;

grant select, insert, update, delete on table public.submissions to authenticated;

create policy "Authenticated users can view their own DREAMsheets"
  on public.submissions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Authenticated users can create their own DREAMsheets"
  on public.submissions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Authenticated users can update their own DREAMsheets"
  on public.submissions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Authenticated users can delete their own DREAMsheets"
  on public.submissions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
