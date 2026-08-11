begin;

-- Existing rows and legacy inserts remain completed by default. Draft rows are
-- created explicitly by the authenticated application.
alter table public.submissions
  add column if not exists status text not null default 'completed',
  add column if not exists updated_at timestamptz not null default now();

alter table public.submissions
  alter column status set default 'completed',
  alter column status set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.submissions'::regclass
      and conname = 'submissions_status_check'
  ) then
    alter table public.submissions
      add constraint submissions_status_check
      check (status in ('draft', 'completed'));
  end if;
end
$migration$;

create index if not exists submissions_user_status_updated_at_idx
  on public.submissions (user_id, status, updated_at desc);

create or replace function public.set_submissions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists submissions_set_updated_at on public.submissions;

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row
  execute function public.set_submissions_updated_at();

commit;
