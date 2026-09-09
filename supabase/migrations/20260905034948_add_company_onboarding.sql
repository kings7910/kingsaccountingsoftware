create or replace function public.create_company_workspace(
  company_display_name text,
  company_legal_name text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_company_id uuid;
  clean_display_name text := btrim(company_display_name);
  clean_legal_name text := btrim(coalesce(company_legal_name, company_display_name));
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(clean_display_name) not between 2 and 120 or char_length(clean_legal_name) not between 2 and 180 then
    raise exception 'Enter a valid company name';
  end if;
  if exists (select 1 from public.company_memberships where user_id = current_user_id and is_active) then
    raise exception 'An active company workspace already exists';
  end if;

  insert into public.companies (legal_name, display_name, created_by)
  values (clean_legal_name, clean_display_name, current_user_id)
  returning id into new_company_id;
  insert into public.company_memberships (company_id, user_id, role)
  values (new_company_id, current_user_id, 'owner');
  return new_company_id;
end;
$$;

revoke all on function public.create_company_workspace(text, text) from public;
revoke all on function public.create_company_workspace(text, text) from anon;
grant execute on function public.create_company_workspace(text, text) to authenticated;
