alter table public.companies add column if not exists settings jsonb not null default '{}';

create or replace function public.save_company_settings(target_company_id uuid,legal_name_value text,display_name_value text,timezone_value text,currency_value text,settings_value jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare fiscal_month int; payment_terms int; mileage_rate numeric; threshold numeric;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator']::public.member_role[]) then raise exception 'Settings administration access required'; end if;
 fiscal_month:=coalesce((settings_value->>'fiscalYearStart')::int,1);payment_terms:=coalesce((settings_value->>'defaultPaymentTerms')::int,30);mileage_rate:=coalesce((settings_value->>'mileageRate')::numeric,0);threshold:=coalesce((settings_value->>'receiptApprovalThreshold')::numeric,0);
 if trim(legal_name_value)='' or trim(display_name_value)='' or trim(timezone_value)='' or currency_value!~'^[A-Z]{3}$' or fiscal_month not between 1 and 12 or payment_terms not between 0 and 365 or mileage_rate<0 or threshold<0 or coalesce(settings_value->>'invoicePrefix','')!~'^[A-Z0-9-]{1,8}$' or coalesce(settings_value->>'loadPrefix','')!~'^[A-Z0-9-]{1,8}$' then raise exception 'Invalid company settings'; end if;
 update public.companies set legal_name=trim(legal_name_value),display_name=trim(display_name_value),timezone=timezone_value,currency_code=currency_value,settings=settings_value,updated_at=now() where id=target_company_id;
 if not found then raise exception 'Company not found'; end if;
end $$;
revoke all on function public.save_company_settings(uuid,text,text,text,text,jsonb) from public,anon;
grant execute on function public.save_company_settings(uuid,text,text,text,text,jsonb) to authenticated;
