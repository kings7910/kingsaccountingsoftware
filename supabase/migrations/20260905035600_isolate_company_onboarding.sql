-- Keep the authenticated API as an invoker wrapper; only the private
-- implementation needs elevated privileges to create the first membership.
alter function public.create_company_workspace(text,text) set schema private;
create function public.create_company_workspace(company_display_name text,company_legal_name text default null)
returns uuid language sql security invoker set search_path='' as $$
 select private.create_company_workspace(company_display_name,company_legal_name);
$$;
revoke all on function public.create_company_workspace(text,text) from public,anon;
grant execute on function public.create_company_workspace(text,text) to authenticated;
create index driver_submission_company_load_idx on private.driver_submission_requests(company_id,load_id);
