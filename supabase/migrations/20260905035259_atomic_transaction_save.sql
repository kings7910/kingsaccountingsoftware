create or replace function public.save_transaction(
 target_company_id uuid,target_record_id uuid,previous_kind text,new_kind text,
 transaction_date date,partner_name text,description_value text,amount_value numeric,status_value public.record_status
) returns uuid language plpgsql security invoker set search_path='' as $$
declare target_table text;previous_table text;partner_table text;partner_column text;date_column text;partner uuid;result uuid;found_id uuid;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
 if new_kind not in ('income','expense') or (target_record_id is not null and coalesce(previous_kind,'') not in ('income','expense')) or transaction_date is null or coalesce(trim(partner_name),'')='' or coalesce(trim(description_value),'')='' or amount_value is null or amount_value<=0 or amount_value::text in ('NaN','Infinity','-Infinity') or status_value is null then raise exception 'Invalid transaction';end if;
 target_table:=case new_kind when 'income' then 'income' else 'expenses' end;
 partner_table:=case new_kind when 'income' then 'customers' else 'vendors' end;
 partner_column:=case new_kind when 'income' then 'customer_id' else 'vendor_id' end;
 date_column:=case new_kind when 'income' then 'received_on' else 'occurred_on' end;
 if target_record_id is not null then
  previous_table:=case previous_kind when 'income' then 'income' else 'expenses' end;
  execute format('select id from public.%I where id=$1 and company_id=$2 for update',previous_table) into found_id using target_record_id,target_company_id;
  if found_id is null then raise exception 'Transaction not found';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(target_company_id::text||partner_table||lower(trim(partner_name)),0));
 execute format('select id from public.%I where company_id=$1 and lower(name)=lower($2) order by id limit 1',partner_table) into partner using target_company_id,trim(partner_name);
 if partner is null then execute format('insert into public.%I(company_id,name) values($1,$2) returning id',partner_table) into partner using target_company_id,trim(partner_name);end if;
 if target_record_id is not null and previous_kind=new_kind then
  execute format('update public.%I set %I=$1,%I=$2,description=$3,amount=$4,status=$5,updated_at=now() where id=$6 and company_id=$7 returning id',target_table,partner_column,date_column)
   into result using partner,transaction_date,trim(description_value),amount_value,status_value,target_record_id,target_company_id;
 else
  execute format('insert into public.%I(company_id,%I,%I,description,amount,status,created_by) values($1,$2,$3,$4,$5,$6,$7) returning id',target_table,partner_column,date_column)
   into result using target_company_id,partner,transaction_date,trim(description_value),amount_value,status_value,auth.uid();
  if target_record_id is not null then
   execute format('delete from public.%I where id=$1 and company_id=$2 returning id',previous_table) into found_id using target_record_id,target_company_id;
   if found_id is null then raise exception 'Transaction type change is not permitted';end if;
  end if;
 end if;
 if result is null then raise exception 'Transaction was not saved';end if;
 return result;
end $$;
revoke all on function public.save_transaction(uuid,uuid,text,text,date,text,text,numeric,public.record_status) from public,anon;
grant execute on function public.save_transaction(uuid,uuid,text,text,date,text,text,numeric,public.record_status) to authenticated;
create or replace function private.is_own_driver(target_driver uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.drivers d where d.id=target_driver and d.profile_id=(select auth.uid()) and d.status='active' and private.is_company_member(d.company_id));
$$;
create or replace function private.can_review_approval(target_company uuid,kind text) returns boolean language sql stable security invoker set search_path='' as $$
 select private.has_company_role(target_company,
 case kind
 when 'fuel_entry' then array['owner','administrator','accountant','fleet_manager']::public.member_role[]
 when 'mileage_log' then array['owner','administrator','dispatcher','fleet_manager']::public.member_role[]
 when 'receipt' then array['owner','administrator','accountant','dispatcher','fleet_manager']::public.member_role[]
 when 'expense' then array['owner','administrator','accountant']::public.member_role[]
 when 'driver_settlement' then array['owner','administrator','payroll_manager']::public.member_role[]
 else array['owner','administrator']::public.member_role[] end);
$$;
revoke all on function private.can_review_approval(uuid,text) from public,anon;
grant execute on function private.can_review_approval(uuid,text) to authenticated;
drop policy approvals_select on public.approvals;
create policy approvals_select on public.approvals for select to authenticated using(
 private.can_review_approval(company_id,record_type) or (requested_by=(select auth.uid()) and private.is_company_member(company_id))
);
drop policy approvals_update on public.approvals;
create policy approvals_update on public.approvals for update to authenticated using(private.can_review_approval(company_id,record_type)) with check(private.can_review_approval(company_id,record_type));
