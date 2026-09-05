begin;
select plan(8);

select ok(not exists (
  select 1 from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
), 'every public table has row-level security enabled');

select ok(not exists (
  select 1 from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and not has_table_privilege('authenticated', c.oid, 'SELECT')
), 'authenticated users can reach every public table through the Data API');

select ok(has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated users can resolve private RLS helpers');

select ok(
  has_function_privilege('authenticated', 'private.is_company_member(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.has_company_role(uuid,public.member_role[])', 'EXECUTE'),
  'authenticated users can execute membership RLS helpers');

select ok(
  not has_function_privilege('anon', 'private.is_company_member(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.has_company_role(uuid,public.member_role[])', 'EXECUTE'),
  'anonymous users cannot execute membership RLS helpers');

select ok(not exists (
  select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.prosecdef
    and p.proconfig is distinct from array['search_path=""']::text[]
), 'security-definer helpers use an empty search path');

select ok(
  has_function_privilege('authenticated', 'public.create_company_workspace(text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_company_workspace(text,text)', 'EXECUTE'),
  'only authenticated users can call company onboarding');

select ok(exists (
  select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'create_company_workspace'
    and p.prosecdef and p.proconfig = array['search_path=""']::text[]
 ) and exists (
  select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='create_company_workspace' and not p.prosecdef
    and p.proconfig=array['search_path=""']::text[]
), 'company onboarding uses a private privileged implementation and safe public wrapper');

select * from finish();
rollback;
