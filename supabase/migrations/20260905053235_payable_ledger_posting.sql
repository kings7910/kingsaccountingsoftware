alter table public.vendor_bills
  add column expense_account_id uuid,
  add column journal_entry_id uuid,
  add constraint vendor_bills_expense_account_fk
    foreign key(company_id,expense_account_id) references public.chart_of_accounts(company_id,id),
  add constraint vendor_bills_journal_entry_fk
    foreign key(company_id,journal_entry_id) references public.journal_entries(company_id,id);

alter table public.vendor_bill_payments
  add column payment_account_id uuid,
  add column journal_entry_id uuid,
  add constraint vendor_bill_payments_account_fk
    foreign key(company_id,payment_account_id) references public.chart_of_accounts(company_id,id),
  add constraint vendor_bill_payments_journal_entry_fk
    foreign key(company_id,journal_entry_id) references public.journal_entries(company_id,id);

create unique index vendor_bills_journal_entry_unique
  on public.vendor_bills(company_id,journal_entry_id) where journal_entry_id is not null;
create unique index vendor_bill_payments_journal_entry_unique
  on public.vendor_bill_payments(company_id,journal_entry_id) where journal_entry_id is not null;
create index vendor_bills_expense_account_idx on public.vendor_bills(company_id,expense_account_id);
create index vendor_bill_payments_account_idx on public.vendor_bill_payments(company_id,payment_account_id);

create function private.resolve_payable_ledger_account(
  target_company_id uuid,
  account_text text,
  required_type public.account_type
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  account_no text:=split_part(btrim(account_text),' ',1);
  account_name text:=btrim(regexp_replace(btrim(account_text),'^[^ ]+\s*[·-]?\s*',''));
  account_record public.chart_of_accounts%rowtype;
begin
  if account_no !~ '^[0-9][0-9A-Za-z.-]*$' then raise exception 'Choose a valid ledger account';end if;
  select * into account_record from public.chart_of_accounts
    where company_id=target_company_id and account_number=account_no for update;
  if found then
    if not account_record.active or account_record.account_type<>required_type then
      raise exception 'Ledger account has the wrong type or is inactive';
    end if;
    return account_record.id;
  end if;
  insert into public.chart_of_accounts(company_id,account_number,name,account_type)
  values(target_company_id,account_no,coalesce(nullif(account_name,''),account_no),required_type)
  returning id into account_record.id;
  return account_record.id;
end $$;
revoke all on function private.resolve_payable_ledger_account(uuid,text,public.account_type) from public,anon;
grant execute on function private.resolve_payable_ledger_account(uuid,text,public.account_type) to authenticated;

create or replace function private.guard_vendor_bill() returns trigger language plpgsql security invoker set search_path='' as $$
declare
  allocated numeric(14,2);
  payable_account_id_value uuid;
  result_journal_id uuid;
begin
  if tg_op='DELETE' then
    if old.status<>'draft' or old.journal_entry_id is not null or exists(select 1 from public.vendor_bill_payments p where p.company_id=old.company_id and p.vendor_bill_id=old.id) then
      raise exception 'Only unpaid draft bills can be deleted';
    end if;
    return old;
  end if;

  if tg_op='INSERT' then
    if new.status='paid' then raise exception 'Paid bill requires a full dated payment allocation';end if;
  else
    if old.status in ('paid','void') and new.* is distinct from old.* then
      raise exception 'Paid or void bills require an adjustment';
    end if;
    select coalesce(sum(p.amount),0) into allocated from public.vendor_bill_payments p
      where p.company_id=old.company_id and p.vendor_bill_id=old.id;
    if allocated>0 and ((new.vendor_id,new.bill_number,new.issued_on,new.due_on,new.amount) is distinct from (old.vendor_id,old.bill_number,old.issued_on,old.due_on,old.amount) or new.status not in (old.status,'paid')) then
      raise exception 'Bills with payments require an adjustment';
    end if;
    if old.journal_entry_id is not null and
      (new.vendor_id,new.bill_number,new.issued_on,new.due_on,new.amount,new.description,new.expense_account_id,new.journal_entry_id)
      is distinct from
      (old.vendor_id,old.bill_number,old.issued_on,old.due_on,old.amount,old.description,old.expense_account_id,old.journal_entry_id) then
      raise exception 'Posted vendor bills require a reversing adjustment';
    end if;
    if new.status='paid' and old.status<>'paid' and allocated<>new.amount then
      raise exception 'Paid bill requires a full dated payment allocation';
    end if;
    if new.status='draft' and old.journal_entry_id is not null then
      raise exception 'Posted vendor bills require a reversing adjustment';
    end if;
    if new.status='void' and old.journal_entry_id is not null and not exists(select 1 from public.journal_entries j where j.reverses_entry_id=old.journal_entry_id and j.company_id=old.company_id and j.status='posted') then
      raise exception 'Posted vendor bills require a reversing adjustment';
    end if;
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
  payable_account_id_value uuid;
  result_journal_id uuid;
begin
  if tg_op<>'INSERT' then raise exception 'Vendor bill payments require an adjustment';end if;
  select * into bill from public.vendor_bills b where b.id=new.vendor_bill_id and b.company_id=new.company_id for update;
  if not found or bill.status not in ('open','draft') then raise exception 'Open vendor bill not found';end if;
  if bill.journal_entry_id is null then raise exception 'Post the vendor bill to the ledger before recording payment';end if;
  select coalesce(sum(p.amount),0) into allocated from public.vendor_bill_payments p where p.company_id=new.company_id and p.vendor_bill_id=new.vendor_bill_id;
  if allocated+new.amount>bill.amount then raise exception 'Payment exceeds the outstanding balance';end if;
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

drop function public.save_vendor_bill(uuid,uuid,text,text,date,date,text,numeric,text);
create function public.save_vendor_bill(
  target_company_id uuid,target_bill_id uuid,vendor_name text,bill_number_value text,
  issued_date date,due_date date,bill_status text,bill_amount numeric,bill_description text,
  expense_account_text text,paid_from_account_text text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  current_user_id uuid:=(select auth.uid());
  vendor_id_value uuid;
  expense_account_id_value uuid;
  payment_account_id_value uuid;
  result_id uuid;
  existing public.vendor_bills%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required';end if;
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  if btrim(vendor_name)='' or btrim(bill_number_value)='' or issued_date is null or due_date<issued_date or bill_amount<=0 or bill_amount::text in ('NaN','Infinity','-Infinity') or bill_status not in ('draft','open','paid','void') then raise exception 'Invalid vendor bill';end if;
  expense_account_id_value:=private.resolve_payable_ledger_account(target_company_id,expense_account_text,'expense');
  if bill_status='paid' then payment_account_id_value:=private.resolve_payable_ledger_account(target_company_id,paid_from_account_text,'asset');end if;
  select v.id into vendor_id_value from public.vendors v where v.company_id=target_company_id and lower(v.name)=lower(btrim(vendor_name)) limit 1;
  if vendor_id_value is null then insert into public.vendors(company_id,name) values(target_company_id,btrim(vendor_name)) returning id into vendor_id_value;end if;
  if target_bill_id is null then
    insert into public.vendor_bills(company_id,vendor_id,bill_number,issued_on,due_on,status,amount,description,expense_account_id,created_by)
    values(target_company_id,vendor_id_value,btrim(bill_number_value),issued_date,due_date,case when bill_status='paid' then 'open' else bill_status end,bill_amount,btrim(bill_description),expense_account_id_value,current_user_id)
    returning id into result_id;
  else
    select * into existing from public.vendor_bills b where b.company_id=target_company_id and b.id=target_bill_id for update;
    if not found then raise exception 'Vendor bill not found';end if;
    if existing.status in ('paid','void') then raise exception 'Paid or void bills require an adjustment';end if;
    update public.vendor_bills b set vendor_id=vendor_id_value,bill_number=btrim(bill_number_value),issued_on=issued_date,due_on=due_date,status=case when bill_status='paid' then 'open' else bill_status end,amount=bill_amount,description=btrim(bill_description),expense_account_id=expense_account_id_value
    where b.company_id=target_company_id and b.id=target_bill_id returning b.id into result_id;
  end if;
  if bill_status='paid' then
    insert into public.vendor_bill_payments(company_id,vendor_bill_id,paid_on,amount,reference,payment_account_id,created_by)
    select target_company_id,result_id,current_date,bill_amount-coalesce(sum(p.amount),0),'Marked paid from bills workspace',payment_account_id_value,current_user_id
      from public.vendor_bill_payments p where p.company_id=target_company_id and p.vendor_bill_id=result_id
      having bill_amount-coalesce(sum(p.amount),0)>0;
  end if;
  return result_id;
end $$;
revoke all on function public.save_vendor_bill(uuid,uuid,text,text,date,date,text,numeric,text,text,text) from public,anon;
grant execute on function public.save_vendor_bill(uuid,uuid,text,text,date,date,text,numeric,text,text,text) to authenticated;

drop function public.record_vendor_bill_payment(uuid,uuid,date,numeric,text);
create function public.record_vendor_bill_payment(
  target_company_id uuid,target_bill_id uuid,payment_date date,payment_amount numeric,
  payment_reference text,payment_account_text text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  current_user_id uuid:=(select auth.uid());
  payment_account_id_value uuid;
  result_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required';end if;
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  if payment_date is null or payment_amount<=0 or payment_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid vendor bill payment';end if;
  payment_account_id_value:=private.resolve_payable_ledger_account(target_company_id,payment_account_text,'asset');
  insert into public.vendor_bill_payments(company_id,vendor_bill_id,paid_on,amount,reference,payment_account_id,created_by)
  values(target_company_id,target_bill_id,payment_date,payment_amount,btrim(payment_reference),payment_account_id_value,current_user_id)
  returning id into result_id;
  return result_id;
end $$;
revoke all on function public.record_vendor_bill_payment(uuid,uuid,date,numeric,text,text) from public,anon;
grant execute on function public.record_vendor_bill_payment(uuid,uuid,date,numeric,text,text) to authenticated;

create function public.void_vendor_bill(target_company_id uuid,target_bill_id uuid,reversal_date date)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  bill public.vendor_bills%rowtype;
  result_journal_id uuid;
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
