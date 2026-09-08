-- Link operational sources to accounting once, under source row locks.

drop policy "work_orders_select" on "public"."work_orders";


  create table "public"."operational_cost_links" (
    "id" uuid not null default gen_random_uuid(),
    "company_id" uuid not null,
    "fuel_entry_id" uuid,
    "work_order_id" uuid,
    "expense_id" uuid,
    "vendor_bill_id" uuid,
    "posted_on" date not null,
    "due_on" date,
    "cash_account_id" uuid,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."operational_cost_links" enable row level security;

CREATE INDEX operational_cost_cash_idx ON public.operational_cost_links USING btree (company_id, cash_account_id);

CREATE INDEX operational_cost_creator_idx ON public.operational_cost_links USING btree (created_by);

CREATE UNIQUE INDEX operational_cost_links_company_id_expense_id_key ON public.operational_cost_links USING btree (company_id, expense_id);

CREATE UNIQUE INDEX operational_cost_links_company_id_fuel_entry_id_key ON public.operational_cost_links USING btree (company_id, fuel_entry_id);

CREATE UNIQUE INDEX operational_cost_links_company_id_vendor_bill_id_key ON public.operational_cost_links USING btree (company_id, vendor_bill_id);

CREATE UNIQUE INDEX operational_cost_links_company_id_work_order_id_key ON public.operational_cost_links USING btree (company_id, work_order_id);

CREATE UNIQUE INDEX operational_cost_links_pkey ON public.operational_cost_links USING btree (id);

alter table "public"."operational_cost_links" add constraint "operational_cost_links_pkey" PRIMARY KEY using index "operational_cost_links_pkey";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_check" CHECK ((num_nonnulls(fuel_entry_id, work_order_id) = 1)) not valid;

alter table "public"."operational_cost_links" validate constraint "operational_cost_links_check";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_check1" CHECK ((num_nonnulls(expense_id, vendor_bill_id) = 1)) not valid;

alter table "public"."operational_cost_links" validate constraint "operational_cost_links_check1";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_check2" CHECK ((((expense_id IS NOT NULL) AND (cash_account_id IS NOT NULL) AND (due_on IS NULL)) OR ((vendor_bill_id IS NOT NULL) AND (cash_account_id IS NULL) AND (due_on >= posted_on)))) not valid;

alter table "public"."operational_cost_links" validate constraint "operational_cost_links_check2";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_company_id_cash_account_id_fkey" FOREIGN KEY (company_id, cash_account_id) REFERENCES public.chart_of_accounts(company_id, id) not valid;

alter table "public"."operational_cost_links" validate constraint "operational_cost_links_company_id_cash_account_id_fkey";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_company_id_expense_id_fkey" FOREIGN KEY (company_id, expense_id) REFERENCES public.expenses(company_id, id) not valid;

alter table "public"."operational_cost_links" validate constraint "operational_cost_links_company_id_expense_id_fkey";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_company_id_expense_id_key" UNIQUE using index "operational_cost_links_company_id_expense_id_key";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) not valid;

alter table "public"."operational_cost_links" validate constraint "operational_cost_links_company_id_fkey";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_company_id_fuel_entry_id_fkey" FOREIGN KEY (company_id, fuel_entry_id) REFERENCES public.fuel_entries(company_id, id) not valid;

alter table "public"."operational_cost_links" validate constraint "operational_cost_links_company_id_fuel_entry_id_fkey";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_company_id_fuel_entry_id_key" UNIQUE using index "operational_cost_links_company_id_fuel_entry_id_key";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_company_id_vendor_bill_id_fkey" FOREIGN KEY (company_id, vendor_bill_id) REFERENCES public.vendor_bills(company_id, id) not valid;

alter table "public"."operational_cost_links" validate constraint "operational_cost_links_company_id_vendor_bill_id_fkey";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_company_id_vendor_bill_id_key" UNIQUE using index "operational_cost_links_company_id_vendor_bill_id_key";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_company_id_work_order_id_fkey" FOREIGN KEY (company_id, work_order_id) REFERENCES public.work_orders(company_id, id) not valid;

alter table "public"."operational_cost_links" validate constraint "operational_cost_links_company_id_work_order_id_fkey";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_company_id_work_order_id_key" UNIQUE using index "operational_cost_links_company_id_work_order_id_key";

alter table "public"."operational_cost_links" add constraint "operational_cost_links_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."operational_cost_links" validate constraint "operational_cost_links_created_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.guard_invoiced_load()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if exists(select 1 from public.invoices where company_id=old.company_id and load_id=old.id) then
  if tg_op='DELETE' then raise exception 'Invoiced loads cannot be deleted';end if;
  if new.customer_id is distinct from old.customer_id or new.customer_rate is distinct from old.customer_rate or new.fuel_surcharge is distinct from old.fuel_surcharge or new.fees is distinct from old.fees or new.route_id is distinct from old.route_id or new.load_number is distinct from old.load_number or new.company_id is distinct from old.company_id or new.status not in ('delivered','invoiced','paid') then raise exception 'Invoiced load billing details cannot be changed';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.guard_load_invoice_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare source public.loads%rowtype;
begin
 if tg_op='UPDATE' then
  if old.load_id is not null and new.load_id is distinct from old.load_id then raise exception 'Invoice load links cannot be changed';end if;
  if old.journal_entry_id is not null then return new;end if;
 end if;
 if new.load_id is null then return new;end if;
 select * into source from public.loads where company_id=new.company_id and id=new.load_id for update;
 if not found or source.status<>'delivered' then raise exception 'A delivered load is required';end if;
 if exists(select 1 from public.invoices where company_id=new.company_id and load_id=new.load_id and id<>new.id) then raise exception 'Load already has an invoice';end if;
 if new.customer_id is distinct from source.customer_id or new.subtotal is distinct from source.customer_rate+source.fuel_surcharge or new.tax<>0 or new.discount<>0 then raise exception 'Invoice must match the load customer and freight charges';end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.guard_operational_cost_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare amount_value numeric; truck_value uuid; vendor_value uuid; fuel public.fuel_entries%rowtype; work public.work_orders%rowtype;
begin
 if tg_op<>'INSERT' then raise exception 'Accounting source links are permanent';end if;
 if auth.uid() is null or not private.has_company_role(new.company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
 if new.fuel_entry_id is not null then
  select * into fuel from public.fuel_entries where company_id=new.company_id and id=new.fuel_entry_id for update;
  if not found or fuel.status not in ('approved','posted') then raise exception 'An approved fuel entry is required';end if;
  amount_value:=fuel.total_cost;truck_value:=fuel.truck_id;
 else
  select * into work from public.work_orders where company_id=new.company_id and id=new.work_order_id for update;
  if not found or work.status<>'completed' then raise exception 'A completed work order is required';end if;
  amount_value:=(work.details->>'actualCost')::numeric;truck_value:=work.truck_id;vendor_value:=work.assigned_vendor_id;
 end if;
 if amount_value is null or amount_value<=0 or amount_value::text in ('NaN','Infinity','-Infinity') then raise exception 'A positive actual cost is required';end if;
 if new.expense_id is not null then
  if not exists(select 1 from public.expenses e where e.company_id=new.company_id and e.id=new.expense_id and e.status='posted' and e.journal_entry_id is not null and e.amount=amount_value and e.occurred_on=new.posted_on and e.cash_account_id=new.cash_account_id and e.truck_id is not distinct from truck_value and (vendor_value is null or e.vendor_id=vendor_value)) then raise exception 'Expense does not match the source cost';end if;
 else
  if not exists(select 1 from public.vendor_bills b where b.company_id=new.company_id and b.id=new.vendor_bill_id and b.status='open' and b.journal_entry_id is not null and b.amount=amount_value and b.issued_on=new.posted_on and b.due_on=new.due_on and (vendor_value is null or b.vendor_id=vendor_value)) then raise exception 'Bill does not match the source cost';end if;
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.guard_posted_operational_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if exists(select 1 from public.operational_cost_links l where l.company_id=old.company_id and (case tg_table_name when 'fuel_entries' then l.fuel_entry_id else l.work_order_id end)=old.id) then
  raise exception 'Posted operational costs cannot be edited or deleted; use an accounting correction';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.issue_load_invoice(target_company_id uuid, target_load_id uuid, issued_date date, due_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare source public.loads%rowtype; existing public.invoices%rowtype; result_id uuid; amount_value numeric;
begin
 if auth.uid() is null or not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
 if issued_date is null or due_date is null or due_date<issued_date then raise exception 'Valid issue and due dates are required';end if;
 select * into source from public.loads where company_id=target_company_id and id=target_load_id for update;
 if not found then raise exception 'Load not found';end if;
 select * into existing from public.invoices where company_id=target_company_id and load_id=target_load_id order by created_at,id limit 1;
 if found then
  if existing.issued_on is distinct from issued_date or existing.due_on is distinct from due_date or existing.journal_entry_id is null or existing.status='void' or existing.customer_id is distinct from source.customer_id or existing.subtotal is distinct from source.customer_rate+source.fuel_surcharge then raise exception 'Load already has an invoice; open it in Invoices';end if;
  return existing.id;
 end if;
 if source.status<>'delivered' or source.customer_id is null then raise exception 'A delivered load with a customer is required';end if;
 amount_value:=source.customer_rate+source.fuel_surcharge;
 if amount_value is null or amount_value<=0 or amount_value::text in ('NaN','Infinity','-Infinity') or source.customer_rate<0 or source.fuel_surcharge<0 then raise exception 'Positive freight charges are required';end if;
 insert into public.invoices(company_id,customer_id,load_id,issued_on,due_on,status,subtotal,notes,created_by)
 values(target_company_id,source.customer_id,source.id,issued_date,due_date,'draft',amount_value,'Freight for load '||source.load_number,auth.uid()) returning id into result_id;
 insert into public.invoice_items(company_id,invoice_id,description,quantity,unit_price,tax_rate,sort_order)
 values(target_company_id,result_id,'Freight for load '||source.load_number,1,amount_value,0,0);
 update public.invoices set status='sent' where id=result_id and company_id=target_company_id;
 update public.loads set status='invoiced' where id=source.id and company_id=target_company_id;
 return result_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.post_operational_cost(target_company_id uuid, source_kind text, source_id uuid, posting_kind text, posting_date date, due_date date DEFAULT NULL::date, paid_from_account_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare fuel public.fuel_entries%rowtype; work public.work_orders%rowtype; existing public.operational_cost_links%rowtype;
 amount_value numeric; vendor_value uuid; vendor_name text; truck_value uuid; driver_value uuid; load_value uuid; category uuid; result_id uuid; memo_value text;
begin
 if auth.uid() is null or not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
 if source_kind is null or source_kind not in ('fuel','maintenance') or posting_kind is null or posting_kind not in ('expense','bill') or posting_date is null then raise exception 'Invalid operational posting';end if;
 if (posting_kind='expense' and (paid_from_account_id is null or due_date is not null)) or (posting_kind='bill' and (paid_from_account_id is not null or due_date is null or due_date<posting_date)) then raise exception 'Choose a cash account for an expense or a due date for a bill';end if;
 if source_kind='fuel' then
  select * into fuel from public.fuel_entries where company_id=target_company_id and id=source_id for update;
  if not found or fuel.status not in ('approved','posted') then raise exception 'An approved fuel entry is required';end if;
  amount_value:=fuel.total_cost;vendor_name:=fuel.station_name;truck_value:=fuel.truck_id;driver_value:=fuel.driver_id;load_value:=fuel.load_id;
  memo_value:='Fuel '||coalesce(fuel.provider_transaction_id,source_id::text)||' · '||fuel.station_name;
 else
  select * into work from public.work_orders where company_id=target_company_id and id=source_id for update;
  if not found or work.status<>'completed' then raise exception 'A completed work order is required';end if;
  amount_value:=(work.details->>'actualCost')::numeric;vendor_value:=work.assigned_vendor_id;truck_value:=work.truck_id;
  memo_value:='Maintenance '||coalesce(work.details->>'reference',source_id::text)||' · '||work.issue;
 end if;
 select * into existing from public.operational_cost_links l where l.company_id=target_company_id and (case source_kind when 'fuel' then l.fuel_entry_id else l.work_order_id end)=source_id;
 if found then
  if (posting_kind='expense')<>(existing.expense_id is not null) or existing.posted_on is distinct from posting_date or existing.due_on is distinct from due_date or existing.cash_account_id is distinct from paid_from_account_id then raise exception 'Source already posted with different accounting details';end if;
  return coalesce(existing.expense_id,existing.vendor_bill_id);
 end if;
 if amount_value is null or amount_value<=0 or amount_value::text in ('NaN','Infinity','-Infinity') then raise exception 'A positive actual cost is required';end if;
 if source_kind='fuel' then
  select id into vendor_value from public.vendors where company_id=target_company_id and lower(name)=lower(btrim(vendor_name)) order by id limit 1;
  if vendor_value is null then insert into public.vendors(company_id,name) values(target_company_id,btrim(vendor_name)) returning id into vendor_value;end if;
 end if;
 if posting_kind='bill' and vendor_value is null then raise exception 'Assign a vendor before posting an unpaid bill';end if;
 category:=private.resolve_payable_ledger_account(target_company_id,case source_kind when 'fuel' then '5000 · Fuel expense' else '5200 · Maintenance expense' end,'expense');
 if posting_kind='expense' then
  insert into public.expenses(company_id,vendor_id,truck_id,driver_id,load_id,occurred_on,description,amount,status,created_by,cash_account_id,category_account_id)
  values(target_company_id,vendor_value,truck_value,driver_value,load_value,posting_date,memo_value,amount_value,'posted',auth.uid(),paid_from_account_id,category) returning id into result_id;
 else
  insert into public.vendor_bills(company_id,vendor_id,bill_number,issued_on,due_on,status,amount,description,expense_account_id,created_by)
  values(target_company_id,vendor_value,upper(source_kind)||'-'||source_id::text,posting_date,due_date,'open',amount_value,memo_value,category,auth.uid()) returning id into result_id;
 end if;
 insert into public.operational_cost_links(company_id,fuel_entry_id,work_order_id,expense_id,vendor_bill_id,posted_on,due_on,cash_account_id,created_by)
 values(target_company_id,case when source_kind='fuel' then source_id end,case when source_kind='maintenance' then source_id end,case when posting_kind='expense' then result_id end,case when posting_kind='bill' then result_id end,posting_date,due_date,paid_from_account_id,auth.uid());
 return result_id;
end $function$
;

grant insert on table "public"."operational_cost_links" to "authenticated";

grant select on table "public"."operational_cost_links" to "authenticated";

grant delete on table "public"."operational_cost_links" to "service_role";

grant insert on table "public"."operational_cost_links" to "service_role";

grant references on table "public"."operational_cost_links" to "service_role";

grant select on table "public"."operational_cost_links" to "service_role";

grant trigger on table "public"."operational_cost_links" to "service_role";

grant truncate on table "public"."operational_cost_links" to "service_role";

grant update on table "public"."operational_cost_links" to "service_role";


  create policy "operational_cost_insert"
  on "public"."operational_cost_links"
  as permissive
  for insert
  to authenticated
with check (((created_by = ( SELECT auth.uid() AS uid)) AND private.has_company_role(company_id, ARRAY['owner'::public.member_role, 'administrator'::public.member_role, 'accountant'::public.member_role])));



  create policy "operational_cost_read"
  on "public"."operational_cost_links"
  as permissive
  for select
  to authenticated
using (private.has_company_role(company_id, ARRAY['owner'::public.member_role, 'administrator'::public.member_role, 'accountant'::public.member_role, 'fleet_manager'::public.member_role, 'dispatcher'::public.member_role, 'payroll_manager'::public.member_role, 'auditor'::public.member_role]));



  create policy "work_orders_select"
  on "public"."work_orders"
  as permissive
  for select
  to authenticated
using (((reported_by = ( SELECT auth.uid() AS uid)) OR private.has_company_role(company_id, ARRAY['owner'::public.member_role, 'administrator'::public.member_role, 'fleet_manager'::public.member_role, 'accountant'::public.member_role, 'auditor'::public.member_role])));


CREATE TRIGGER guard_posted_fuel BEFORE DELETE OR UPDATE ON public.fuel_entries FOR EACH ROW EXECUTE FUNCTION private.guard_posted_operational_source();

CREATE TRIGGER guard_load_invoice_link BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.guard_load_invoice_link();

CREATE TRIGGER guard_invoiced_load BEFORE DELETE OR UPDATE ON public.loads FOR EACH ROW EXECUTE FUNCTION private.guard_invoiced_load();

CREATE TRIGGER audit_operational_cost_link AFTER INSERT OR DELETE OR UPDATE ON public.operational_cost_links FOR EACH ROW EXECUTE FUNCTION private.capture_audit_event();

CREATE TRIGGER guard_operational_cost_link BEFORE INSERT OR DELETE OR UPDATE ON public.operational_cost_links FOR EACH ROW EXECUTE FUNCTION private.guard_operational_cost_link();

CREATE TRIGGER guard_posted_work_order BEFORE DELETE OR UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION private.guard_posted_operational_source();



-- Preserve the reviewed ACLs: schema diff does not emit function privilege changes.
revoke all on table public.operational_cost_links from public, anon, authenticated;
grant select, insert on table public.operational_cost_links to authenticated;
revoke all on function public.post_operational_cost(uuid,text,uuid,text,date,date,uuid), public.issue_load_invoice(uuid,uuid,date,date) from public, anon;
grant execute on function public.post_operational_cost(uuid,text,uuid,text,date,date,uuid), public.issue_load_invoice(uuid,uuid,date,date) to authenticated;
revoke all on function private.guard_operational_cost_link(), private.guard_posted_operational_source(), private.guard_load_invoice_link(), private.guard_invoiced_load() from public, anon;
