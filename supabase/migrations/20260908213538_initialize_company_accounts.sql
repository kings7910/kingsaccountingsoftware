CREATE OR REPLACE FUNCTION private.create_company_workspace(company_display_name text, company_legal_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
insert into public.chart_of_accounts(company_id,account_number,name,account_type) select new_company_id,a.number,a.name,a.type::public.account_type from (values ('1000','Cash','asset'),('1100','Accounts receivable','asset'),('1500','Trucks & equipment','asset'),('2000','Accounts payable','liability'),('2200','Equipment loans','liability'),('3000','Owner’s equity','equity'),('4000','Freight revenue','income'),('4900','Other income','income'),('5000','Fuel expense','expense'),('5100','Driver compensation','expense'),('5150','Driver reimbursements','expense'),('5200','Repairs & maintenance','expense'),('5900','General expenses','expense'),('2350','Driver deductions payable','liability')) a(number,name,type) on conflict(company_id,account_number) do nothing;
  return new_company_id;
end;
$function$;


-- Add missing account definitions only; never create opening balances or rewrite existing accounts.
insert into public.chart_of_accounts(company_id,account_number,name,account_type) select c.id,a.number,a.name,a.type::public.account_type from public.companies c cross join (values ('1000','Cash','asset'),('1100','Accounts receivable','asset'),('1500','Trucks & equipment','asset'),('2000','Accounts payable','liability'),('2200','Equipment loans','liability'),('3000','Owner’s equity','equity'),('4000','Freight revenue','income'),('4900','Other income','income'),('5000','Fuel expense','expense'),('5100','Driver compensation','expense'),('5150','Driver reimbursements','expense'),('5200','Repairs & maintenance','expense'),('5900','General expenses','expense'),('2350','Driver deductions payable','liability')) a(number,name,type) on conflict(company_id,account_number) do nothing;
