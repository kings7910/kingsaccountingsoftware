alter table public.driver_settlements add column if not exists details jsonb not null default '{}', add column if not exists paid_on date;

create or replace function public.save_driver_settlement(target_company_id uuid,target_settlement_id uuid,driver_name text,period_start date,period_end date,load_count integer,gross_pay_value numeric,reimbursements_value numeric,deductions_value numeric,status_value public.record_status,paid_date date) returns uuid language plpgsql security invoker set search_path=public as $$
declare result_id uuid; target_driver_id uuid; target_period_id uuid;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','payroll_manager']::public.member_role[]) then raise exception 'Payroll access required'; end if;
 if trim(driver_name)='' or period_start is null or period_end is null or period_end<period_start or load_count<0 or gross_pay_value<0 or reimbursements_value<0 or deductions_value<0 or gross_pay_value+reimbursements_value-deductions_value<0 or status_value not in ('draft','approved','posted') or (status_value='posted' and paid_date is null) then raise exception 'Invalid settlement'; end if;
 select d.id into target_driver_id from public.drivers d join public.profiles p on p.id=d.profile_id where d.company_id=target_company_id and lower(p.full_name)=lower(trim(driver_name)) limit 1;
 if target_driver_id is null then raise exception 'Driver not found'; end if;
 insert into public.payroll_periods(company_id,starts_on,ends_on,pay_date,status) values(target_company_id,period_start,period_end,coalesce(paid_date,period_end),case when status_value='posted' then 'posted'::public.record_status else status_value end) on conflict(company_id,starts_on,ends_on) do update set pay_date=excluded.pay_date returning id into target_period_id;
 if target_settlement_id is null then
  insert into public.driver_settlements(company_id,driver_id,payroll_period_id,gross_pay,authorized_deductions,reimbursements,status,details,paid_on) values(target_company_id,target_driver_id,target_period_id,gross_pay_value,deductions_value,reimbursements_value,status_value,jsonb_build_object('loads',load_count),paid_date) returning id into result_id;
 else
  update public.driver_settlements set driver_id=target_driver_id,payroll_period_id=target_period_id,gross_pay=gross_pay_value,authorized_deductions=deductions_value,reimbursements=reimbursements_value,status=status_value,details=jsonb_build_object('loads',load_count),paid_on=paid_date where id=target_settlement_id and company_id=target_company_id returning id into result_id;
  if result_id is null then raise exception 'Settlement not found'; end if;
 end if;
 return result_id;
end $$;
revoke all on function public.save_driver_settlement(uuid,uuid,text,date,date,integer,numeric,numeric,numeric,public.record_status,date) from public,anon;
grant execute on function public.save_driver_settlement(uuid,uuid,text,date,date,integer,numeric,numeric,numeric,public.record_status,date) to authenticated;

create or replace function public.delete_driver_settlement(target_company_id uuid,target_settlement_id uuid) returns void language plpgsql security invoker set search_path=public as $$
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','payroll_manager']::public.member_role[]) then raise exception 'Payroll access required'; end if;
 if exists(select 1 from public.driver_settlements where id=target_settlement_id and company_id=target_company_id and status='posted') then raise exception 'Paid settlements cannot be deleted'; end if;
 delete from public.driver_settlements where id=target_settlement_id and company_id=target_company_id;
 if not found then raise exception 'Settlement not found'; end if;
end $$;
revoke all on function public.delete_driver_settlement(uuid,uuid) from public,anon;
grant execute on function public.delete_driver_settlement(uuid,uuid) to authenticated;
