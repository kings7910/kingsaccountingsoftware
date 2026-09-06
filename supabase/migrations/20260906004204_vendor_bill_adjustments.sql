create table public.vendor_bill_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_bill_id uuid not null,
  adjustment_type text not null check(adjustment_type in ('credit','debit')),
  adjusted_on date not null,
  amount numeric(14,2) not null check(amount>0 and amount::text not in ('NaN','Infinity','-Infinity')),
  reason text not null check(btrim(reason)<>''),
  journal_entry_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,journal_entry_id),
  constraint vendor_bill_adjustments_bill_fk foreign key(company_id,vendor_bill_id) references public.vendor_bills(company_id,id),
  constraint vendor_bill_adjustments_journal_entry_fk foreign key(company_id,journal_entry_id) references public.journal_entries(company_id,id)
);

create index vendor_bill_adjustments_company_bill_date_idx
  on public.vendor_bill_adjustments(company_id,vendor_bill_id,adjusted_on);

alter table public.vendor_bill_adjustments enable row level security;

create policy vendor_bill_adjustments_select on public.vendor_bill_adjustments for select to authenticated
using (private.has_company_role(company_id,array['owner','administrator','accountant','auditor']::public.member_role[]));
create policy vendor_bill_adjustments_insert on public.vendor_bill_adjustments for insert to authenticated
with check (
  created_by=(select auth.uid()) and
  private.has_company_role(company_id,array['owner','administrator','accountant']::public.member_role[])
);

revoke all on table public.vendor_bill_adjustments from public,anon,authenticated;
grant select,insert on table public.vendor_bill_adjustments to authenticated;
grant select,insert,update,delete on table public.vendor_bill_adjustments to service_role;

create function private.vendor_bill_adjusted_total(target_company_id uuid,target_bill_id uuid)
returns numeric language sql stable security invoker set search_path='' as $$
  select b.amount+
    coalesce(sum(a.amount) filter(where a.adjustment_type='debit'),0)-
    coalesce(sum(a.amount) filter(where a.adjustment_type='credit'),0)
  from public.vendor_bills b
  left join public.vendor_bill_adjustments a
    on a.company_id=b.company_id and a.vendor_bill_id=b.id
  where b.company_id=target_company_id and b.id=target_bill_id
  group by b.amount
$$;
revoke all on function private.vendor_bill_adjusted_total(uuid,uuid) from public,anon;
grant execute on function private.vendor_bill_adjusted_total(uuid,uuid) to authenticated,service_role;

create or replace function private.guard_vendor_bill() returns trigger language plpgsql security invoker set search_path='' as $$
declare
  allocated numeric(14,2);
  adjusted_total numeric(14,2);
  expected_status text;
  payable_account_id_value uuid;
  result_journal_id uuid;
begin
  if tg_op='DELETE' then
    if old.status<>'draft' or old.journal_entry_id is not null or
      exists(select 1 from public.vendor_bill_payments p where p.company_id=old.company_id and p.vendor_bill_id=old.id) or
      exists(select 1 from public.vendor_bill_adjustments a where a.company_id=old.company_id and a.vendor_bill_id=old.id) then
      raise exception 'Only unpaid draft bills can be deleted';
    end if;
    return old;
  end if;

  if tg_op='INSERT' then
    if new.status='paid' then raise exception 'Paid bill requires a full dated payment allocation';end if;
  else
    if old.status='void' and new.* is distinct from old.* then raise exception 'Void bills cannot be changed';end if;
    select coalesce(sum(p.amount),0) into allocated from public.vendor_bill_payments p
      where p.company_id=old.company_id and p.vendor_bill_id=old.id;
    adjusted_total:=private.vendor_bill_adjusted_total(old.company_id,old.id);
    expected_status:=case when allocated>=adjusted_total then 'paid' else 'open' end;

    if new.status='paid' and old.status<>'paid' and allocated<adjusted_total then
      raise exception 'Paid bill requires a full dated payment allocation';
    end if;

    if old.status='paid' and
      (new.vendor_id,new.bill_number,new.issued_on,new.due_on,new.amount,new.description,new.expense_account_id,new.journal_entry_id)
      is distinct from
      (old.vendor_id,old.bill_number,old.issued_on,old.due_on,old.amount,old.description,old.expense_account_id,old.journal_entry_id) then
      raise exception 'Paid bills require an adjustment';
    end if;
    if allocated>0 and
      (new.vendor_id,new.bill_number,new.issued_on,new.due_on,new.amount)
      is distinct from
      (old.vendor_id,old.bill_number,old.issued_on,old.due_on,old.amount) then
      raise exception 'Bills with payments require an adjustment';
    end if;
    if allocated>0 and new.status not in (old.status,'paid') and new.status<>expected_status then
      raise exception 'Bills with payments require an adjustment';
    end if;
    if old.journal_entry_id is not null and
      (new.vendor_id,new.bill_number,new.issued_on,new.due_on,new.amount,new.description,new.expense_account_id,new.journal_entry_id)
      is distinct from
      (old.vendor_id,old.bill_number,old.issued_on,old.due_on,old.amount,old.description,old.expense_account_id,old.journal_entry_id) then
      raise exception 'Posted vendor bills require a reversing adjustment';
    end if;
    if new.status in ('open','paid') and old.status in ('open','paid') and new.status<>expected_status then
      raise exception 'Bill status must match its dated payments and adjustments';
    end if;
    if new.status='draft' and old.journal_entry_id is not null then raise exception 'Posted vendor bills require a reversing adjustment';end if;
    if new.status='void' and old.journal_entry_id is not null and not exists(
      select 1 from public.journal_entries j where j.reverses_entry_id=old.journal_entry_id and j.company_id=old.company_id and j.status='posted'
    ) then raise exception 'Posted vendor bills require a reversing adjustment';end if;
    new.updated_at=now();
  end if;

  if new.status in ('open','paid') and new.journal_entry_id is null then
    if new.expense_account_id is null then raise exception 'Choose an expense account before posting the bill';end if;
    if not exists(select 1 from public.chart_of_accounts a where a.company_id=new.company_id and a.id=new.expense_account_id and a.account_type='expense' and a.active) then
      raise exception 'Choose an active expense account';
    end if;
    payable_account_id_value:=private.resolve_payable_ledger_account(new.company_id,'2000 · Accounts payable','liability');
    insert into public.journal_entries(company_id,entry_date,memo,status,created_by)
    values(new.company_id,new.issued_on,'Vendor bill '||new.bill_number||' · '||coalesce(nullif(new.description,''),'No description'),'draft',new.created_by)
    returning id into result_journal_id;
    insert into public.journal_lines(company_id,journal_entry_id,account_id,description,debit,credit,vendor_id)
    values
      (new.company_id,result_journal_id,new.expense_account_id,'Vendor bill '||new.bill_number,new.amount,0,new.vendor_id),
      (new.company_id,result_journal_id,payable_account_id_value,'Accounts payable · '||new.bill_number,0,new.amount,new.vendor_id);
    update public.journal_entries set status='posted' where id=result_journal_id and company_id=new.company_id;
    new.journal_entry_id=result_journal_id;
  end if;
  return new;
end $$;

create or replace function private.guard_vendor_bill_payment() returns trigger language plpgsql security invoker set search_path='' as $$
declare
  bill public.vendor_bills%rowtype;
  allocated numeric(14,2);
  adjusted_total numeric(14,2);
  payable_account_id_value uuid;
  result_journal_id uuid;
begin
  if tg_op<>'INSERT' then raise exception 'Vendor bill payments require an adjustment';end if;
  select * into bill from public.vendor_bills b where b.id=new.vendor_bill_id and b.company_id=new.company_id for update;
  if not found or bill.status not in ('open','draft') then raise exception 'Open vendor bill not found';end if;
  if bill.journal_entry_id is null then raise exception 'Post the vendor bill to the ledger before recording payment';end if;
  select coalesce(sum(p.amount),0) into allocated from public.vendor_bill_payments p where p.company_id=new.company_id and p.vendor_bill_id=new.vendor_bill_id;
  adjusted_total:=private.vendor_bill_adjusted_total(new.company_id,new.vendor_bill_id);
  if allocated+new.amount>adjusted_total then raise exception 'Payment exceeds the outstanding balance';end if;
  if new.payment_account_id is null or not exists(select 1 from public.chart_of_accounts a where a.company_id=new.company_id and a.id=new.payment_account_id and a.account_type='asset' and a.active) then
    raise exception 'Choose an active cash or bank account';
  end if;
  payable_account_id_value:=private.resolve_payable_ledger_account(new.company_id,'2000 · Accounts payable','liability');
  insert into public.journal_entries(company_id,entry_date,memo,status,created_by)
  values(new.company_id,new.paid_on,'Vendor payment '||bill.bill_number||coalesce(' · '||nullif(new.reference,''),''),'draft',new.created_by)
  returning id into result_journal_id;
  insert into public.journal_lines(company_id,journal_entry_id,account_id,description,debit,credit,vendor_id)
  values
    (new.company_id,result_journal_id,payable_account_id_value,'Payment · '||bill.bill_number,new.amount,0,bill.vendor_id),
    (new.company_id,result_journal_id,new.payment_account_id,'Payment · '||bill.bill_number,0,new.amount,bill.vendor_id);
  update public.journal_entries set status='posted' where id=result_journal_id and company_id=new.company_id;
  new.journal_entry_id=result_journal_id;
  return new;
end $$;

create or replace function private.sync_vendor_bill_payment() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  update public.vendor_bills b set status=case when
    (select coalesce(sum(p.amount),0) from public.vendor_bill_payments p where p.company_id=new.company_id and p.vendor_bill_id=new.vendor_bill_id)
      >=private.vendor_bill_adjusted_total(new.company_id,new.vendor_bill_id)
    then 'paid' else 'open' end
  where b.company_id=new.company_id and b.id=new.vendor_bill_id;
  return new;
end $$;

create function private.guard_vendor_bill_adjustment() returns trigger language plpgsql security invoker set search_path='' as $$
declare
  bill public.vendor_bills%rowtype;
  adjusted_total numeric(14,2);
  payable_account_id_value uuid;
  result_journal_id uuid;
begin
  if tg_op<>'INSERT' then raise exception 'Vendor bill adjustments are immutable';end if;
  if new.created_by<>(select auth.uid()) then raise exception 'Adjustment creator must match the authenticated user';end if;
  select * into bill from public.vendor_bills b where b.company_id=new.company_id and b.id=new.vendor_bill_id for update;
  if not found or bill.status not in ('open','paid') or bill.journal_entry_id is null then raise exception 'Posted vendor bill not found';end if;
  if new.adjusted_on<bill.issued_on then raise exception 'Adjustment date cannot precede the bill date';end if;
  adjusted_total:=private.vendor_bill_adjusted_total(new.company_id,new.vendor_bill_id);
  if new.adjustment_type='credit' and new.amount>adjusted_total then raise exception 'Credit exceeds the adjusted bill total';end if;
  if bill.expense_account_id is null then raise exception 'Vendor bill has no expense account';end if;
  payable_account_id_value:=private.resolve_payable_ledger_account(new.company_id,'2000 · Accounts payable','liability');
  insert into public.journal_entries(company_id,entry_date,memo,status,created_by)
  values(new.company_id,new.adjusted_on,
    case when new.adjustment_type='credit' then 'Vendor credit ' else 'Vendor debit ' end||bill.bill_number||' · '||btrim(new.reason),
    'draft',new.created_by)
  returning id into result_journal_id;
  if new.adjustment_type='credit' then
    insert into public.journal_lines(company_id,journal_entry_id,account_id,description,debit,credit,vendor_id) values
      (new.company_id,result_journal_id,payable_account_id_value,'Vendor credit · '||bill.bill_number,new.amount,0,bill.vendor_id),
      (new.company_id,result_journal_id,bill.expense_account_id,'Vendor credit · '||bill.bill_number,0,new.amount,bill.vendor_id);
  else
    insert into public.journal_lines(company_id,journal_entry_id,account_id,description,debit,credit,vendor_id) values
      (new.company_id,result_journal_id,bill.expense_account_id,'Vendor debit · '||bill.bill_number,new.amount,0,bill.vendor_id),
      (new.company_id,result_journal_id,payable_account_id_value,'Vendor debit · '||bill.bill_number,0,new.amount,bill.vendor_id);
  end if;
  update public.journal_entries set status='posted' where company_id=new.company_id and id=result_journal_id;
  new.journal_entry_id=result_journal_id;
  return new;
end $$;
revoke all on function private.guard_vendor_bill_adjustment() from public,anon,authenticated;
create trigger vendor_bill_adjustment_guard before insert or update or delete on public.vendor_bill_adjustments
for each row execute function private.guard_vendor_bill_adjustment();

create function private.sync_vendor_bill_adjustment() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  update public.vendor_bills b set status=case when
    (select coalesce(sum(p.amount),0) from public.vendor_bill_payments p where p.company_id=new.company_id and p.vendor_bill_id=new.vendor_bill_id)
      >=private.vendor_bill_adjusted_total(new.company_id,new.vendor_bill_id)
    then 'paid' else 'open' end
  where b.company_id=new.company_id and b.id=new.vendor_bill_id;
  return new;
end $$;
revoke all on function private.sync_vendor_bill_adjustment() from public,anon,authenticated;
create trigger vendor_bill_adjustment_sync after insert on public.vendor_bill_adjustments
for each row execute function private.sync_vendor_bill_adjustment();

create trigger vendor_bill_adjustments_audit after insert or update or delete on public.vendor_bill_adjustments
for each row execute function private.capture_audit_event();

create or replace function public.void_vendor_bill(target_company_id uuid,target_bill_id uuid,reversal_date date)
returns uuid language plpgsql security invoker set search_path='' as $$
declare bill public.vendor_bills%rowtype;result_journal_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required';end if;
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  if reversal_date is null then raise exception 'Choose a reversal date';end if;
  select * into bill from public.vendor_bills b where b.company_id=target_company_id and b.id=target_bill_id and b.status='open' for update;
  if not found then raise exception 'Open vendor bill not found';end if;
  if bill.journal_entry_id is null then raise exception 'Vendor bill has no posted journal';end if;
  if exists(select 1 from public.vendor_bill_payments p where p.company_id=target_company_id and p.vendor_bill_id=target_bill_id) then
    raise exception 'Bills with payments require a credit adjustment';
  end if;
  if exists(select 1 from public.vendor_bill_adjustments a where a.company_id=target_company_id and a.vendor_bill_id=target_bill_id) then
    raise exception 'Bills with adjustments cannot be voided';
  end if;
  if exists(select 1 from public.journal_entries j where j.reverses_entry_id=bill.journal_entry_id) then raise exception 'Vendor bill journal is already reversed';end if;
  insert into public.journal_entries(company_id,entry_date,memo,status,reverses_entry_id,created_by)
  values(target_company_id,reversal_date,'Void vendor bill '||bill.bill_number,'draft',bill.journal_entry_id,(select auth.uid()))
  returning id into result_journal_id;
  insert into public.journal_lines(company_id,journal_entry_id,account_id,description,debit,credit,customer_id,vendor_id,truck_id,load_id)
  select company_id,result_journal_id,account_id,'Void · '||coalesce(description,''),credit,debit,customer_id,vendor_id,truck_id,load_id
    from public.journal_lines where company_id=target_company_id and journal_entry_id=bill.journal_entry_id;
  update public.journal_entries set status='posted' where company_id=target_company_id and id=result_journal_id;
  update public.vendor_bills set status='void' where company_id=target_company_id and id=target_bill_id;
  return result_journal_id;
end $$;
revoke all on function public.void_vendor_bill(uuid,uuid,date) from public,anon;
grant execute on function public.void_vendor_bill(uuid,uuid,date) to authenticated;

create function public.record_vendor_bill_adjustment(
  target_company_id uuid,target_bill_id uuid,adjustment_date date,
  adjustment_kind text,adjustment_amount numeric,adjustment_reason text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare current_user_id uuid:=(select auth.uid());result_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required';end if;
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  if adjustment_date is null or adjustment_kind not in ('credit','debit') or adjustment_amount<=0 or
    adjustment_amount::text in ('NaN','Infinity','-Infinity') or btrim(adjustment_reason)='' then
    raise exception 'Invalid vendor bill adjustment';
  end if;
  insert into public.vendor_bill_adjustments(company_id,vendor_bill_id,adjustment_type,adjusted_on,amount,reason,created_by)
  values(target_company_id,target_bill_id,adjustment_kind,adjustment_date,adjustment_amount,btrim(adjustment_reason),current_user_id)
  returning id into result_id;
  return result_id;
end $$;
revoke all on function public.record_vendor_bill_adjustment(uuid,uuid,date,text,numeric,text) from public,anon;
grant execute on function public.record_vendor_bill_adjustment(uuid,uuid,date,text,numeric,text) to authenticated;
