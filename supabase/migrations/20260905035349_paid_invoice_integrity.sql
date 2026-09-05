create or replace function public.save_invoice(
  target_company_id uuid,
  target_invoice_id uuid,
  customer_name text,
  issued_date date,
  due_date date,
  invoice_status text,
  invoice_notes text,
  line_items jsonb
) returns table(id uuid, invoice_number bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  customer_id_value uuid;
  invoice_id_value uuid;
  invoice_number_value bigint;
  subtotal_value numeric(14,2);
  tax_value numeric(14,2);
  unpaid_value numeric(14,2);
  existing_status text;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not private.has_company_role(target_company_id, array['owner','administrator','accountant']::public.member_role[]) then
    raise exception 'Finance access required';
  end if;
  if target_invoice_id is not null then
    select i.status into existing_status from public.invoices i where i.id=target_invoice_id and i.company_id=target_company_id for update;
    if not found then raise exception 'Invoice not found'; end if;
    if existing_status='paid' then raise exception 'Paid invoices require a credit note or adjustment'; end if;
  end if;
  if btrim(customer_name) = '' or due_date < issued_date or jsonb_typeof(line_items) <> 'array' or jsonb_array_length(line_items) = 0 then
    raise exception 'Invalid invoice';
  end if;
  if invoice_status not in ('draft','sent','overdue','paid') then raise exception 'Invalid invoice status'; end if;
  if exists(select 1 from jsonb_array_elements(line_items) item where btrim(item->>'description')='' or (item->>'quantity')::numeric<=0 or (item->>'unitPrice')::numeric<0 or (item->>'taxRate')::numeric<0) then
    raise exception 'Invalid invoice line';
  end if;
  select c.id into customer_id_value from public.customers c where c.company_id=target_company_id and lower(c.name)=lower(btrim(customer_name)) limit 1;
  if customer_id_value is null then insert into public.customers(company_id,name) values(target_company_id,btrim(customer_name)) returning public.customers.id into customer_id_value; end if;
  select coalesce(sum((item->>'quantity')::numeric*(item->>'unitPrice')::numeric),0),coalesce(sum((item->>'quantity')::numeric*(item->>'unitPrice')::numeric*(item->>'taxRate')::numeric),0) into subtotal_value,tax_value from jsonb_array_elements(line_items) item;
  if target_invoice_id is null then
    insert into public.invoices(company_id,customer_id,issued_on,due_on,status,subtotal,tax,notes,created_by) values(target_company_id,customer_id_value,issued_date,due_date,'draft',subtotal_value,tax_value,invoice_notes,current_user_id) returning public.invoices.id,public.invoices.invoice_number into invoice_id_value,invoice_number_value;
  else
    update public.invoices i set customer_id=customer_id_value,issued_on=issued_date,due_on=due_date,status='draft',subtotal=subtotal_value,tax=tax_value,notes=invoice_notes where i.id=target_invoice_id and i.company_id=target_company_id returning i.id,i.invoice_number into invoice_id_value,invoice_number_value;
    if invoice_id_value is null then raise exception 'Invoice not found'; end if;
    delete from public.invoice_items where invoice_id=invoice_id_value and company_id=target_company_id;
  end if;
  insert into public.invoice_items(company_id,invoice_id,description,quantity,unit_price,tax_rate,sort_order) select target_company_id,invoice_id_value,item->>'description',(item->>'quantity')::numeric,(item->>'unitPrice')::numeric,(item->>'taxRate')::numeric,ordinality::int-1 from jsonb_array_elements(line_items) with ordinality as rows(item,ordinality);
  if invoice_status='paid' then
    select greatest(0,i.total-coalesce((select sum(p.amount) from public.payments p where p.invoice_id=i.id),0)-coalesce((select sum(c.amount) from public.credit_notes c where c.invoice_id=i.id),0)) into unpaid_value from public.invoices i where i.id=invoice_id_value;
    if unpaid_value>0 then insert into public.payments(company_id,invoice_id,customer_id,received_on,amount,reference,created_by) values(target_company_id,invoice_id_value,customer_id_value,current_date,unpaid_value,'Marked paid from invoice workspace',current_user_id);end if;
  end if;
  update public.invoices i set status=invoice_status where i.id=invoice_id_value and i.company_id=target_company_id;
  return query select invoice_id_value,invoice_number_value;
end;
$$;
revoke all on function public.save_invoice(uuid,uuid,text,date,date,text,text,jsonb) from public, anon;
grant execute on function public.save_invoice(uuid,uuid,text,date,date,text,text,jsonb) to authenticated;

create or replace function private.protect_paid_invoice_delete() returns trigger language plpgsql set search_path='' as $$
begin if old.status='paid' then raise exception 'Paid invoices require a credit note or adjustment';end if;return old;end $$;
create trigger paid_invoice_delete_guard before delete on public.invoices for each row execute function private.protect_paid_invoice_delete();
create or replace function private.protect_paid_invoice_line() returns trigger language plpgsql set search_path='' as $$
declare old_id uuid;new_id uuid;invoice record;
begin
 if tg_op<>'INSERT' then old_id:=old.invoice_id;end if;
 if tg_op<>'DELETE' then new_id:=new.invoice_id;end if;
 for invoice in select id,status from public.invoices where id in(old_id,new_id) order by id for update loop
  if invoice.status='paid' then raise exception 'Paid invoice lines require a credit note or adjustment';end if;
 end loop;
 return coalesce(new,old);
end $$;
create trigger paid_invoice_line_guard before insert or update or delete on public.invoice_items for each row execute function private.protect_paid_invoice_line();
