-- Internal accounting posting, immutable corrections and period administration.

drop function if exists "public"."save_driver_settlement"(target_company_id uuid, target_settlement_id uuid, driver_name text, period_start date, period_end date, load_count integer, gross_pay_value numeric, reimbursements_value numeric, deductions_value numeric, status_value public.record_status, paid_date date);

drop function if exists "public"."save_transaction"(target_company_id uuid, target_record_id uuid, previous_kind text, new_kind text, transaction_date date, partner_name text, description_value text, amount_value numeric, status_value public.record_status);


  create table "private"."accounting_requests" (
    "company_id" uuid not null,
    "request_id" uuid not null,
    "operation" text not null,
    "payload" jsonb not null,
    "result_id" uuid not null,
    "created_by" uuid not null default auth.uid()
      );


alter table "private"."accounting_requests" enable row level security;


  create table "public"."customer_payment_adjustments" (
    "id" uuid not null default gen_random_uuid(),
    "company_id" uuid not null,
    "invoice_id" uuid not null,
    "payment_id" uuid,
    "kind" text not null,
    "adjusted_on" date not null,
    "amount" numeric(14,2) not null,
    "reason" text not null,
    "cash_account_id" uuid not null,
    "journal_entry_id" uuid,
    "request_id" uuid not null,
    "created_by" uuid not null default auth.uid(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."customer_payment_adjustments" enable row level security;

alter table "public"."driver_settlements" add column "cash_account_id" uuid;

alter table "public"."driver_settlements" add column "journal_entry_id" uuid;

alter table "public"."expenses" add column "cash_account_id" uuid;

alter table "public"."expenses" add column "category_account_id" uuid;

alter table "public"."expenses" add column "journal_entry_id" uuid;

alter table "public"."income" add column "cash_account_id" uuid;

alter table "public"."income" add column "category_account_id" uuid;

alter table "public"."income" add column "journal_entry_id" uuid;

CREATE INDEX accounting_requests_actor_idx ON private.accounting_requests USING btree (created_by);

CREATE UNIQUE INDEX accounting_requests_pkey ON private.accounting_requests USING btree (company_id, request_id);

CREATE INDEX customer_adjustments_actor_idx ON public.customer_payment_adjustments USING btree (created_by);

CREATE INDEX customer_adjustments_cash_idx ON public.customer_payment_adjustments USING btree (company_id, cash_account_id);

CREATE INDEX customer_adjustments_invoice_idx ON public.customer_payment_adjustments USING btree (company_id, invoice_id);

CREATE UNIQUE INDEX customer_payment_adjustments_company_id_journal_entry_id_key ON public.customer_payment_adjustments USING btree (company_id, journal_entry_id);

CREATE UNIQUE INDEX customer_payment_adjustments_company_id_payment_id_key ON public.customer_payment_adjustments USING btree (company_id, payment_id);

CREATE UNIQUE INDEX customer_payment_adjustments_company_id_request_id_key ON public.customer_payment_adjustments USING btree (company_id, request_id);

CREATE UNIQUE INDEX customer_payment_adjustments_pkey ON public.customer_payment_adjustments USING btree (id);

CREATE INDEX expenses_cash_idx ON public.expenses USING btree (company_id, cash_account_id);

CREATE INDEX expenses_category_idx ON public.expenses USING btree (company_id, category_account_id);

CREATE UNIQUE INDEX expenses_journal_unique ON public.expenses USING btree (company_id, journal_entry_id);

CREATE INDEX income_cash_idx ON public.income USING btree (company_id, cash_account_id);

CREATE INDEX income_category_idx ON public.income USING btree (company_id, category_account_id);

CREATE UNIQUE INDEX income_journal_unique ON public.income USING btree (company_id, journal_entry_id);

CREATE INDEX settlements_cash_idx ON public.driver_settlements USING btree (company_id, cash_account_id);

CREATE UNIQUE INDEX settlements_journal_unique ON public.driver_settlements USING btree (company_id, journal_entry_id);

alter table "private"."accounting_requests" add constraint "accounting_requests_pkey" PRIMARY KEY using index "accounting_requests_pkey";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_pkey" PRIMARY KEY using index "customer_payment_adjustments_pkey";

alter table "private"."accounting_requests" add constraint "accounting_requests_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) not valid;

alter table "private"."accounting_requests" validate constraint "accounting_requests_company_id_fkey";

alter table "private"."accounting_requests" add constraint "accounting_requests_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) not valid;

alter table "private"."accounting_requests" validate constraint "accounting_requests_created_by_fkey";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_amount_check" CHECK ((amount > (0)::numeric)) not valid;

alter table "public"."customer_payment_adjustments" validate constraint "customer_payment_adjustments_amount_check";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_company_id_cash_account_id_fkey" FOREIGN KEY (company_id, cash_account_id) REFERENCES public.chart_of_accounts(company_id, id) not valid;

alter table "public"."customer_payment_adjustments" validate constraint "customer_payment_adjustments_company_id_cash_account_id_fkey";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) not valid;

alter table "public"."customer_payment_adjustments" validate constraint "customer_payment_adjustments_company_id_fkey";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_company_id_invoice_id_fkey" FOREIGN KEY (company_id, invoice_id) REFERENCES public.invoices(company_id, id) not valid;

alter table "public"."customer_payment_adjustments" validate constraint "customer_payment_adjustments_company_id_invoice_id_fkey";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_company_id_journal_entry_id_fkey" FOREIGN KEY (company_id, journal_entry_id) REFERENCES public.journal_entries(company_id, id) not valid;

alter table "public"."customer_payment_adjustments" validate constraint "customer_payment_adjustments_company_id_journal_entry_id_fkey";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_company_id_journal_entry_id_key" UNIQUE using index "customer_payment_adjustments_company_id_journal_entry_id_key";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_company_id_payment_id_fkey" FOREIGN KEY (company_id, payment_id) REFERENCES public.payments(company_id, id) not valid;

alter table "public"."customer_payment_adjustments" validate constraint "customer_payment_adjustments_company_id_payment_id_fkey";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_company_id_payment_id_key" UNIQUE using index "customer_payment_adjustments_company_id_payment_id_key";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_company_id_request_id_key" UNIQUE using index "customer_payment_adjustments_company_id_request_id_key";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) not valid;

alter table "public"."customer_payment_adjustments" validate constraint "customer_payment_adjustments_created_by_fkey";

alter table "public"."customer_payment_adjustments" add constraint "customer_payment_adjustments_kind_check" CHECK ((kind = ANY (ARRAY['reversal'::text, 'refund'::text]))) not valid;

alter table "public"."customer_payment_adjustments" validate constraint "customer_payment_adjustments_kind_check";

alter table "public"."driver_settlements" add constraint "settlements_cash_fk" FOREIGN KEY (company_id, cash_account_id) REFERENCES public.chart_of_accounts(company_id, id) not valid;

alter table "public"."driver_settlements" validate constraint "settlements_cash_fk";

alter table "public"."driver_settlements" add constraint "settlements_journal_fk" FOREIGN KEY (company_id, journal_entry_id) REFERENCES public.journal_entries(company_id, id) not valid;

alter table "public"."driver_settlements" validate constraint "settlements_journal_fk";

alter table "public"."expenses" add constraint "expenses_cash_fk" FOREIGN KEY (company_id, cash_account_id) REFERENCES public.chart_of_accounts(company_id, id) not valid;

alter table "public"."expenses" validate constraint "expenses_cash_fk";

alter table "public"."expenses" add constraint "expenses_category_fk" FOREIGN KEY (company_id, category_account_id) REFERENCES public.chart_of_accounts(company_id, id) not valid;

alter table "public"."expenses" validate constraint "expenses_category_fk";

alter table "public"."expenses" add constraint "expenses_journal_fk" FOREIGN KEY (company_id, journal_entry_id) REFERENCES public.journal_entries(company_id, id) not valid;

alter table "public"."expenses" validate constraint "expenses_journal_fk";

alter table "public"."income" add constraint "income_cash_fk" FOREIGN KEY (company_id, cash_account_id) REFERENCES public.chart_of_accounts(company_id, id) not valid;

alter table "public"."income" validate constraint "income_cash_fk";

alter table "public"."income" add constraint "income_category_fk" FOREIGN KEY (company_id, category_account_id) REFERENCES public.chart_of_accounts(company_id, id) not valid;

alter table "public"."income" validate constraint "income_category_fk";

alter table "public"."income" add constraint "income_journal_fk" FOREIGN KEY (company_id, journal_entry_id) REFERENCES public.journal_entries(company_id, id) not valid;

alter table "public"."income" validate constraint "income_journal_fk";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.guard_customer_adjustment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare inv public.invoices%rowtype; payment public.payments%rowtype; paid numeric; credited numeric; adjusted numeric;ar uuid;journal uuid;
begin
 if tg_op<>'INSERT' then raise exception 'Customer payment corrections are immutable';end if;
 if not private.has_company_role(new.company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
 select * into inv from public.invoices where company_id=new.company_id and id=new.invoice_id for update;
 if not found or not inv.ledger_managed or inv.journal_entry_id is null then raise exception 'A posted ledger-managed invoice is required';end if;
 if new.adjusted_on<inv.issued_on or new.adjusted_on>current_date or coalesce(btrim(new.reason),'')='' or new.amount::text in ('NaN','Infinity','-Infinity') or new.journal_entry_id is not null or new.created_by is distinct from auth.uid() then raise exception 'Invalid correction amount, date or reason';end if;
 select coalesce(sum(amount),0) into paid from public.payments where company_id=new.company_id and invoice_id=inv.id;
 select coalesce(sum(amount),0) into credited from public.credit_notes where company_id=new.company_id and invoice_id=inv.id;
 select coalesce(sum(amount),0) into adjusted from public.customer_payment_adjustments where company_id=new.company_id and invoice_id=inv.id;
 if new.amount>paid-adjusted then raise exception 'Correction exceeds recorded customer payments';end if;
 if new.kind='reversal' then
  select * into payment from public.payments where company_id=new.company_id and id=new.payment_id and invoice_id=inv.id;
  if not found or payment.journal_entry_id is null or new.amount<>payment.amount or new.adjusted_on<payment.received_on or new.cash_account_id<>payment.payment_account_id then raise exception 'Reverse the full payment against its original account and a valid date';end if;
 elsif new.payment_id is not null or new.amount>paid+credited-adjusted-inv.total then raise exception 'Refund exceeds available customer credit';end if;
 if exists(select 1 from public.payments where company_id=new.company_id and invoice_id=inv.id and received_on>new.adjusted_on) or exists(select 1 from public.credit_notes where company_id=new.company_id and invoice_id=inv.id and credited_on>new.adjusted_on) or exists(select 1 from public.customer_payment_adjustments where company_id=new.company_id and invoice_id=inv.id and adjusted_on>new.adjusted_on) then raise exception 'Correction date must not precede existing allocations';end if;
 if not exists(select 1 from public.chart_of_accounts where company_id=new.company_id and id=new.cash_account_id and active and account_type='asset' and account_number<>'1100') then raise exception 'Choose an active cash or bank account';end if;
 ar:=private.resolve_payable_ledger_account(new.company_id,'1100 · Accounts receivable','asset');
 insert into public.journal_entries(company_id,entry_date,memo,created_by) values(new.company_id,new.adjusted_on,'Customer '||new.kind||': '||new.reason,auth.uid()) returning id into journal;
 insert into public.journal_lines(company_id,journal_entry_id,account_id,debit,credit,customer_id) values(new.company_id,journal,ar,new.amount,0,inv.customer_id),(new.company_id,journal,new.cash_account_id,0,new.amount,inv.customer_id);
 update public.journal_entries set status='posted',posted_at=now(),posted_by=auth.uid() where id=journal;
 new.journal_entry_id:=journal;return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.post_money_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cash uuid; category uuid; journal uuid; amount_value numeric; date_value date; required_type public.account_type; memo_value text; deduction_account uuid; reimbursement_account uuid;
begin
 if tg_op='DELETE' then
  if old.status='posted' or old.journal_entry_id is not null then raise exception 'Posted records must be reversed, not deleted';end if;
  return old;
 end if;
 if tg_op='UPDATE' then
  if (old.status='posted' or old.journal_entry_id is not null) and new is distinct from old then raise exception 'Posted records must be reversed, not edited';end if;
  if new.journal_entry_id is distinct from old.journal_entry_id then raise exception 'Journal links are managed by posting';end if;
 elsif new.journal_entry_id is not null then raise exception 'Journal links are managed by posting';end if;
 if new.status<>'posted' or (tg_op='UPDATE' and old.status='posted') then return new;end if;
 if not private.has_company_role(new.company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access is required to post payment';end if;
 cash:=coalesce(new.cash_account_id,private.resolve_payable_ledger_account(new.company_id,'1000 · Cash','asset'));
 if not exists(select 1 from public.chart_of_accounts where company_id=new.company_id and id=cash and account_type='asset' and active and account_number<>'1100') then raise exception 'Choose an active cash or bank asset account';end if;
 if tg_table_name='driver_settlements' then
  date_value:=new.paid_on;amount_value:=new.gross_pay+new.reimbursements;
  memo_value:='Driver settlement '||new.id::text;
  category:=private.resolve_payable_ledger_account(new.company_id,'5100 · Driver compensation','expense');
 else
  date_value:=case tg_table_name when 'income' then (to_jsonb(new)->>'received_on')::date else (to_jsonb(new)->>'occurred_on')::date end;
  amount_value:=new.amount;memo_value:=new.description;
  required_type:=case tg_table_name when 'income' then 'income'::public.account_type else 'expense'::public.account_type end;
  category:=coalesce(new.category_account_id,private.resolve_payable_ledger_account(new.company_id,case tg_table_name when 'income' then '4900 · Other income' else '5900 · General expenses' end,required_type));
  if not exists(select 1 from public.chart_of_accounts where company_id=new.company_id and id=category and account_type=required_type and active) then raise exception 'Choose an active income or expense category';end if;
  new.category_account_id:=category;
 end if;
 if date_value is null or amount_value<=0 or amount_value::text in ('NaN','Infinity','-Infinity') then raise exception 'A positive finite amount and posting date are required';end if;
 insert into public.journal_entries(company_id,entry_date,memo,created_by) values(new.company_id,date_value,memo_value,auth.uid()) returning id into journal;
 if tg_table_name='driver_settlements' then
  if new.gross_pay>0 then insert into public.journal_lines(company_id,journal_entry_id,account_id,debit) values(new.company_id,journal,category,new.gross_pay);end if;
  if new.reimbursements>0 then
   reimbursement_account:=private.resolve_payable_ledger_account(new.company_id,'5150 · Driver reimbursements','expense');
   insert into public.journal_lines(company_id,journal_entry_id,account_id,debit) values(new.company_id,journal,reimbursement_account,new.reimbursements);
  end if;
  if new.authorized_deductions>0 then
   deduction_account:=private.resolve_payable_ledger_account(new.company_id,'2350 · Driver deductions payable','liability');
   insert into public.journal_lines(company_id,journal_entry_id,account_id,credit) values(new.company_id,journal,deduction_account,new.authorized_deductions);
  end if;
  if amount_value-new.authorized_deductions>0 then insert into public.journal_lines(company_id,journal_entry_id,account_id,credit) values(new.company_id,journal,cash,amount_value-new.authorized_deductions);end if;
 else
  insert into public.journal_lines(company_id,journal_entry_id,account_id,debit,credit) values
   (new.company_id,journal,cash,case when tg_table_name='income' then amount_value else 0 end,case when tg_table_name='income' then 0 else amount_value end),
   (new.company_id,journal,category,case when tg_table_name='income' then 0 else amount_value end,case when tg_table_name='income' then amount_value else 0 end);
 end if;
 update public.journal_entries set status='posted',posted_at=now(),posted_by=auth.uid() where id=journal;
 new.journal_entry_id:=journal;new.cash_account_id:=cash;return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.protect_account_definition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if (new.company_id,new.id,new.account_number,new.account_type) is distinct from (old.company_id,old.id,old.account_number,old.account_type) and exists(select 1 from public.journal_lines where company_id=old.company_id and account_id=old.id) then raise exception 'Used account numbers and types cannot be changed';end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.save_driver_settlement(target_company_id uuid, target_settlement_id uuid, driver_name text, period_start date, period_end date, load_count integer, gross_pay_value numeric, reimbursements_value numeric, deductions_value numeric, status_value public.record_status, paid_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.save_transaction(target_company_id uuid, target_record_id uuid, previous_kind text, new_kind text, transaction_date date, partner_name text, description_value text, amount_value numeric, status_value public.record_status)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION private.serialize_accounting_period()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 perform pg_advisory_xact_lock(hashtextextended(coalesce(new.company_id,old.company_id)::text||':accounting-period',0));
 if tg_op='DELETE' then return old;end if;return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.manage_ledger_account(target_company_id uuid, target_account_id uuid, number_value text, name_value text, type_value public.account_type, active_value boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result uuid;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Accounting access required';end if;
 if number_value !~ '^[0-9][0-9A-Za-z.-]{0,19}$' or coalesce(btrim(name_value),'')='' or type_value is null or active_value is null then raise exception 'Valid account number, name and type are required';end if;
 if target_account_id is null then
  insert into public.chart_of_accounts(company_id,account_number,name,account_type,active) values(target_company_id,number_value,btrim(name_value),type_value,active_value) returning id into result;
 else
  update public.chart_of_accounts set account_number=number_value,name=btrim(name_value),account_type=type_value,active=active_value where company_id=target_company_id and id=target_account_id returning id into result;
  if not found then raise exception 'Account not found';end if;
 end if;return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.record_customer_payment_adjustment(target_company_id uuid, target_invoice_id uuid, payment_id_value uuid, kind_value text, date_value date, amount_value numeric, reason_value text, cash_account_id_value uuid, request_id_value uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare existing public.customer_payment_adjustments%rowtype; result uuid;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
 if request_id_value is null then raise exception 'Request ID is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_company_id::text||'customer-adjustment'||request_id_value::text,0));
 select * into existing from public.customer_payment_adjustments where company_id=target_company_id and request_id=request_id_value;
 if found then
  if (existing.invoice_id,existing.payment_id,existing.kind,existing.adjusted_on,existing.amount,existing.reason,existing.cash_account_id) is distinct from (target_invoice_id,payment_id_value,kind_value,date_value,amount_value,btrim(reason_value),cash_account_id_value) then raise exception 'Request ID was already used with different details';end if;return existing.id;
 end if;
 insert into public.customer_payment_adjustments(company_id,invoice_id,payment_id,kind,adjusted_on,amount,reason,cash_account_id,request_id) values(target_company_id,target_invoice_id,payment_id_value,kind_value,date_value,amount_value,btrim(reason_value),cash_account_id_value,request_id_value) returning id into result;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.reverse_money_record(target_company_id uuid, record_kind text, target_record_id uuid, reversal_date date, reason_value text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare source_journal uuid; result uuid;date_value date;table_name text;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) or (record_kind='settlement' and not private.has_company_role(target_company_id,array['owner','administrator']::public.member_role[])) then raise exception 'Finance access required';end if;
 if record_kind not in ('income','expense','settlement') or coalesce(btrim(reason_value),'')='' then raise exception 'Record type and correction reason are required';end if;
 table_name:=case record_kind when 'income' then 'income' when 'expense' then 'expenses' else 'driver_settlements' end;
 execute format('select journal_entry_id from public.%I where company_id=$1 and id=$2 for update',table_name) into source_journal using target_company_id,target_record_id;
 if source_journal is null then raise exception 'This historical or unposted record has no journal to reverse';end if;
 select entry_date into date_value from public.journal_entries where company_id=target_company_id and id=source_journal;
 if reversal_date is null or reversal_date<date_value or reversal_date>current_date then raise exception 'Correction date must be between posting date and today';end if;
 select id into result from public.journal_entries where company_id=target_company_id and reverses_entry_id=source_journal;
 if found then return result;end if;
 insert into public.journal_entries(company_id,entry_date,memo,reverses_entry_id,created_by) values(target_company_id,reversal_date,'Correction: '||btrim(reason_value),source_journal,auth.uid()) returning id into result;
 insert into public.journal_lines(company_id,journal_entry_id,account_id,description,debit,credit,customer_id,vendor_id,truck_id,load_id)
 select company_id,result,account_id,description,credit,debit,customer_id,vendor_id,truck_id,load_id from public.journal_lines where company_id=target_company_id and journal_entry_id=source_journal;
 update public.journal_entries set status='posted',posted_by=auth.uid(),posted_at=now() where id=result;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.save_driver_settlement(target_company_id uuid, target_settlement_id uuid, driver_name text, period_start date, period_end date, load_count integer, gross_pay_value numeric, reimbursements_value numeric, deductions_value numeric, status_value public.record_status, paid_date date, cash_account_id_value uuid DEFAULT NULL::uuid, request_id_value uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result uuid; existing private.accounting_requests%rowtype;payload_value jsonb:=jsonb_build_array(target_settlement_id,driver_name,period_start,period_end,load_count,gross_pay_value,reimbursements_value,deductions_value,status_value,paid_date,cash_account_id_value);
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','payroll_manager']::public.member_role[]) then raise exception 'Payroll access required';end if;
 if request_id_value is not null then
  perform pg_advisory_xact_lock(hashtextextended(target_company_id::text||request_id_value::text,0));
  select * into existing from private.accounting_requests where company_id=target_company_id and request_id=request_id_value;
  if found then if existing.operation<>'settlement' or existing.payload<>payload_value then raise exception 'Request ID was already used with different details';end if;return existing.result_id;end if;
 end if;
 result:=private.save_driver_settlement(target_company_id,target_settlement_id,driver_name,period_start,period_end,load_count,gross_pay_value,reimbursements_value,deductions_value,case when status_value='posted' then 'approved'::public.record_status else status_value end,paid_date);
 update public.driver_settlements set cash_account_id=cash_account_id_value,status=status_value where id=result and company_id=target_company_id;
 if request_id_value is not null then insert into private.accounting_requests(company_id,request_id,operation,payload,result_id) values(target_company_id,request_id_value,'settlement',payload_value,result);end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.save_transaction(target_company_id uuid, target_record_id uuid, previous_kind text, new_kind text, transaction_date date, partner_name text, description_value text, amount_value numeric, status_value public.record_status, cash_account_id_value uuid DEFAULT NULL::uuid, category_account_id_value uuid DEFAULT NULL::uuid, request_id_value uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result uuid; existing private.accounting_requests%rowtype; payload_value jsonb:=jsonb_build_array(target_record_id,previous_kind,new_kind,transaction_date,partner_name,description_value,amount_value,status_value,cash_account_id_value,category_account_id_value);table_name text;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
 if request_id_value is not null then
  perform pg_advisory_xact_lock(hashtextextended(target_company_id::text||request_id_value::text,0));
  select * into existing from private.accounting_requests where company_id=target_company_id and request_id=request_id_value;
  if found then if existing.operation<>'transaction' or existing.payload<>payload_value then raise exception 'Request ID was already used with different details';end if;return existing.result_id;end if;
 end if;
 result:=private.save_transaction(target_company_id,target_record_id,previous_kind,new_kind,transaction_date,partner_name,description_value,amount_value,case when status_value='posted' then 'approved'::public.record_status else status_value end);
 table_name:=case new_kind when 'income' then 'income' else 'expenses' end;
 execute format('update public.%I set cash_account_id=$1,category_account_id=$2,status=$3 where id=$4 and company_id=$5',table_name) using cash_account_id_value,category_account_id_value,status_value,result,target_company_id;
 if request_id_value is not null then insert into private.accounting_requests(company_id,request_id,operation,payload,result_id) values(target_company_id,request_id_value,'transaction',payload_value,result);end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_accounting_period_closed(target_company_id uuid, start_date date, end_date date, closed_value boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result uuid;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator']::public.member_role[]) then raise exception 'Owner or administrator access required';end if;
 if start_date is null or end_date is null or start_date>end_date or end_date>=current_date or closed_value is null then raise exception 'Choose a completed date range';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_company_id::text||':accounting-period',0));
 if exists(select 1 from public.accounting_periods where company_id=target_company_id and starts_on<=end_date and ends_on>=start_date and (starts_on,ends_on)<>(start_date,end_date)) then raise exception 'Accounting periods cannot overlap';end if;
 if closed_value and exists(select 1 from public.journal_entries where company_id=target_company_id and entry_date between start_date and end_date and status='draft') then raise exception 'Post or remove draft journals before closing the period';end if;
 insert into public.accounting_periods(company_id,starts_on,ends_on,closed_at,closed_by) values(target_company_id,start_date,end_date,case when closed_value then now() end,case when closed_value then auth.uid() end)
 on conflict(company_id,starts_on,ends_on) do update set closed_at=excluded.closed_at,closed_by=excluded.closed_by returning id into result;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION private.guard_receivable_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
   select coalesce((select sum(amount) from public.payments where company_id=new.company_id and invoice_id=invoice.id),0) - coalesce((select sum(amount) from public.customer_payment_adjustments where company_id=new.company_id and invoice_id=invoice.id),0)
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
end $function$
;

CREATE OR REPLACE FUNCTION private.guard_receivable_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    select coalesce((select sum(amount) from public.payments where company_id=new.company_id and invoice_id=new.id),0) - coalesce((select sum(amount) from public.customer_payment_adjustments where company_id=new.company_id and invoice_id=new.id),0)
         + coalesce((select sum(amount) from public.credit_notes where company_id=new.company_id and invoice_id=new.id),0) into allocated;
    if new.status='paid' and allocated<new.subtotal+new.tax then raise exception 'Paid invoice requires dated payment or credit allocations'; end if;
    if allocated>=new.subtotal+new.tax then new.status:='paid'; end if;
  elsif new.journal_entry_id is not null then raise exception 'Issued invoices cannot be reopened as drafts';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.guard_receivable_reversal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.reverses_entry_id is not null and (
   exists(select 1 from public.customer_payment_adjustments where company_id=new.company_id and journal_entry_id=new.reverses_entry_id) or
   exists(select 1 from public.invoices where company_id=new.company_id and journal_entry_id=new.reverses_entry_id) or
   exists(select 1 from public.payments where company_id=new.company_id and journal_entry_id=new.reverses_entry_id) or
   exists(select 1 from public.credit_notes where company_id=new.company_id and journal_entry_id=new.reverses_entry_id)) then
   raise exception 'Use the receivables correction workflow for invoice journals';
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.refresh_receivable_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 update public.invoices set status=case when total <=
    coalesce((select sum(amount) from public.payments where company_id=new.company_id and invoice_id=new.invoice_id),0)+
    coalesce((select sum(amount) from public.credit_notes where company_id=new.company_id and invoice_id=new.invoice_id),0)
    - coalesce((select sum(amount) from public.customer_payment_adjustments where company_id=new.company_id and invoice_id=new.invoice_id),0)
    then 'paid' else case when due_on<current_date then 'overdue' else 'sent' end end
   where company_id=new.company_id and id=new.invoice_id;
 return new;
end $function$
;

grant insert on table "private"."accounting_requests" to "authenticated";

grant select on table "private"."accounting_requests" to "authenticated";

grant delete on table "public"."customer_payment_adjustments" to "anon";

grant insert on table "public"."customer_payment_adjustments" to "anon";

grant references on table "public"."customer_payment_adjustments" to "anon";

grant select on table "public"."customer_payment_adjustments" to "anon";

grant trigger on table "public"."customer_payment_adjustments" to "anon";

grant truncate on table "public"."customer_payment_adjustments" to "anon";

grant update on table "public"."customer_payment_adjustments" to "anon";

grant delete on table "public"."customer_payment_adjustments" to "authenticated";

grant insert on table "public"."customer_payment_adjustments" to "authenticated";

grant references on table "public"."customer_payment_adjustments" to "authenticated";

grant select on table "public"."customer_payment_adjustments" to "authenticated";

grant trigger on table "public"."customer_payment_adjustments" to "authenticated";

grant truncate on table "public"."customer_payment_adjustments" to "authenticated";

grant update on table "public"."customer_payment_adjustments" to "authenticated";

grant delete on table "public"."customer_payment_adjustments" to "service_role";

grant insert on table "public"."customer_payment_adjustments" to "service_role";

grant references on table "public"."customer_payment_adjustments" to "service_role";

grant select on table "public"."customer_payment_adjustments" to "service_role";

grant trigger on table "public"."customer_payment_adjustments" to "service_role";

grant truncate on table "public"."customer_payment_adjustments" to "service_role";

grant update on table "public"."customer_payment_adjustments" to "service_role";


  create policy "accounting_requests_access"
  on "private"."accounting_requests"
  as permissive
  for select
  to authenticated
using (((created_by = ( SELECT auth.uid() AS uid)) AND private.is_company_member(company_id)));



  create policy "accounting_requests_insert"
  on "private"."accounting_requests"
  as permissive
  for insert
  to authenticated
with check (((created_by = ( SELECT auth.uid() AS uid)) AND private.is_company_member(company_id)));



  create policy "customer_adjustments_read"
  on "public"."customer_payment_adjustments"
  as permissive
  for select
  to authenticated
using (private.has_company_role(company_id, ARRAY['owner'::public.member_role, 'administrator'::public.member_role, 'accountant'::public.member_role, 'auditor'::public.member_role]));



  create policy "customer_adjustments_write"
  on "public"."customer_payment_adjustments"
  as permissive
  for insert
  to authenticated
with check ((private.has_company_role(company_id, ARRAY['owner'::public.member_role, 'administrator'::public.member_role, 'accountant'::public.member_role]) AND (created_by = ( SELECT auth.uid() AS uid))));


CREATE TRIGGER aa_accounting_period_lock BEFORE INSERT OR DELETE OR UPDATE ON public.accounting_periods FOR EACH ROW EXECUTE FUNCTION private.serialize_accounting_period();

CREATE TRIGGER account_definition_guard BEFORE UPDATE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION private.protect_account_definition();

CREATE TRIGGER customer_adjustment_guard BEFORE INSERT OR DELETE OR UPDATE ON public.customer_payment_adjustments FOR EACH ROW EXECUTE FUNCTION private.guard_customer_adjustment();

CREATE TRIGGER customer_adjustment_status AFTER INSERT ON public.customer_payment_adjustments FOR EACH ROW EXECUTE FUNCTION private.refresh_receivable_status();

CREATE TRIGGER zz_money_posting BEFORE INSERT OR UPDATE ON public.driver_settlements FOR EACH ROW EXECUTE FUNCTION private.post_money_record();

CREATE TRIGGER money_posting BEFORE INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION private.post_money_record();

CREATE TRIGGER money_posting BEFORE INSERT OR DELETE OR UPDATE ON public.income FOR EACH ROW EXECUTE FUNCTION private.post_money_record();

CREATE TRIGGER aa_accounting_period_lock BEFORE INSERT OR UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION private.serialize_accounting_period();



-- Preserve explicit function privileges; schema diff does not emit these.
revoke all on function private.guard_customer_adjustment() from public, anon, authenticated, service_role;
revoke all on function private.post_money_record() from public, anon, authenticated, service_role;
revoke all on function private.protect_account_definition() from public, anon, authenticated, service_role;
revoke all on function private.save_driver_settlement(uuid,uuid,text,date,date,integer,numeric,numeric,numeric,record_status,date) from public, anon, authenticated, service_role;
grant execute on function private.save_driver_settlement(uuid,uuid,text,date,date,integer,numeric,numeric,numeric,record_status,date) to authenticated, service_role;
revoke all on function private.save_transaction(uuid,uuid,text,text,date,text,text,numeric,record_status) from public, anon, authenticated, service_role;
grant execute on function private.save_transaction(uuid,uuid,text,text,date,text,text,numeric,record_status) to authenticated, service_role;
revoke all on function private.serialize_accounting_period() from public, anon, authenticated, service_role;
revoke all on function public.manage_ledger_account(uuid,uuid,text,text,account_type,boolean) from public, anon, authenticated, service_role;
grant execute on function public.manage_ledger_account(uuid,uuid,text,text,account_type,boolean) to authenticated, service_role;
revoke all on function public.record_customer_payment_adjustment(uuid,uuid,uuid,text,date,numeric,text,uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.record_customer_payment_adjustment(uuid,uuid,uuid,text,date,numeric,text,uuid,uuid) to authenticated, service_role;
revoke all on function public.reverse_money_record(uuid,text,uuid,date,text) from public, anon, authenticated, service_role;
grant execute on function public.reverse_money_record(uuid,text,uuid,date,text) to authenticated, service_role;
revoke all on function public.save_driver_settlement(uuid,uuid,text,date,date,integer,numeric,numeric,numeric,record_status,date,uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.save_driver_settlement(uuid,uuid,text,date,date,integer,numeric,numeric,numeric,record_status,date,uuid,uuid) to authenticated, service_role;
revoke all on function public.save_transaction(uuid,uuid,text,text,date,text,text,numeric,record_status,uuid,uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.save_transaction(uuid,uuid,text,text,date,text,text,numeric,record_status,uuid,uuid,uuid) to authenticated, service_role;
revoke all on function public.set_accounting_period_closed(uuid,date,date,boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_accounting_period_closed(uuid,date,date,boolean) to authenticated, service_role;
revoke all on function private.guard_receivable_allocation() from public, anon, authenticated, service_role;
revoke all on function private.guard_receivable_invoice() from public, anon, authenticated, service_role;
revoke all on function private.guard_receivable_reversal() from public, anon, authenticated, service_role;
revoke all on function private.refresh_receivable_status() from public, anon, authenticated, service_role;
revoke all on public.customer_payment_adjustments from anon, authenticated;
grant select, insert on public.customer_payment_adjustments to authenticated;
