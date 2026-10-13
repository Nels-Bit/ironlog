-- Public aggregate only: no account records, identities, or tracking data.
-- Includes accounts awaiting email confirmation; deleted/anonymous users are excluded.
create or replace function public.registered_account_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from auth.users where is_anonymous is not true;
$$;

revoke all on function public.registered_account_count() from public;
grant execute on function public.registered_account_count() to anon, authenticated;
comment on function public.registered_account_count() is
  'Returns only the total number of registered, non-anonymous accounts.';
