create extension if not exists pgcrypto;
create schema if not exists private;

create type public.member_role as enum ('owner','administrator','accountant','dispatcher','fleet_manager','payroll_manager','driver','auditor');
create type public.record_status as enum ('draft','pending','approved','rejected','posted','void');
create type public.load_status as enum ('planned','dispatched','in_transit','at_delivery','delivered','invoiced','paid','cancelled');
create type public.account_type as enum ('asset','liability','equity','income','expense');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', phone text, avatar_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.companies (
  id uuid primary key default gen_random_uuid(), legal_name text not null, display_name text not null,
  currency_code char(3) not null default 'USD', timezone text not null default 'America/New_York',
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.company_memberships (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, role public.member_role not null,
  is_active boolean not null default true, permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,user_id)
);
create index memberships_user_company_idx on public.company_memberships(user_id,company_id) where is_active;

create function private.is_company_member(target_company uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.company_memberships m where m.company_id=target_company and m.user_id=(select auth.uid()) and m.is_active)
$$;
create function private.has_company_role(target_company uuid, allowed public.member_role[]) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.company_memberships m where m.company_id=target_company and m.user_id=(select auth.uid()) and m.is_active and m.role=any(allowed))
$$;
revoke all on function private.is_company_member(uuid) from public;
revoke all on function private.has_company_role(uuid,public.member_role[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_company_member(uuid) to authenticated;
grant execute on function private.has_company_role(uuid,public.member_role[]) to authenticated;

create table public.customers (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, name text not null, email text, phone text, billing_address jsonb, payment_terms int not null default 30, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.vendors (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, name text not null, email text, phone text, address jsonb, tax_identifier_ciphertext text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.drivers (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, profile_id uuid references public.profiles, employee_number text, license_number_ciphertext text, license_state text, license_expires_on date, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,profile_id));
create table public.employees (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, profile_id uuid references public.profiles, employment_type text not null default 'employee', ssn_ciphertext text, bank_details_ciphertext text, pay_method text, pay_rate numeric(14,4), active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.contractors (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, profile_id uuid references public.profiles, business_name text, tax_id_ciphertext text, pay_method text, pay_rate numeric(14,4), active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.trucks (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, unit_number text not null, vin text, year int, make text, model text, license_plate text, registration_state text, current_odometer numeric(12,1) not null default 0, registration_expires_on date, inspection_expires_on date, insurance_expires_on date, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,unit_number));
create table public.trailers (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, unit_number text not null, vin text, year int, make text, model text, license_plate text, registration_state text, inspection_expires_on date, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,unit_number));
create table public.routes (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, name text, origin jsonb not null, destination jsonb not null, planned_miles numeric(10,1), estimated_minutes int, truck_route_provider text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.route_stops (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, route_id uuid not null references public.routes on delete cascade, sequence_number int not null check(sequence_number>0), stop_type text not null, address jsonb not null, appointment_at timestamptz, arrived_at timestamptz, departed_at timestamptz, unique(route_id,sequence_number));
create table public.loads (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, load_number text not null, customer_id uuid references public.customers, broker_id uuid references public.vendors, driver_id uuid references public.drivers, truck_id uuid references public.trucks, trailer_id uuid references public.trailers, route_id uuid references public.routes, status public.load_status not null default 'planned', cargo_description text, cargo_weight numeric(12,2), customer_rate numeric(14,2) not null default 0, fuel_surcharge numeric(14,2) not null default 0, driver_pay numeric(14,2) not null default 0, fees jsonb not null default '{}', planned_miles numeric(10,1), actual_miles numeric(10,1), loaded_miles numeric(10,1), empty_miles numeric(10,1), invoice_status text, payment_status text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,load_number));

create table public.mileage_logs (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, driver_id uuid not null references public.drivers, truck_id uuid not null references public.trucks, trailer_id uuid references public.trailers, route_id uuid references public.routes, load_id uuid references public.loads, started_at timestamptz not null, ended_at timestamptz, starting_odometer numeric(12,1) not null, ending_odometer numeric(12,1), total_miles numeric(10,1) generated always as (case when ending_odometer is null then null else ending_odometer-starting_odometer end) stored, loaded_miles numeric(10,1) not null default 0, empty_miles numeric(10,1) not null default 0, personal_miles numeric(10,1) not null default 0, pickup_location jsonb, delivery_location jsonb, business_purpose text, states_traveled text[], gps_data jsonb, status public.record_status not null default 'draft', confirmed_at timestamptz, approved_by uuid references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ending_odometer is null or ending_odometer>=starting_odometer), check(loaded_miles+empty_miles+personal_miles>=0));
create table public.fuel_entries (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, driver_id uuid references public.drivers, truck_id uuid not null references public.trucks, route_id uuid references public.routes, load_id uuid references public.loads, purchased_at timestamptz not null, station_name text not null, city text, state text, gallons numeric(10,3) not null check(gallons>0), price_per_gallon numeric(10,4) not null check(price_per_gallon>=0), total_cost numeric(14,2) not null check(total_cost>=0), fuel_type text not null default 'diesel', odometer numeric(12,1), payment_method text, provider_transaction_id text, status public.record_status not null default 'pending', approved_by uuid references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.expense_categories (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, name text not null, code text, parent_id uuid references public.expense_categories, active boolean not null default true, account_id uuid, created_at timestamptz not null default now(), unique(company_id,name));
create table public.expenses (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, vendor_id uuid references public.vendors, driver_id uuid references public.drivers, truck_id uuid references public.trucks, load_id uuid references public.loads, occurred_on date not null, description text not null, amount numeric(14,2) not null check(amount>=0), reimbursable boolean not null default false, status public.record_status not null default 'draft', approved_by uuid references public.profiles, created_by uuid not null references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.expense_splits (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, expense_id uuid not null references public.expenses on delete cascade, category_id uuid not null references public.expense_categories, amount numeric(14,2) not null check(amount>=0));
create table public.income (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, customer_id uuid references public.customers, load_id uuid references public.loads, received_on date not null, description text not null, amount numeric(14,2) not null check(amount>=0), status public.record_status not null default 'draft', created_by uuid not null references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.documents (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, bucket text not null, object_path text not null, document_type text not null, original_name text not null, mime_type text not null, size_bytes bigint not null check(size_bytes>0), checksum text, linked_type text, linked_id uuid, uploaded_by uuid not null references public.profiles, created_at timestamptz not null default now(), unique(bucket,object_path));
create table public.receipts (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, document_id uuid not null references public.documents on delete restrict, expense_id uuid references public.expenses, fuel_entry_id uuid references public.fuel_entries, load_id uuid references public.loads, extraction jsonb not null default '{}', confirmed_data jsonb not null default '{}', quality_flags text[] not null default '{}', duplicate_of uuid references public.receipts, status public.record_status not null default 'pending', confirmed_by uuid references public.profiles, confirmed_at timestamptz, created_at timestamptz not null default now());

create table public.bank_connections (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, provider text not null, provider_item_id text not null, access_token_ciphertext text not null, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,provider_item_id));
create table public.bank_accounts (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, connection_id uuid references public.bank_connections on delete cascade, name text not null, account_type text not null, mask text, currency_code char(3) not null default 'USD', ledger_account_id uuid, active boolean not null default true, created_at timestamptz not null default now());
create table public.imported_transactions (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, bank_account_id uuid not null references public.bank_accounts, provider_transaction_id text, import_hash text not null, posted_on date not null, description text not null, amount numeric(14,2) not null, raw_data jsonb not null default '{}', matched_type text, matched_id uuid, review_status text not null default 'unreviewed', created_at timestamptz not null default now(), unique(company_id,import_hash));
create table public.categorization_rules (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, name text not null, priority int not null default 100, conditions jsonb not null, actions jsonb not null, active boolean not null default true, created_at timestamptz not null default now());

create table public.chart_of_accounts (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, account_number text not null, name text not null, account_type public.account_type not null, parent_id uuid references public.chart_of_accounts, active boolean not null default true, system_account boolean not null default false, created_at timestamptz not null default now(), unique(company_id,account_number));
alter table public.expense_categories add constraint expense_category_account_fk foreign key(account_id) references public.chart_of_accounts(id);
alter table public.bank_accounts add constraint bank_account_ledger_fk foreign key(ledger_account_id) references public.chart_of_accounts(id);
create table public.accounting_periods (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, starts_on date not null, ends_on date not null, closed_at timestamptz, closed_by uuid references public.profiles, created_at timestamptz not null default now(), check(ends_on>=starts_on), unique(company_id,starts_on,ends_on));
create table public.journal_entries (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, entry_number bigint generated by default as identity, entry_date date not null, memo text not null, status public.record_status not null default 'draft', reverses_entry_id uuid references public.journal_entries, posted_at timestamptz, posted_by uuid references public.profiles, created_by uuid not null references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,entry_number));
create table public.journal_lines (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, journal_entry_id uuid not null references public.journal_entries on delete cascade, account_id uuid not null references public.chart_of_accounts, description text, debit numeric(14,2) not null default 0, credit numeric(14,2) not null default 0, customer_id uuid references public.customers, vendor_id uuid references public.vendors, truck_id uuid references public.trucks, load_id uuid references public.loads, check((debit>0 and credit=0) or (credit>0 and debit=0)));

create table public.invoices (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, invoice_number bigint generated by default as identity, customer_id uuid not null references public.customers, load_id uuid references public.loads, issued_on date not null, due_on date not null, status text not null default 'draft', subtotal numeric(14,2) not null default 0, tax numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, total numeric(14,2) generated always as (subtotal+tax-discount) stored, notes text, created_by uuid not null references public.profiles, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,invoice_number));
create table public.invoice_items (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, invoice_id uuid not null references public.invoices on delete cascade, description text not null, quantity numeric(12,3) not null default 1, unit_price numeric(14,2) not null default 0, tax_rate numeric(7,6) not null default 0, line_total numeric(14,2) generated always as (quantity*unit_price) stored, sort_order int not null default 0);
create table public.payments (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, invoice_id uuid references public.invoices, customer_id uuid references public.customers, received_on date not null, amount numeric(14,2) not null check(amount>0), payment_method text, reference text, created_by uuid not null references public.profiles, created_at timestamptz not null default now());
create table public.credit_notes (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, invoice_id uuid not null references public.invoices, amount numeric(14,2) not null check(amount>0), reason text not null, created_by uuid not null references public.profiles, created_at timestamptz not null default now());

create table public.payroll_periods (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, starts_on date not null, ends_on date not null, pay_date date not null, status public.record_status not null default 'draft', created_at timestamptz not null default now(), unique(company_id,starts_on,ends_on));
create table public.payroll_entries (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, payroll_period_id uuid not null references public.payroll_periods on delete cascade, employee_id uuid references public.employees, contractor_id uuid references public.contractors, gross_pay numeric(14,2) not null default 0, deductions numeric(14,2) not null default 0, reimbursements numeric(14,2) not null default 0, estimated_net_pay numeric(14,2) generated always as (gross_pay-deductions+reimbursements) stored, details jsonb not null default '{}', status public.record_status not null default 'draft', check((employee_id is null)<>(contractor_id is null)));
create table public.driver_settlements (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, driver_id uuid not null references public.drivers, payroll_period_id uuid references public.payroll_periods, gross_pay numeric(14,2) not null default 0, authorized_deductions numeric(14,2) not null default 0, reimbursements numeric(14,2) not null default 0, status public.record_status not null default 'draft', created_at timestamptz not null default now());

create table public.maintenance_schedules (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, truck_id uuid references public.trucks, trailer_id uuid references public.trailers, service_type text not null, interval_miles numeric(12,1), interval_days int, next_due_odometer numeric(12,1), next_due_on date, active boolean not null default true, created_at timestamptz not null default now());
create table public.maintenance_records (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, truck_id uuid references public.trucks, trailer_id uuid references public.trailers, vendor_id uuid references public.vendors, service_type text not null, serviced_on date not null, odometer numeric(12,1), parts_cost numeric(14,2) not null default 0, labor_cost numeric(14,2) not null default 0, downtime_hours numeric(10,2) not null default 0, notes text, warranty_expires_on date, created_at timestamptz not null default now());
create table public.work_orders (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, truck_id uuid references public.trucks, trailer_id uuid references public.trailers, reported_by uuid references public.profiles, assigned_vendor_id uuid references public.vendors, issue text not null, priority text not null default 'normal', status text not null default 'open', opened_at timestamptz not null default now(), completed_at timestamptz, details jsonb not null default '{}');
create table public.approvals (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, record_type text not null, record_id uuid not null, requested_by uuid not null references public.profiles, assigned_to uuid references public.profiles, status public.record_status not null default 'pending', decision_notes text, decided_at timestamptz, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, user_id uuid not null references public.profiles on delete cascade, title text not null, body text not null, kind text not null, read_at timestamptz, created_at timestamptz not null default now());
create table public.reconciliations (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, bank_account_id uuid not null references public.bank_accounts, statement_ends_on date not null, statement_balance numeric(14,2) not null, reconciled_balance numeric(14,2), status text not null default 'draft', locked_at timestamptz, completed_by uuid references public.profiles, created_at timestamptz not null default now(), unique(bank_account_id,statement_ends_on));
create table public.tax_year_settings (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, tax_year int not null check(tax_year between 2000 and 2200), jurisdiction text not null, settings jsonb not null default '{}', updated_by uuid not null references public.profiles, updated_at timestamptz not null default now(), unique(company_id,tax_year,jurisdiction));
create table public.audit_logs (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade, actor_id uuid references public.profiles, action text not null, record_type text not null, record_id uuid, before_data jsonb, after_data jsonb, ip_address inet, created_at timestamptz not null default now());

create index loads_company_status_idx on public.loads(company_id,status);
create index expenses_company_date_idx on public.expenses(company_id,occurred_on desc);
create index income_company_date_idx on public.income(company_id,received_on desc);
create index invoices_company_due_idx on public.invoices(company_id,due_on,status);
create index mileage_company_started_idx on public.mileage_logs(company_id,started_at desc);
create index fuel_company_purchased_idx on public.fuel_entries(company_id,purchased_at desc);
create index documents_link_idx on public.documents(company_id,linked_type,linked_id);
create index audit_company_created_idx on public.audit_logs(company_id,created_at desc);

-- Company-scoped RLS. Companies and memberships need dedicated bootstrap policies.
do $$ declare t text; begin
  foreach t in array array['customers','vendors','drivers','employees','contractors','trucks','trailers','routes','route_stops','loads','mileage_logs','fuel_entries','expense_categories','expenses','expense_splits','income','documents','receipts','bank_connections','bank_accounts','imported_transactions','categorization_rules','chart_of_accounts','accounting_periods','journal_entries','journal_lines','invoices','invoice_items','payments','credit_notes','payroll_periods','payroll_entries','driver_settlements','maintenance_schedules','maintenance_records','work_orders','approvals','notifications','reconciliations','tax_year_settings','audit_logs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_company_member(company_id))',t||'_select',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'',''dispatcher'',''fleet_manager'',''payroll_manager'']::public.member_role[]))',t||'_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'',''dispatcher'',''fleet_manager'',''payroll_manager'']::public.member_role[])) with check (private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'',''dispatcher'',''fleet_manager'',''payroll_manager'']::public.member_role[]))',t||'_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.has_company_role(company_id,array[''owner'',''administrator'']::public.member_role[]))',t||'_delete',t);
  end loop;
end $$;
alter table public.companies enable row level security;
create policy companies_select on public.companies for select to authenticated using (private.is_company_member(id));
create policy companies_insert on public.companies for insert to authenticated with check (created_by=(select auth.uid()));
create policy companies_update on public.companies for update to authenticated using (private.has_company_role(id,array['owner','administrator']::public.member_role[])) with check (private.has_company_role(id,array['owner','administrator']::public.member_role[]));
create policy companies_delete on public.companies for delete to authenticated using (private.has_company_role(id,array['owner']::public.member_role[]));

alter table public.company_memberships enable row level security;
create policy company_memberships_select on public.company_memberships for select to authenticated using (private.is_company_member(company_id));
create policy company_memberships_insert on public.company_memberships for insert to authenticated with check (
  private.has_company_role(company_id,array['owner','administrator']::public.member_role[])
  or (
    user_id=(select auth.uid()) and role='owner' and is_active
    and exists(select 1 from public.companies c where c.id=company_id and c.created_by=(select auth.uid()))
    and not exists(select 1 from public.company_memberships m where m.company_id=company_memberships.company_id)
  )
);
create policy company_memberships_update on public.company_memberships for update to authenticated using (private.has_company_role(company_id,array['owner','administrator']::public.member_role[])) with check (private.has_company_role(company_id,array['owner','administrator']::public.member_role[]));
create policy company_memberships_delete on public.company_memberships for delete to authenticated using (private.has_company_role(company_id,array['owner','administrator']::public.member_role[]));

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (id=(select auth.uid()) or exists(select 1 from public.company_memberships mine join public.company_memberships theirs on theirs.company_id=mine.company_id where mine.user_id=(select auth.uid()) and theirs.user_id=profiles.id and mine.is_active and theirs.is_active));
create policy profiles_insert on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

-- Authentication profile bootstrap.
create function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict do nothing; return new; end $$;
revoke all on function private.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

-- Posted journals must balance and cannot be edited directly.
create function private.guard_journal_entry() returns trigger language plpgsql security invoker set search_path='' as $$
declare d numeric; c numeric; begin
  if old.status='posted' and (new.* is distinct from old.*) then raise exception 'Posted journal entries must be reversed, not edited'; end if;
  if new.status='posted' and old.status<>'posted' then
    select coalesce(sum(debit),0),coalesce(sum(credit),0) into d,c from public.journal_lines where journal_entry_id=new.id;
    if d=0 or d<>c then raise exception 'Journal entry is not balanced'; end if;
    new.posted_at=now(); new.posted_by=(select auth.uid());
  end if; return new;
end $$;
create trigger journal_entry_guard before update on public.journal_entries for each row execute function private.guard_journal_entry();

create function private.guard_paid_invoice() returns trigger language plpgsql security invoker set search_path='' as $$ begin if old.status='paid' and new.* is distinct from old.* then raise exception 'Paid invoices require a credit note or adjustment'; end if; return new; end $$;
create trigger paid_invoice_guard before update on public.invoices for each row execute function private.guard_paid_invoice();

-- Supabase projects created after May 2026 do not expose new public tables to
-- the Data API automatically. RLS remains the authorization boundary; these
-- grants only make the tables reachable by signed-in application users.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('receipts','receipts',false,26214400,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('company-documents','company-documents',false,52428800,array['image/jpeg','image/png','application/pdf']),
 ('payroll-documents','payroll-documents',false,26214400,array['application/pdf'])
on conflict(id) do nothing;
create policy storage_select on storage.objects for select to authenticated using(bucket_id in ('receipts','company-documents','payroll-documents') and private.is_company_member((storage.foldername(name))[1]::uuid));
create policy storage_insert on storage.objects for insert to authenticated with check(bucket_id in ('receipts','company-documents','payroll-documents') and private.is_company_member((storage.foldername(name))[1]::uuid));
create policy storage_update on storage.objects for update to authenticated using(private.is_company_member((storage.foldername(name))[1]::uuid)) with check(private.is_company_member((storage.foldername(name))[1]::uuid));
create policy storage_delete on storage.objects for delete to authenticated using(private.has_company_role((storage.foldername(name))[1]::uuid,array['owner','administrator','accountant']::public.member_role[]));
