-- "Start fresh": wipe all data a household owner inserted and send them back
-- through the onboarding wizard, WITHOUT deleting the household itself (so the
-- space id, currency and membership stay stable). SECURITY DEFINER so it can
-- delete across every child table in one atomic call; an internal owner check
-- keeps it safe, and it is only granted to authenticated users.
create or replace function public.reset_household(hh uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  -- Tables we deliberately keep: the people, pending invites, this device's
  -- push registration, and the AI credit-usage counter (so a reset can't be
  -- used to wipe the quota).
  excluded text[] := array[
    'household_members',
    'household_invitations',
    'push_subscriptions',
    'credit_usage'
  ];
begin
  if not exists (
    select 1 from public.household_members
    where household_id = hh
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Only a household owner can reset the household.';
  end if;

  -- Delete in any order without tripping foreign keys during the bulk wipe.
  set local session_replication_role = 'replica';

  for r in
    select distinct c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'household_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name <> all (excluded)
  loop
    execute format('delete from public.%I where household_id = $1', r.table_name) using hh;
  end loop;

  set local session_replication_role = 'origin';

  -- Back to a first-run state: the onboarding wizard triggers on null onboarded_at.
  update public.households
     set onboarded_at = null,
         baseline_budget = 0
   where id = hh;
end;
$$;

revoke all on function public.reset_household(uuid) from public;
grant execute on function public.reset_household(uuid) to authenticated;
