begin;
-- Existing invoices retain their historical treatment; never silently double-post them.
alter table public.invoices add column ledger_managed boolean not null default false,
  add column journal_entry_id uuid,
  add column creation_request_id uuid,
  add column creation_payload jsonb,
  add constraint invoices_journal_fk foreign key(company_id,journal_entry_id) references public.journal_entries(company_id,id);
alter table public.invoices alter column ledger_managed set default true;
create unique index invoices_journal_unique on public.invoices(company_id,journal_entry_id) where journal_entry_id is not null;
create unique index invoices_creation_request_unique on public.invoices(company_id,creation_request_id) where creation_request_id is not null;
alter table public.payments add column payment_account_id uuid, add column journal_entry_id uuid, add column request_id uuid,
  add constraint payments_account_fk foreign key(company_id,payment_account_id) references public.chart_of_accounts(company_id,id),
  add constraint payments_journal_fk foreign key(company_id,journal_entry_id) references public.journal_entries(company_id,id);
create index payments_account_idx on public.payments(company_id,payment_account_id);
create unique index payments_journal_unique on public.payments(company_id,journal_entry_id) where journal_entry_id is not null;
create unique index payments_request_unique on public.payments(company_id,request_id) where request_id is not null;
alter table public.credit_notes add column credited_on date, add column tax_amount numeric(14,2) not null default 0,
  add column journal_entry_id uuid, add column request_id uuid,
  add constraint credit_notes_journal_fk foreign key(company_id,journal_entry_id) references public.journal_entries(company_id,id);
update public.credit_notes set credited_on = (created_at at time zone 'UTC')::date;
alter table public.credit_notes alter column credited_on set not null, alter column credited_on set default current_date;
create unique index credit_notes_journal_unique on public.credit_notes(company_id,journal_entry_id) where journal_entry_id is not null;
create unique index credit_notes_request_unique on public.credit_notes(company_id,request_id) where request_id is not null;

create function private.guard_receivable_invoice() returns trigger
language plpgsql security invoker set search_path='' as $$
declare ar uuid; revenue uuid; tax_account uuid; journal_id uuid; allocated numeric; line_subtotal numeric; line_tax numeric;
begin
  if not private.has_company_role(coalesce(new.company_id,old.company_id),array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required'; end if;
  if tg_op='DELETE' then
    if old.status<>'draft' or old.journal_entry_id is not null then raise exception 'Only draft invoices can be deleted'; end if;
    return old;
  end if;
  if tg_op='INSERT' then
    if not new.ledger_managed or new.journal_entry_id is not null or new.status<>'draft' then raise exception 'Create a draft invoice before issuing it'; end if;
  else
    if (new.company_id,new.id,new.ledger_managed,new.creation_request_id,new.creation_payload,new.journal_entry_id) is distinct from
       (old.company_id,old.id,old.ledger_managed,old.creation_request_id,old.creation_payload,old.journal_entry_id) then raise exception 'Invoice identity and ledger links cannot be changed'; end if;
    if not old.ledger_managed then raise exception 'Legacy invoice requires accountant reconciliation before changes'; end if;
    if old.journal_entry_id is not null and
       (new.invoice_number,new.customer_id,new.load_id,new.issued_on,new.due_on,new.subtotal,new.tax,new.discount,new.notes,new.created_by,new.created_at) is distinct from
       (old.invoice_number,old.customer_id,old.load_id,old.issued_on,old.due_on,old.subtotal,old.tax,old.discount,old.notes,old.created_by,old.created_at) then raise exception 'Issued invoices require a credit note or a new invoice'; end if;
  end if;
  if new.status not in ('draft','sent','overdue','paid') or new.due_on<new.issued_on
     or new.subtotal<0 or new.tax<0 or new.discount<>0
     or new.subtotal::text in ('NaN','Infinity','-Infinity') or new.tax::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid invoice'; end if;
  if new.status<>'draft' then
    if new.subtotal+new.tax<=0 then raise exception 'Issued invoices must have a positive total'; end if;
    if new.journal_entry_id is null then
      select round(sum(quantity*unit_price),2),round(sum(quantity*unit_price*tax_rate),2)
        into line_subtotal,line_tax from public.invoice_items where company_id=new.company_id and invoice_id=new.id;
      if line_subtotal is distinct from new.subtotal or line_tax is distinct from new.tax then raise exception 'Invoice lines and totals must agree before issuing'; end if;
      ar:=private.resolve_payable_ledger_account(new.company_id,'1100 · Accounts receivable','asset');
      revenue:=private.resolve_payable_ledger_account(new.company_id,'4000 · Freight revenue','income');
      if new.tax>0 then tax_account:=private.resolve_payable_ledger_account(new.company_id,'2100 · Sales tax payable','liability'); end if;
      insert into public.journal_entries(company_id,entry_date,memo,status,created_by)
        values(new.company_id,new.issued_on,'Invoice INV-'||new.invoice_number,'draft',auth.uid()) returning id into journal_id;
      insert into public.journal_lines(company_id,journal_entry_id,account_id,debit,credit,customer_id)
        values(new.company_id,journal_id,ar,new.subtotal+new.tax,0,new.customer_id);
      if new.subtotal>0 then insert into public.journal_lines(company_id,journal_entry_id,account_id,debit,credit,customer_id)
        values(new.company_id,journal_id,revenue,0,new.subtotal,new.customer_id); end if;
      if new.tax>0 then insert into public.journal_lines(company_id,journal_entry_id,account_id,debit,credit,customer_id)
        values(new.company_id,journal_id,tax_account,0,new.tax,new.customer_id); end if;
      update public.journal_entries set status='posted' where id=journal_id and company_id=new.company_id;
      new.journal_entry_id:=journal_id;
    end if;
    select coalesce((select sum(amount) from public.payments where company_id=new.company_id and invoice_id=new.id),0)
         + coalesce((select sum(amount) from public.credit_notes where company_id=new.company_id and invoice_id=new.id),0) into allocated;
    if new.status='paid' and allocated<new.subtotal+new.tax then raise exception 'Paid invoice requires dated payment or credit allocations'; end if;
    if allocated>=new.subtotal+new.tax then new.status:='paid'; end if;
  elsif new.journal_entry_id is not null then raise exception 'Issued invoices cannot be reopened as drafts';
  end if;
  return new;
end $$;
revoke all on function private.guard_receivable_invoice() from public,anon,authenticated;
drop trigger paid_invoice_guard on public.invoices;
drop trigger paid_invoice_delete_guard on public.invoices;
create trigger receivable_invoice_guard before insert or update or delete on public.invoices
  for each row execute function private.guard_receivable_invoice();

create or replace function private.protect_paid_invoice_line() returns trigger language plpgsql security invoker set search_path='' as $$
declare old_id uuid; new_id uuid; invoice record;
begin
 if tg_op<>'INSERT' then old_id:=old.invoice_id; end if;
 if tg_op<>'DELETE' then new_id:=new.invoice_id; end if;
 for invoice in select id,status,journal_entry_id from public.invoices where id in(old_id,new_id) order by id for update loop
   if invoice.status<>'draft' or invoice.journal_entry_id is not null then raise exception 'Issued invoice lines require a credit note or a new invoice'; end if;
 end loop;
 if tg_op<>'DELETE' and (new.quantity<=0 or new.unit_price<0 or new.tax_rate<0 or new.quantity::text in ('NaN','Infinity','-Infinity') or new.unit_price::text in ('NaN','Infinity','-Infinity') or new.tax_rate::text in ('NaN','Infinity','-Infinity')) then raise exception 'Invalid invoice line'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;

create function private.guard_receivable_allocation() returns trigger
language plpgsql security invoker set search_path='' as $$
declare invoice public.invoices%rowtype; ar uuid; revenue uuid; tax_account uuid; journal_id uuid;
  allocated numeric; prior_credits numeric; prior_tax numeric; remaining_tax numeric; event_date date;
begin
 if tg_op<>'INSERT' then raise exception 'Customer payments and credits are immutable'; end if;
 if not private.has_company_role(new.company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required'; end if;
 select * into invoice from public.invoices where company_id=new.company_id and id=new.invoice_id for update;
 if not found then raise exception 'Invoice not found'; end if;
 if not invoice.ledger_managed or invoice.journal_entry_id is null then raise exception 'Issue a ledger-managed invoice before recording payments or credits'; end if;
 if new.amount is null or new.amount<=0 or new.amount::text in ('NaN','Infinity','-Infinity') or new.amount<>round(new.amount,2)
   or new.journal_entry_id is not null or new.created_by is distinct from auth.uid() then raise exception 'Invalid customer allocation'; end if;
 event_date:=case when tg_table_name='payments' then (to_jsonb(new)->>'received_on')::date else (to_jsonb(new)->>'credited_on')::date end;
 if event_date is null or event_date<invoice.issued_on or event_date>current_date then raise exception 'Allocation date must be between invoice date and today'; end if;
 ar:=private.resolve_payable_ledger_account(new.company_id,'1100 · Accounts receivable','asset');
 if tg_table_name='payments' then
   if new.customer_id is distinct from invoice.customer_id then raise exception 'Payment customer must match invoice'; end if;
   select coalesce((select sum(amount) from public.payments where company_id=new.company_id and invoice_id=invoice.id),0)
      + coalesce((select sum(amount) from public.credit_notes where company_id=new.company_id and invoice_id=invoice.id),0) into allocated;
   if new.amount>invoice.total-allocated then raise exception 'Payment exceeds outstanding invoice balance'; end if;
   if not exists(select 1 from public.chart_of_accounts where company_id=new.company_id and id=new.payment_account_id and active and account_type='asset' and account_number<>'1100') then raise exception 'Choose an active cash or bank asset account'; end if;
 else
   if coalesce(btrim(new.reason),'')='' then raise exception 'Credit reason is required'; end if;
   select coalesce(sum(amount),0),coalesce(sum(tax_amount),0) into prior_credits,prior_tax from public.credit_notes where company_id=new.company_id and invoice_id=invoice.id;
   if prior_credits+new.amount>invoice.total then raise exception 'Credits cannot exceed invoice total'; end if;
   remaining_tax:=round((prior_credits+new.amount)*invoice.tax/invoice.total,2)-prior_tax;
   new.tax_amount:=remaining_tax;
   revenue:=private.resolve_payable_ledger_account(new.company_id,'4000 · Freight revenue','income');
   if remaining_tax>0 then tax_account:=private.resolve_payable_ledger_account(new.company_id,'2100 · Sales tax payable','liability'); end if;
 end if;
 insert into public.journal_entries(company_id,entry_date,memo,status,created_by)
   values(new.company_id,event_date,case when tg_table_name='payments' then 'Customer payment INV-' else 'Customer credit INV-' end||invoice.invoice_number,'draft',auth.uid()) returning id into journal_id;
 insert into public.journal_lines(company_id,journal_entry_id,account_id,debit,credit,customer_id)
   values(new.company_id,journal_id,ar,0,new.amount,invoice.customer_id);
 if tg_table_name='payments' then
   insert into public.journal_lines(company_id,journal_entry_id,account_id,debit,credit,customer_id)
     values(new.company_id,journal_id,new.payment_account_id,new.amount,0,invoice.customer_id);
 else
   if new.amount-remaining_tax>0 then insert into public.journal_lines(company_id,journal_entry_id,account_id,debit,credit,customer_id)
     values(new.company_id,journal_id,revenue,new.amount-remaining_tax,0,invoice.customer_id); end if;
   if remaining_tax>0 then insert into public.journal_lines(company_id,journal_entry_id,account_id,debit,credit,customer_id)
     values(new.company_id,journal_id,tax_account,remaining_tax,0,invoice.customer_id); end if;
 end if;
 update public.journal_entries set status='posted' where id=journal_id and company_id=new.company_id;
 new.journal_entry_id:=journal_id;
 return new;
end $$;
revoke all on function private.guard_receivable_allocation() from public,anon,authenticated;
create trigger receivable_payment_guard before insert or update or delete on public.payments
  for each row execute function private.guard_receivable_allocation();
create trigger receivable_credit_guard before insert or update or delete on public.credit_notes
  for each row execute function private.guard_receivable_allocation();

create function private.refresh_receivable_status() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.invoices set status=case when total <=
    coalesce((select sum(amount) from public.payments where company_id=new.company_id and invoice_id=new.invoice_id),0)+
    coalesce((select sum(amount) from public.credit_notes where company_id=new.company_id and invoice_id=new.invoice_id),0)
    then 'paid' else case when due_on<current_date then 'overdue' else 'sent' end end
   where company_id=new.company_id and id=new.invoice_id;
 return new;
end $$;
revoke all on function private.refresh_receivable_status() from public,anon,authenticated;
create trigger receivable_payment_status after insert on public.payments for each row execute function private.refresh_receivable_status();
create trigger receivable_credit_status after insert on public.credit_notes for each row execute function private.refresh_receivable_status();

create function public.record_invoice_payment(target_company_id uuid,target_invoice_id uuid,payment_date date,payment_amount numeric,payment_account_id_value uuid,payment_reference text,request_id_value uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare invoice public.invoices%rowtype; existing public.payments%rowtype; result uuid;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required'; end if;
 if request_id_value is null then raise exception 'Payment request ID is required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_company_id::text||'payment'||request_id_value::text,0));
 select * into existing from public.payments where company_id=target_company_id and request_id=request_id_value;
 if found then
   if (existing.invoice_id,existing.received_on,existing.amount,existing.payment_account_id,existing.reference) is distinct from (target_invoice_id,payment_date,payment_amount,payment_account_id_value,btrim(coalesce(payment_reference,''))) then raise exception 'Payment request ID was already used for different data'; end if;
   return existing.id;
 end if;
 select * into invoice from public.invoices where company_id=target_company_id and id=target_invoice_id for update;
 if not found then raise exception 'Invoice not found'; end if;
 insert into public.payments(company_id,invoice_id,customer_id,received_on,amount,payment_account_id,reference,created_by,request_id)
 values(target_company_id,invoice.id,invoice.customer_id,payment_date,payment_amount,payment_account_id_value,btrim(coalesce(payment_reference,'')),auth.uid(),request_id_value) returning id into result;
 return result;
end $$;
revoke all on function public.record_invoice_payment(uuid,uuid,date,numeric,uuid,text,uuid) from public,anon;
grant execute on function public.record_invoice_payment(uuid,uuid,date,numeric,uuid,text,uuid) to authenticated;

create function public.record_invoice_credit(target_company_id uuid,target_invoice_id uuid,credit_date date,credit_amount numeric,credit_reason text,request_id_value uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.credit_notes%rowtype; result uuid;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required'; end if;
 if request_id_value is null then raise exception 'Credit request ID is required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_company_id::text||'credit'||request_id_value::text,0));
 select * into existing from public.credit_notes where company_id=target_company_id and request_id=request_id_value;
 if found then
   if (existing.invoice_id,existing.credited_on,existing.amount,existing.reason) is distinct from (target_invoice_id,credit_date,credit_amount,btrim(credit_reason)) then raise exception 'Credit request ID was already used for different data'; end if;
   return existing.id;
 end if;
 insert into public.credit_notes(company_id,invoice_id,credited_on,amount,reason,created_by,request_id)
 values(target_company_id,target_invoice_id,credit_date,credit_amount,btrim(credit_reason),auth.uid(),request_id_value) returning id into result;
 return result;
end $$;
revoke all on function public.record_invoice_credit(uuid,uuid,date,numeric,text,uuid) from public,anon;
grant execute on function public.record_invoice_credit(uuid,uuid,date,numeric,text,uuid) to authenticated;

-- Prevent a ledger-only reversal from silently breaking the receivables subledger.
create function private.guard_receivable_reversal() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.reverses_entry_id is not null and (
   exists(select 1 from public.invoices where company_id=new.company_id and journal_entry_id=new.reverses_entry_id) or
   exists(select 1 from public.payments where company_id=new.company_id and journal_entry_id=new.reverses_entry_id) or
   exists(select 1 from public.credit_notes where company_id=new.company_id and journal_entry_id=new.reverses_entry_id)) then
   raise exception 'Use the receivables correction workflow for invoice journals';
 end if;
 return new;
end $$;
revoke all on function private.guard_receivable_reversal() from public,anon,authenticated;
create trigger receivable_reversal_guard before insert or update on public.journal_entries for each row execute function private.guard_receivable_reversal();
drop function public.save_invoice(uuid,uuid,text,date,date,text,text,jsonb);
create function public.save_invoice(target_company_id uuid,target_invoice_id uuid,customer_name text,issued_date date,due_date date,invoice_status text,invoice_notes text,line_items jsonb,request_id_value uuid default null)
returns table(id uuid,invoice_number bigint) language plpgsql security invoker set search_path='' as $$
declare customer_id_value uuid; result public.invoices%rowtype; subtotal_value numeric(14,2); tax_value numeric(14,2); payload jsonb;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required'; end if;
 if coalesce(btrim(customer_name),'')='' or issued_date is null or due_date is null or due_date<issued_date
   or invoice_status is null or invoice_status not in ('draft','sent','overdue')
   or jsonb_typeof(line_items) is distinct from 'array' then raise exception 'Invalid invoice; record payments separately'; end if;
 if jsonb_array_length(line_items)=0 then raise exception 'Invoice needs line items'; end if;
 if exists(select 1 from jsonb_array_elements(line_items) item where coalesce(btrim(item->>'description'),'')=''
   or coalesce((item->>'quantity')::numeric,0)<=0 or (item->>'unitPrice') is null or (item->>'taxRate') is null
   or (item->>'unitPrice')::numeric<0 or (item->>'taxRate')::numeric<0
   or (item->>'quantity')::numeric::text in ('NaN','Infinity','-Infinity')
   or (item->>'unitPrice')::numeric::text in ('NaN','Infinity','-Infinity')
   or (item->>'taxRate')::numeric::text in ('NaN','Infinity','-Infinity')) then raise exception 'Invalid invoice line'; end if;
 payload:=jsonb_build_object('customer',btrim(customer_name),'issued',issued_date,'due',due_date,'status',invoice_status,'notes',coalesce(invoice_notes,''),'items',line_items);
 if target_invoice_id is null and request_id_value is not null then
   perform pg_advisory_xact_lock(hashtextextended(target_company_id::text||'invoice'||request_id_value::text,0));
   select * into result from public.invoices i where i.company_id=target_company_id and i.creation_request_id=request_id_value;
   if found then
     if result.creation_payload is distinct from payload then raise exception 'Invoice request ID was already used for different data'; end if;
     return query select result.id,result.invoice_number; return;
   end if;
 end if;
 if target_invoice_id is not null then
   select * into result from public.invoices i where i.company_id=target_company_id and i.id=target_invoice_id for update;
   if not found then raise exception 'Invoice not found'; end if;
   if not result.ledger_managed then raise exception 'Legacy invoice requires accountant reconciliation before changes'; end if;
   if result.status<>'draft' then raise exception 'Issued invoices require a credit note or a new invoice'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(target_company_id::text||'customer'||lower(btrim(customer_name)),0));
 select c.id into customer_id_value from public.customers c where c.company_id=target_company_id and lower(c.name)=lower(btrim(customer_name)) order by c.id limit 1;
 if customer_id_value is null then insert into public.customers(company_id,name) values(target_company_id,btrim(customer_name)) returning public.customers.id into customer_id_value; end if;
 -- Round each input to the same precision as the stored invoice line before summing.
 select round(sum(round((item->>'quantity')::numeric,3)*round((item->>'unitPrice')::numeric,2)),2),
   round(sum(round((item->>'quantity')::numeric,3)*round((item->>'unitPrice')::numeric,2)*round((item->>'taxRate')::numeric,6)),2)
 into subtotal_value,tax_value from jsonb_array_elements(line_items) item;
 if target_invoice_id is null then
   insert into public.invoices(company_id,customer_id,issued_on,due_on,subtotal,tax,notes,created_by,creation_request_id,creation_payload)
   values(target_company_id,customer_id_value,issued_date,due_date,subtotal_value,tax_value,coalesce(invoice_notes,''),auth.uid(),request_id_value,payload) returning * into result;
 else
   update public.invoices i set customer_id=customer_id_value,issued_on=issued_date,due_on=due_date,subtotal=subtotal_value,tax=tax_value,notes=coalesce(invoice_notes,'')
     where i.company_id=target_company_id and i.id=target_invoice_id returning * into result;
   delete from public.invoice_items where company_id=target_company_id and invoice_id=result.id;
 end if;
 insert into public.invoice_items(company_id,invoice_id,description,quantity,unit_price,tax_rate,sort_order)
   select target_company_id,result.id,item->>'description',(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,(item->>'taxRate')::numeric,ordinality::int-1
   from jsonb_array_elements(line_items) with ordinality as rows(item,ordinality);
 update public.invoices i set status=invoice_status where i.company_id=target_company_id and i.id=result.id returning * into result;
 return query select result.id,result.invoice_number;
end $$;
revoke all on function public.save_invoice(uuid,uuid,text,date,date,text,text,jsonb,uuid) from public,anon;
grant execute on function public.save_invoice(uuid,uuid,text,date,date,text,text,jsonb,uuid) to authenticated;
commit;
