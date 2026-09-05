create table public.vendor_bills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid not null,
  bill_number text not null check (btrim(bill_number) <> ''),
  issued_on date not null,
  due_on date not null,
  status text not null default 'draft' check (status in ('draft','open','paid','void')),
  amount numeric(14,2) not null check (amount > 0),
  description text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,vendor_id,bill_number),
  foreign key(company_id,vendor_id) references public.vendors(company_id,id),
  check(due_on >= issued_on)
);

create table public.vendor_bill_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_bill_id uuid not null,
  paid_on date not null,
  amount numeric(14,2) not null check(amount > 0),
  reference text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,vendor_bill_id) references public.vendor_bills(company_id,id) on delete cascade
);

create index vendor_bills_company_due_idx on public.vendor_bills(company_id,due_on,status);
create index vendor_bill_payments_company_bill_paid_idx on public.vendor_bill_payments(company_id,vendor_bill_id,paid_on);

alter table public.vendor_bills enable row level security;
alter table public.vendor_bill_payments enable row level security;

create policy vendor_bills_select on public.vendor_bills for select to authenticated
using (private.has_company_role(company_id,array['owner','administrator','accountant','auditor']::public.member_role[]));
create policy vendor_bills_insert on public.vendor_bills for insert to authenticated
with check (private.has_company_role(company_id,array['owner','administrator','accountant']::public.member_role[]));
create policy vendor_bills_update on public.vendor_bills for update to authenticated
using (private.has_company_role(company_id,array['owner','administrator','accountant']::public.member_role[]))
with check (private.has_company_role(company_id,array['owner','administrator','accountant']::public.member_role[]));
create policy vendor_bills_delete on public.vendor_bills for delete to authenticated
using (private.has_company_role(company_id,array['owner','administrator','accountant']::public.member_role[]));

create policy vendor_bill_payments_select on public.vendor_bill_payments for select to authenticated
using (private.has_company_role(company_id,array['owner','administrator','accountant','auditor']::public.member_role[]));
create policy vendor_bill_payments_insert on public.vendor_bill_payments for insert to authenticated
with check (private.has_company_role(company_id,array['owner','administrator','accountant']::public.member_role[]));

grant select,insert,update,delete on public.vendor_bills to authenticated;
grant select,insert on public.vendor_bill_payments to authenticated;

create function private.guard_vendor_bill() returns trigger language plpgsql security invoker set search_path='' as $$
declare allocated numeric(14,2);
begin
  if tg_op='INSERT' then
    if new.status='paid' then raise exception 'Paid bill requires a full dated payment allocation';end if;
    return new;
  end if;
  if tg_op='DELETE' then
    if old.status<>'draft' or exists(select 1 from public.vendor_bill_payments p where p.company_id=old.company_id and p.vendor_bill_id=old.id) then
      raise exception 'Only unpaid draft bills can be deleted';
    end if;
    return old;
  end if;
  if old.status in ('paid','void') and new.* is distinct from old.* then
    raise exception 'Paid or void bills require an adjustment';
  end if;
  select coalesce(sum(p.amount),0) into allocated from public.vendor_bill_payments p where p.company_id=old.company_id and p.vendor_bill_id=old.id;
  if allocated>0 and ((new.vendor_id,new.bill_number,new.issued_on,new.due_on,new.amount) is distinct from (old.vendor_id,old.bill_number,old.issued_on,old.due_on,old.amount) or new.status not in (old.status,'paid')) then
    raise exception 'Bills with payments require an adjustment';
  end if;
  if new.status='paid' and old.status<>'paid' and allocated<>new.amount then raise exception 'Paid bill requires a full dated payment allocation';end if;
  new.updated_at=now();
  return new;
end $$;
revoke all on function private.guard_vendor_bill() from public,anon,authenticated;
create trigger vendor_bill_guard before insert or update or delete on public.vendor_bills for each row execute function private.guard_vendor_bill();

create function private.guard_vendor_bill_payment() returns trigger language plpgsql security invoker set search_path='' as $$
declare bill public.vendor_bills%rowtype;allocated numeric(14,2);
begin
  if tg_op<>'INSERT' then raise exception 'Vendor bill payments require an adjustment';end if;
  select * into bill from public.vendor_bills b where b.id=new.vendor_bill_id and b.company_id=new.company_id for update;
  if not found or bill.status not in ('open','draft') then raise exception 'Open vendor bill not found';end if;
  select coalesce(sum(p.amount),0) into allocated from public.vendor_bill_payments p where p.company_id=new.company_id and p.vendor_bill_id=new.vendor_bill_id;
  if allocated+new.amount>bill.amount then raise exception 'Payment exceeds the outstanding balance';end if;
  return new;
end $$;
revoke all on function private.guard_vendor_bill_payment() from public,anon,authenticated;
create trigger vendor_bill_payment_guard before insert or update or delete on public.vendor_bill_payments for each row execute function private.guard_vendor_bill_payment();

create function private.sync_vendor_bill_payment() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  update public.vendor_bills b set status=case when (select sum(p.amount) from public.vendor_bill_payments p where p.company_id=new.company_id and p.vendor_bill_id=new.vendor_bill_id)=b.amount then 'paid' else 'open' end
  where b.company_id=new.company_id and b.id=new.vendor_bill_id;
  return new;
end $$;
revoke all on function private.sync_vendor_bill_payment() from public,anon,authenticated;
create trigger vendor_bill_payment_sync after insert on public.vendor_bill_payments for each row execute function private.sync_vendor_bill_payment();

create function public.save_vendor_bill(target_company_id uuid,target_bill_id uuid,vendor_name text,bill_number_value text,issued_date date,due_date date,bill_status text,bill_amount numeric,bill_description text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare current_user_id uuid:=(select auth.uid());vendor_id_value uuid;result_id uuid;existing public.vendor_bills%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required';end if;
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  if btrim(vendor_name)='' or btrim(bill_number_value)='' or issued_date is null or due_date<issued_date or bill_amount<=0 or bill_amount::text in ('NaN','Infinity','-Infinity') or bill_status not in ('draft','open','paid','void') then raise exception 'Invalid vendor bill';end if;
  select v.id into vendor_id_value from public.vendors v where v.company_id=target_company_id and lower(v.name)=lower(btrim(vendor_name)) limit 1;
  if vendor_id_value is null then insert into public.vendors(company_id,name) values(target_company_id,btrim(vendor_name)) returning id into vendor_id_value;end if;
  if target_bill_id is null then
    insert into public.vendor_bills(company_id,vendor_id,bill_number,issued_on,due_on,status,amount,description,created_by)
    values(target_company_id,vendor_id_value,btrim(bill_number_value),issued_date,due_date,case when bill_status='paid' then 'open' else bill_status end,bill_amount,btrim(bill_description),current_user_id) returning id into result_id;
  else
    select * into existing from public.vendor_bills b where b.company_id=target_company_id and b.id=target_bill_id for update;
    if not found then raise exception 'Vendor bill not found';end if;
    if existing.status in ('paid','void') then raise exception 'Paid or void bills require an adjustment';end if;
    update public.vendor_bills b set vendor_id=vendor_id_value,bill_number=btrim(bill_number_value),issued_on=issued_date,due_on=due_date,status=case when bill_status='paid' then 'open' else bill_status end,amount=bill_amount,description=btrim(bill_description)
    where b.company_id=target_company_id and b.id=target_bill_id returning b.id into result_id;
  end if;
  if bill_status='paid' then
    insert into public.vendor_bill_payments(company_id,vendor_bill_id,paid_on,amount,reference,created_by)
    select target_company_id,result_id,current_date,bill_amount-coalesce(sum(p.amount),0),'Marked paid from bills workspace',current_user_id from public.vendor_bill_payments p where p.company_id=target_company_id and p.vendor_bill_id=result_id having bill_amount-coalesce(sum(p.amount),0)>0;
  end if;
  return result_id;
end $$;
revoke all on function public.save_vendor_bill(uuid,uuid,text,text,date,date,text,numeric,text) from public,anon;
grant execute on function public.save_vendor_bill(uuid,uuid,text,text,date,date,text,numeric,text) to authenticated;

create function public.record_vendor_bill_payment(target_company_id uuid,target_bill_id uuid,payment_date date,payment_amount numeric,payment_reference text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare current_user_id uuid:=(select auth.uid());result_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required';end if;
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  if payment_date is null or payment_amount<=0 or payment_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid vendor bill payment';end if;
  insert into public.vendor_bill_payments(company_id,vendor_bill_id,paid_on,amount,reference,created_by)
  values(target_company_id,target_bill_id,payment_date,payment_amount,btrim(payment_reference),current_user_id) returning id into result_id;
  return result_id;
end $$;
revoke all on function public.record_vendor_bill_payment(uuid,uuid,date,numeric,text) from public,anon;
grant execute on function public.record_vendor_bill_payment(uuid,uuid,date,numeric,text) to authenticated;

create trigger vendor_bills_audit after insert or update or delete on public.vendor_bills for each row execute function private.capture_audit_event();
create trigger vendor_bill_payments_audit after insert or update or delete on public.vendor_bill_payments for each row execute function private.capture_audit_event();
