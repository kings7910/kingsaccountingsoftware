create table public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  bank_account_id uuid not null,
  original_name text not null check(length(trim(original_name)) between 1 and 200),
  row_count integer not null check(row_count between 1 and 1000),
  imported_count integer not null check(imported_count between 0 and row_count),
  duplicate_count integer not null check(duplicate_count between 0 and row_count),
  imported_by uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  constraint bank_statement_import_account_fk foreign key(company_id,bank_account_id) references public.bank_accounts(company_id,id),
  constraint bank_statement_import_count_check check(imported_count+duplicate_count=row_count),
  constraint tenant_identity_bank_statement_imports unique(company_id,id)
);

alter table public.imported_transactions
  add column import_batch_id uuid,
  add column reconciliation_id uuid,
  add column review_note text,
  add column updated_at timestamptz not null default now(),
  add constraint imported_transaction_batch_fk foreign key(company_id,import_batch_id) references public.bank_statement_imports(company_id,id),
  add constraint imported_transaction_reconciliation_fk foreign key(company_id,reconciliation_id) references public.reconciliations(company_id,id),
  add constraint imported_transaction_amount_check check(amount<>0 and amount::text not in ('NaN','Infinity','-Infinity')),
  add constraint imported_transaction_status_check check(review_status in ('unreviewed','matched','excluded')),
  add constraint imported_transaction_match_check check(
    (review_status='matched' and matched_type='journal_entry' and matched_id is not null and review_note is null) or
    (review_status='excluded' and matched_type is null and matched_id is null and length(trim(review_note)) between 1 and 500) or
    (review_status='unreviewed' and matched_type is null and matched_id is null and review_note is null)
  );

alter table public.reconciliations
  add column statement_starts_on date,
  add column updated_at timestamptz not null default now();
update public.reconciliations set statement_starts_on=statement_ends_on where statement_starts_on is null;
alter table public.reconciliations
  alter column statement_starts_on set not null,
  add constraint reconciliation_dates_check check(statement_ends_on>=statement_starts_on),
  add constraint reconciliation_status_check check(status in ('draft','completed')),
  add constraint reconciliation_completion_check check(
    (status='draft' and locked_at is null and completed_by is null) or
    (status='completed' and locked_at is not null and completed_by is not null and reconciled_balance=statement_balance)
  );

create unique index imported_transaction_journal_match_unique
  on public.imported_transactions(company_id,matched_id)
  where review_status='matched' and matched_type='journal_entry';
create index imported_transactions_bank_date_idx on public.imported_transactions(company_id,bank_account_id,posted_on desc);
create index imported_transactions_reconciliation_idx on public.imported_transactions(company_id,reconciliation_id);
create index bank_statement_imports_account_idx on public.bank_statement_imports(company_id,bank_account_id,created_at desc);
create index reconciliations_account_period_idx on public.reconciliations(company_id,bank_account_id,statement_starts_on,statement_ends_on);

alter table public.bank_statement_imports enable row level security;
create policy bank_statement_imports_select on public.bank_statement_imports for select to authenticated
  using((select private.has_company_role(company_id,array['owner','administrator','accountant']::public.member_role[])));
create policy bank_statement_imports_insert on public.bank_statement_imports for insert to authenticated
  with check((select private.has_company_role(company_id,array['owner','administrator','accountant']::public.member_role[])) and imported_by=(select auth.uid()));
create policy bank_statement_imports_update on public.bank_statement_imports for update to authenticated
  using((select private.has_company_role(company_id,array['owner','administrator','accountant']::public.member_role[])))
  with check((select private.has_company_role(company_id,array['owner','administrator','accountant']::public.member_role[])) and imported_by=(select auth.uid()));

revoke all on table public.bank_statement_imports from public,anon,authenticated;
grant select,insert,update on table public.bank_statement_imports to authenticated;
revoke all on table public.imported_transactions from anon,authenticated;
grant select,insert,update on table public.imported_transactions to authenticated;
revoke all on table public.reconciliations from anon,authenticated;
grant select,insert,update on table public.reconciliations to authenticated;

create or replace function private.guard_bank_reconciliation_records() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if coalesce(current_setting('kings.bank_reconciliation_write',true),'')<>'on' then
    raise exception 'Use the bank reconciliation workflow';
  end if;
  if tg_table_name='bank_statement_imports' then
    if tg_op='UPDATE' and not (
      old.imported_count=0 and old.duplicate_count=old.row_count and
      new.id=old.id and new.company_id=old.company_id and new.bank_account_id=old.bank_account_id and
      new.original_name=old.original_name and new.row_count=old.row_count and new.imported_by=old.imported_by and new.created_at=old.created_at
    ) then raise exception 'Statement import history is immutable';
    elsif tg_op='DELETE' then raise exception 'Statement import history is immutable';end if;
    return coalesce(new,old);
  end if;
  if tg_table_name='reconciliations' then
    if tg_op<>'INSERT' and old.status='completed' then raise exception 'Completed reconciliations are immutable';end if;
    if tg_op='DELETE' then return old;end if;
    new.updated_at=now();return new;
  end if;
  if tg_op<>'INSERT' and old.reconciliation_id is not null and exists(
      select 1 from public.reconciliations r where r.company_id=old.company_id and r.id=old.reconciliation_id and r.status='completed'
    ) then raise exception 'Reconciled statement rows are immutable';
  end if;
  if tg_op='DELETE' then return old;end if;
  new.updated_at=now();
  return new;
end $$;
revoke all on function private.guard_bank_reconciliation_records() from public,anon,authenticated;
create trigger bank_statement_import_guard before insert or update or delete on public.bank_statement_imports for each row execute function private.guard_bank_reconciliation_records();
create trigger imported_transaction_reconciliation_guard before insert or update or delete on public.imported_transactions for each row execute function private.guard_bank_reconciliation_records();
create trigger reconciliation_guard before insert or update or delete on public.reconciliations for each row execute function private.guard_bank_reconciliation_records();

create or replace function public.create_bank_account(
  target_company_id uuid, account_name text, account_type_value text, ledger_account_value uuid
) returns uuid language plpgsql security invoker set search_path=public as $$
declare result_id uuid;
begin
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  if length(trim(coalesce(account_name,''))) not between 1 and 120 then raise exception 'Bank account name is required';end if;
  if account_type_value not in ('checking','savings') then raise exception 'Choose checking or savings';end if;
  if not exists(select 1 from public.chart_of_accounts where company_id=target_company_id and id=ledger_account_value and account_type='asset' and active) then
    raise exception 'Choose an active asset ledger account';
  end if;
  insert into public.bank_accounts(company_id,name,account_type,ledger_account_id)
  values(target_company_id,trim(account_name),account_type_value,ledger_account_value) returning id into result_id;
  return result_id;
end $$;

create or replace function public.import_bank_statement(
  target_company_id uuid, target_bank_account_id uuid, original_name_value text, rows_value jsonb
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare batch_id uuid;row_value jsonb;total_count integer;inserted_count integer:=0;
begin
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  perform 1 from public.bank_accounts where company_id=target_company_id and id=target_bank_account_id and active and ledger_account_id is not null for update;
  if not found then raise exception 'Active linked bank account not found';end if;
  if jsonb_typeof(rows_value) is distinct from 'array' then raise exception 'Statement rows must be an array';end if;
  total_count:=jsonb_array_length(rows_value);
  if total_count not between 1 and 1000 then raise exception 'A statement must contain 1 to 1000 rows';end if;
  if length(trim(coalesce(original_name_value,''))) not between 1 and 200 then raise exception 'Statement file name is required';end if;
  perform set_config('kings.bank_reconciliation_write','on',true);
  insert into public.bank_statement_imports(company_id,bank_account_id,original_name,row_count,imported_count,duplicate_count,imported_by)
  values(target_company_id,target_bank_account_id,trim(original_name_value),total_count,0,total_count,auth.uid()) returning id into batch_id;
  for row_value in select value from jsonb_array_elements(rows_value) loop
    if coalesce(row_value->>'hash','')!~'^[0-9a-f]{64}$' or length(trim(coalesce(row_value->>'description',''))) not between 1 and 200 then raise exception 'Invalid statement row';end if;
    insert into public.imported_transactions(company_id,bank_account_id,import_batch_id,import_hash,posted_on,description,amount,raw_data)
    values(target_company_id,target_bank_account_id,batch_id,row_value->>'hash',(row_value->>'postedOn')::date,trim(row_value->>'description'),(row_value->>'amount')::numeric,jsonb_build_object('source','csv','line',row_value->'line'))
    on conflict(company_id,import_hash) do nothing;
    if found then inserted_count:=inserted_count+1;end if;
  end loop;
  update public.bank_statement_imports set imported_count=inserted_count,duplicate_count=total_count-inserted_count where id=batch_id and company_id=target_company_id;
  perform set_config('kings.bank_reconciliation_write','off',true);
  return jsonb_build_object('batchId',batch_id,'rowCount',total_count,'importedCount',inserted_count,'duplicateCount',total_count-inserted_count);
end $$;

create or replace function public.review_bank_transaction(
  target_company_id uuid, target_transaction_id uuid, review_action text, target_journal_entry_id uuid default null, note_value text default null
) returns void language plpgsql security invoker set search_path=public as $$
declare statement_row public.imported_transactions;bank public.bank_accounts;journal_amount numeric;bank_id uuid;
begin
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  perform set_config('kings.bank_reconciliation_write','on',true);
  select bank_account_id into bank_id from public.imported_transactions where company_id=target_company_id and id=target_transaction_id;
  select * into bank from public.bank_accounts where company_id=target_company_id and id=bank_id for update;
  select * into statement_row from public.imported_transactions where company_id=target_company_id and id=target_transaction_id for update;
  if not found then raise exception 'Statement row not found';end if;
  if statement_row.reconciliation_id is not null then raise exception 'Reconciled statement rows are immutable';end if;
  if review_action='unmatch' then
    update public.imported_transactions set review_status='unreviewed',matched_type=null,matched_id=null,review_note=null where id=statement_row.id and company_id=target_company_id;
  elsif review_action='exclude' then
    if length(trim(coalesce(note_value,''))) not between 1 and 500 then raise exception 'An exclusion reason is required';end if;
    update public.imported_transactions set review_status='excluded',matched_type=null,matched_id=null,review_note=trim(note_value) where id=statement_row.id and company_id=target_company_id;
  elsif review_action='match' then
    select sum(l.debit-l.credit) into journal_amount from public.journal_entries j join public.journal_lines l on l.company_id=j.company_id and l.journal_entry_id=j.id
    where j.company_id=target_company_id and j.id=target_journal_entry_id and j.status='posted' and l.account_id=bank.ledger_account_id;
    if journal_amount is null then raise exception 'Posted journal entry does not use this bank ledger account';end if;
    if journal_amount<>statement_row.amount then raise exception 'Statement and journal amounts must match';end if;
    update public.imported_transactions set review_status='matched',matched_type='journal_entry',matched_id=target_journal_entry_id,review_note=null where id=statement_row.id and company_id=target_company_id;
  else raise exception 'Invalid review action';
  end if;
  perform set_config('kings.bank_reconciliation_write','off',true);
end $$;

create or replace function public.save_bank_reconciliation(
  target_company_id uuid, target_bank_account_id uuid, starts_on_value date, ends_on_value date, statement_balance_value numeric
) returns uuid language plpgsql security invoker set search_path=public as $$
declare result_id uuid;ledger_id uuid;book_balance numeric;
begin
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  perform set_config('kings.bank_reconciliation_write','on',true);
  if starts_on_value is null or ends_on_value is null or ends_on_value<starts_on_value then raise exception 'Enter a valid statement period';end if;
  if statement_balance_value is null or statement_balance_value::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a valid statement balance';end if;
  select ledger_account_id into ledger_id from public.bank_accounts where company_id=target_company_id and id=target_bank_account_id and active for update;
  if ledger_id is null then raise exception 'Active linked bank account not found';end if;
  if exists(select 1 from public.reconciliations where company_id=target_company_id and bank_account_id=target_bank_account_id and status='completed' and daterange(statement_starts_on,statement_ends_on,'[]')&&daterange(starts_on_value,ends_on_value,'[]')) then raise exception 'Statement period overlaps a completed reconciliation';end if;
  select coalesce(sum(l.debit-l.credit),0) into book_balance from public.journal_lines l join public.journal_entries j on j.company_id=l.company_id and j.id=l.journal_entry_id
  where l.company_id=target_company_id and l.account_id=ledger_id and j.status='posted' and j.entry_date<=ends_on_value;
  select id into result_id from public.reconciliations where company_id=target_company_id and bank_account_id=target_bank_account_id and statement_ends_on=ends_on_value and status='draft' for update;
  if found then update public.reconciliations set statement_starts_on=starts_on_value,statement_balance=statement_balance_value,reconciled_balance=book_balance where id=result_id;
  else insert into public.reconciliations(company_id,bank_account_id,statement_starts_on,statement_ends_on,statement_balance,reconciled_balance) values(target_company_id,target_bank_account_id,starts_on_value,ends_on_value,statement_balance_value,book_balance) returning id into result_id;end if;
  perform set_config('kings.bank_reconciliation_write','off',true);
  return result_id;
end $$;

create or replace function public.complete_bank_reconciliation(target_company_id uuid,target_reconciliation_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare reconciliation public.reconciliations;ledger_id uuid;book_balance numeric;bank_id uuid;
begin
  if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Finance access required';end if;
  perform set_config('kings.bank_reconciliation_write','on',true);
  select bank_account_id into bank_id from public.reconciliations where company_id=target_company_id and id=target_reconciliation_id and status='draft';
  select ledger_account_id into ledger_id from public.bank_accounts where company_id=target_company_id and id=bank_id and active for update;
  select * into reconciliation from public.reconciliations where company_id=target_company_id and id=target_reconciliation_id and status='draft' for update;
  if not found then raise exception 'Draft reconciliation not found';end if;
  if ledger_id is null then raise exception 'Active linked bank account not found';end if;
  select coalesce(sum(l.debit-l.credit),0) into book_balance from public.journal_lines l join public.journal_entries j on j.company_id=l.company_id and j.id=l.journal_entry_id
  where l.company_id=target_company_id and l.account_id=ledger_id and j.status='posted' and j.entry_date<=reconciliation.statement_ends_on;
  if book_balance<>reconciliation.statement_balance then raise exception 'Statement balance does not equal the posted book balance';end if;
  if not exists(select 1 from public.imported_transactions t where t.company_id=target_company_id and t.bank_account_id=reconciliation.bank_account_id and t.posted_on between reconciliation.statement_starts_on and reconciliation.statement_ends_on) then raise exception 'Import statement rows for this period first';end if;
  if exists(select 1 from public.imported_transactions t where t.company_id=target_company_id and t.bank_account_id=reconciliation.bank_account_id and t.posted_on between reconciliation.statement_starts_on and reconciliation.statement_ends_on and t.review_status='unreviewed') then raise exception 'Review every statement row before completing reconciliation';end if;
  update public.imported_transactions set reconciliation_id=reconciliation.id where company_id=target_company_id and bank_account_id=reconciliation.bank_account_id and posted_on between reconciliation.statement_starts_on and reconciliation.statement_ends_on;
  update public.reconciliations set reconciled_balance=book_balance,status='completed',locked_at=now(),completed_by=auth.uid() where id=reconciliation.id and company_id=target_company_id;
  perform set_config('kings.bank_reconciliation_write','off',true);
end $$;

do $$ declare signature text;begin
  foreach signature in array array[
    'public.create_bank_account(uuid,text,text,uuid)',
    'public.import_bank_statement(uuid,uuid,text,jsonb)',
    'public.review_bank_transaction(uuid,uuid,text,uuid,text)',
    'public.save_bank_reconciliation(uuid,uuid,date,date,numeric)',
    'public.complete_bank_reconciliation(uuid,uuid)'
  ] loop
    execute 'revoke all on function '||signature||' from public,anon';
    execute 'grant execute on function '||signature||' to authenticated';
  end loop;
end $$;

create trigger bank_accounts_audit after insert or update or delete on public.bank_accounts for each row execute function private.capture_audit_event();
create trigger bank_statement_imports_audit after insert or update or delete on public.bank_statement_imports for each row execute function private.capture_audit_event();
create trigger imported_transactions_audit after insert or update or delete on public.imported_transactions for each row execute function private.capture_audit_event();
create trigger reconciliations_audit after insert or update or delete on public.reconciliations for each row execute function private.capture_audit_event();
