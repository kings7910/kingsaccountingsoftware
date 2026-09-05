-- Tenant identity belongs in foreign keys as well as row-level policies.
do $$
declare t record; f record; constraint_name text;
begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r'
 and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='company_id')
 and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='id') loop
  execute format('alter table public.%I add constraint %I unique(company_id,id)',t.relname,'tenant_identity_'||t.relname);
 end loop;
 for f in select c.conrelid::regclass as source,c.confrelid::regclass as target,a.attname as column_name,c.conname,c.confdeltype,c.confupdtype
 from pg_constraint c join pg_namespace n on n.oid=c.connamespace
 join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
 join pg_attribute b on b.attrelid=c.confrelid and b.attnum=c.confkey[1]
 where n.nspname='public' and c.contype='f' and cardinality(c.conkey)=1 and b.attname='id'
 and exists(select 1 from pg_attribute x where x.attrelid=c.conrelid and x.attname='company_id')
 and exists(select 1 from pg_attribute x where x.attrelid=c.confrelid and x.attname='company_id') loop
  constraint_name:='tenant_fk_'||substr(md5(f.conname||f.source::text),1,16);
  execute format('alter table %s drop constraint %I',f.source,f.conname);
  execute format('alter table %s add constraint %I foreign key(company_id,%I) references %s(company_id,id) on delete %s on update %s',f.source,f.conname,f.column_name,f.target,
   case f.confdeltype when 'c' then 'cascade' when 'n' then format('set null (%I)',f.column_name) when 'r' then 'restrict' else 'no action' end,
   case f.confupdtype when 'c' then 'cascade' when 'r' then 'restrict' else 'no action' end);
  execute format('create index %I on %s(company_id,%I)',constraint_name||'_idx',f.source,f.column_name);
 end loop;
end $$;

-- Only finance staff may change the ledger; auditors can read it.
do $$ declare t text; begin
 foreach t in array array['journal_entries','journal_lines','chart_of_accounts','accounting_periods'] loop
  execute format('drop policy %I on public.%I',t||'_select',t);
  execute format('drop policy %I on public.%I',t||'_insert',t);
  execute format('drop policy %I on public.%I',t||'_update',t);
  execute format('drop policy %I on public.%I',t||'_delete',t);
  execute format('create policy %I on public.%I for select to authenticated using(private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'',''auditor'']::public.member_role[]))',t||'_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check(private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'']::public.member_role[]))',t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using(private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'']::public.member_role[])) with check(private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'']::public.member_role[]))',t||'_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using(private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'']::public.member_role[]))',t||'_delete',t);
 end loop;
end $$;

create or replace function private.guard_journal_entry() returns trigger language plpgsql security invoker set search_path='' as $$
declare d numeric; c numeric;
begin
 if tg_op='INSERT' then
  if new.status='posted' then raise exception 'Create a draft and balance its lines before posting';end if;
 else
  if old.status='posted' and new.* is distinct from old.* then raise exception 'Posted journal entries must be reversed, not edited';end if;
  if new.status='posted' and old.status<>'posted' then
   select coalesce(sum(debit),0),coalesce(sum(credit),0) into d,c from public.journal_lines where journal_entry_id=new.id and company_id=new.company_id;
   if d=0 or d<>c or d::text in ('NaN','Infinity','-Infinity') then raise exception 'Journal entry is not balanced';end if;
   if exists(select 1 from public.accounting_periods where company_id=new.company_id and closed_at is not null and new.entry_date between starts_on and ends_on) then raise exception 'Accounting period is closed';end if;
   new.posted_at=now();new.posted_by=(select auth.uid());
  end if;
 end if;
 return new;
end $$;
drop trigger journal_entry_guard on public.journal_entries;
create trigger journal_entry_guard before insert or update on public.journal_entries for each row execute function private.guard_journal_entry();

create or replace function private.protect_posted_journal_line() returns trigger language plpgsql set search_path='' as $$
declare entry record; old_id uuid;new_id uuid;
begin
 if tg_op<>'INSERT' then old_id:=old.journal_entry_id;end if;
 if tg_op<>'DELETE' then new_id:=new.journal_entry_id;end if;
 for entry in select id,status from public.journal_entries where id in (old_id,new_id) order by id for update loop
  if entry.status='posted' then raise exception 'Posted journal entries are immutable';end if;
 end loop;
 return coalesce(new,old);
end $$;
drop trigger protect_posted_journal_line on public.journal_lines;
create trigger protect_posted_journal_line before insert or update or delete on public.journal_lines for each row execute function private.protect_posted_journal_line();

create or replace function public.reverse_journal_entry(target_company_id uuid,target_entry_id uuid,new_entry_number bigint,reversal_date date) returns uuid language plpgsql security invoker set search_path=public as $$
declare source public.journal_entries;result_id uuid;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Accounting access required';end if;
 select * into source from public.journal_entries where id=target_entry_id and company_id=target_company_id and status='posted' for update;
 if not found then raise exception 'Posted journal entry not found';end if;
 if exists(select 1 from public.journal_entries where reverses_entry_id=target_entry_id) then raise exception 'Journal entry already reversed';end if;
 insert into public.journal_entries(company_id,entry_number,entry_date,memo,status,reverses_entry_id,created_by)
 values(target_company_id,new_entry_number,reversal_date,'Reversal of JE-'||source.entry_number||': '||source.memo,'draft',source.id,auth.uid()) returning id into result_id;
 insert into public.journal_lines(company_id,journal_entry_id,account_id,description,debit,credit,customer_id,vendor_id,truck_id,load_id)
 select company_id,result_id,account_id,description,credit,debit,customer_id,vendor_id,truck_id,load_id from public.journal_lines where journal_entry_id=source.id;
 update public.journal_entries set status='posted' where id=result_id;
 return result_id;
end $$;
create unique index journal_single_reversal on public.journal_entries(reverses_entry_id) where reverses_entry_id is not null;

-- Cache identity lookups in the driver policies without changing their access rules.
do $$ declare p record; statement text;begin
 for p in select * from pg_policies where schemaname in ('public','storage') and (coalesce(qual,'')||coalesce(with_check,'')) like '%auth.uid()%' and (coalesce(qual,'')||coalesce(with_check,'')) not like '%SELECT auth.uid()%' loop
  statement:=format('alter policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  if p.qual is not null then statement:=statement||' using ('||replace(p.qual,'auth.uid()','(select auth.uid())')||')';end if;
  if p.with_check is not null then statement:=statement||' with check ('||replace(p.with_check,'auth.uid()','(select auth.uid())')||')';end if;
  execute statement;
 end loop;
end $$;

create table private.driver_submission_requests (
 driver_id uuid not null references public.drivers(id),request_id uuid not null,
 company_id uuid not null references public.companies(id),load_id uuid not null,
 kind text not null check(kind in ('trip','fuel')),payload jsonb not null,result_id uuid not null,
 created_at timestamptz not null default now(),primary key(driver_id,request_id),
 foreign key(company_id,load_id) references public.loads(company_id,id)
);
alter table private.driver_submission_requests enable row level security;
revoke all on private.driver_submission_requests from public,anon,authenticated;
create or replace function private.submit_driver_once(request_id_value uuid,driver_id_value uuid,load_id_value uuid,kind_value text,payload_value jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare driver public.drivers;existing private.driver_submission_requests;result uuid;field text;value numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into driver from public.drivers where id=driver_id_value and profile_id=auth.uid() and status='active';
 if not found or not private.is_company_member(driver.company_id) then raise exception 'Active driver access required';end if;
 if request_id_value is null or load_id_value is null or kind_value not in ('trip','fuel') or jsonb_typeof(payload_value) is distinct from 'object' then raise exception 'Invalid submission';end if;
 perform pg_advisory_xact_lock(hashtextextended(driver_id_value::text||request_id_value::text,0));
 select * into existing from private.driver_submission_requests where driver_id=driver_id_value and request_id=request_id_value;
 if found then
  if existing.load_id<>load_id_value or existing.kind<>kind_value or existing.payload<>payload_value then raise exception 'Submission reference already used for different data';end if;
  return existing.result_id;
 end if;
 if not exists(select 1 from public.loads where id=load_id_value and company_id=driver.company_id and driver_id=driver.id) then raise exception 'Assigned load not found';end if;
 foreach field in array case when kind_value='trip' then array['start','end','loaded','empty'] else array['gallons','cost','odometer'] end loop
  if coalesce(trim(payload_value->>field),'')='' then raise exception 'Numeric submission fields are required';end if;
  value:=(payload_value->>field)::numeric;
  if value<0 or value::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid numeric submission';end if;
 end loop;
 if kind_value='trip' then
  result:=public.submit_driver_mileage(load_id_value,(payload_value->>'start')::numeric,(payload_value->>'end')::numeric,(payload_value->>'loaded')::numeric,(payload_value->>'empty')::numeric,coalesce(payload_value->>'note',''));
 else
  if coalesce(trim(payload_value->>'vendor'),'')='' then raise exception 'Vendor is required';end if;
  result:=public.submit_driver_fuel(load_id_value,payload_value->>'vendor',(payload_value->>'gallons')::numeric,(payload_value->>'cost')::numeric,(payload_value->>'odometer')::numeric);
 end if;
 insert into private.driver_submission_requests(driver_id,request_id,company_id,load_id,kind,payload,result_id) values(driver.id,request_id_value,driver.company_id,load_id_value,kind_value,payload_value,result);
 return result;
end $$;
revoke all on function private.submit_driver_once(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function private.submit_driver_once(uuid,uuid,uuid,text,jsonb) to authenticated;
create or replace function public.submit_driver_submission(request_id_value uuid,driver_id_value uuid,load_id_value uuid,kind_value text,payload_value jsonb)
returns uuid language sql security invoker set search_path='' as $$
 select private.submit_driver_once(request_id_value,driver_id_value,load_id_value,kind_value,payload_value);
$$;
revoke all on function public.submit_driver_submission(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.submit_driver_submission(uuid,uuid,uuid,text,jsonb) to authenticated;

create or replace function private.queue_driver_approval() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;label text;requester uuid;amount_value numeric;
begin
 if new.status<>'pending' then return new;end if;
 if tg_table_name='fuel_entries' then kind:='fuel_entry';label:='Fuel entry';amount_value:=new.total_cost;
 elsif tg_table_name='mileage_logs' then kind:='mileage_log';label:='Mileage log';amount_value:=0;
 else kind:='receipt';label:='Receipt';amount_value:=0;end if;
 requester:=auth.uid();
 if requester is null then
  if tg_table_name='receipts' then select uploaded_by into requester from public.documents where id=new.document_id;
  else select profile_id into requester from public.drivers where id=new.driver_id;end if;
 end if;
 if requester is null then select created_by into requester from public.companies where id=new.company_id;end if;
 if not exists(select 1 from public.approvals where company_id=new.company_id and record_type=kind and record_id=new.id and status='pending') then
  insert into public.approvals(company_id,record_type,record_id,requested_by,metadata)
  values(new.company_id,kind,new.id,requester,jsonb_build_object('type',label,'reference',left(new.id::text,8),'amount',amount_value,'description',label||' awaiting review'));
 end if;
 return new;
end $$;
revoke all on function private.queue_driver_approval() from public,anon,authenticated;
create trigger fuel_approval_queue after insert on public.fuel_entries for each row execute function private.queue_driver_approval();
create trigger mileage_approval_queue after insert on public.mileage_logs for each row execute function private.queue_driver_approval();
create trigger receipt_approval_queue after insert on public.receipts for each row execute function private.queue_driver_approval();

create or replace function private.apply_approval_decision() returns trigger language plpgsql security invoker set search_path='' as $$
declare target_table text;allowed public.member_role[];affected bigint;
begin
 if old.status<>'pending' or new.status not in ('approved','rejected') then return new;end if;
 case new.record_type
 when 'fuel_entry' then target_table:='fuel_entries';allowed:=array['owner','administrator','accountant','fleet_manager']::public.member_role[];
 when 'mileage_log' then target_table:='mileage_logs';allowed:=array['owner','administrator','dispatcher','fleet_manager']::public.member_role[];
 when 'receipt' then target_table:='receipts';allowed:=array['owner','administrator','accountant','dispatcher','fleet_manager']::public.member_role[];
 when 'expense' then target_table:='expenses';allowed:=array['owner','administrator','accountant']::public.member_role[];
 when 'driver_settlement' then target_table:='driver_settlements';allowed:=array['owner','administrator','payroll_manager']::public.member_role[];
 else return new;
 end case;
 if not private.has_company_role(new.company_id,allowed) then raise exception 'This approval requires an authorized reviewer for its record type';end if;
 execute format('update public.%I set status=$1 where id=$2 and company_id=$3 and status=''pending''',target_table) using new.status,new.record_id,new.company_id;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Pending source record not found';end if;
 return new;
end $$;
create trigger apply_approval_decision before update of status on public.approvals for each row execute function private.apply_approval_decision();
