create or replace function public.save_journal_entry(target_company_id uuid,target_entry_id uuid,entry_number_value bigint,entry_date_value date,memo_value text,lines_value jsonb,post_now boolean) returns uuid language plpgsql security invoker set search_path=public as $$
declare result_id uuid; item jsonb; account_text text; account_no text; account_name text; account_id_value uuid; debit_value numeric; credit_value numeric; debit_total numeric:=0; credit_total numeric:=0; valid_count int:=0;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Accounting access required'; end if;
 if entry_number_value is null or entry_number_value<=0 or entry_date_value is null or trim(memo_value)='' or jsonb_typeof(lines_value)<>'array' then raise exception 'Invalid journal entry'; end if;
 if exists(select 1 from public.journal_entries where company_id=target_company_id and entry_number=entry_number_value and id is distinct from target_entry_id) then raise exception 'Journal number already exists'; end if;
 if target_entry_id is not null and exists(select 1 from public.journal_entries where id=target_entry_id and company_id=target_company_id and status<>'draft') then raise exception 'Posted journal entries are immutable'; end if;
 for item in select value from jsonb_array_elements(lines_value) loop
  debit_value:=coalesce((item->>'debit')::numeric,0); credit_value:=coalesce((item->>'credit')::numeric,0);
  if debit_value<0 or credit_value<0 or (debit_value>0 and credit_value>0) then raise exception 'Invalid journal line'; end if;
  if debit_value>0 or credit_value>0 then valid_count:=valid_count+1; debit_total:=debit_total+debit_value; credit_total:=credit_total+credit_value; end if;
 end loop;
 if post_now and (valid_count<2 or debit_total<=0 or abs(debit_total-credit_total)>.005) then raise exception 'Journal entry is not balanced'; end if;
 if target_entry_id is null then insert into public.journal_entries(company_id,entry_number,entry_date,memo,status,created_by) values(target_company_id,entry_number_value,entry_date_value,trim(memo_value),'draft',auth.uid()) returning id into result_id;
 else delete from public.journal_lines where journal_entry_id=target_entry_id and company_id=target_company_id; update public.journal_entries set entry_number=entry_number_value,entry_date=entry_date_value,memo=trim(memo_value),updated_at=now() where id=target_entry_id and company_id=target_company_id returning id into result_id; end if;
 for item in select value from jsonb_array_elements(lines_value) loop
  debit_value:=coalesce((item->>'debit')::numeric,0);credit_value:=coalesce((item->>'credit')::numeric,0);if debit_value=0 and credit_value=0 then continue;end if;
  account_text:=trim(item->>'account');account_no:=split_part(account_text,' ',1);account_name:=trim(regexp_replace(account_text,'^[^ ]+\s*[·-]?\s*',''));
  select id into account_id_value from public.chart_of_accounts where company_id=target_company_id and account_number=account_no;
  if account_id_value is null then insert into public.chart_of_accounts(company_id,account_number,name,account_type) values(target_company_id,account_no,coalesce(nullif(account_name,''),account_no),case left(account_no,1) when '1' then 'asset'::public.account_type when '2' then 'liability'::public.account_type when '3' then 'equity'::public.account_type when '4' then 'income'::public.account_type else 'expense'::public.account_type end) returning id into account_id_value;end if;
  insert into public.journal_lines(company_id,journal_entry_id,account_id,description,debit,credit) values(target_company_id,result_id,account_id_value,nullif(trim(item->>'description'),''),debit_value,credit_value);
 end loop;
 if post_now then update public.journal_entries set status='posted',posted_at=now(),posted_by=auth.uid(),updated_at=now() where id=result_id; end if;
 return result_id;
end $$;
revoke all on function public.save_journal_entry(uuid,uuid,bigint,date,text,jsonb,boolean) from public,anon;
grant execute on function public.save_journal_entry(uuid,uuid,bigint,date,text,jsonb,boolean) to authenticated;

create or replace function public.reverse_journal_entry(target_company_id uuid,target_entry_id uuid,new_entry_number bigint,reversal_date date) returns uuid language plpgsql security invoker set search_path=public as $$
declare source public.journal_entries; result_id uuid;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant']::public.member_role[]) then raise exception 'Accounting access required'; end if;
 select * into source from public.journal_entries where id=target_entry_id and company_id=target_company_id and status='posted'; if not found then raise exception 'Posted journal entry not found'; end if;
 if exists(select 1 from public.journal_entries where reverses_entry_id=target_entry_id) then raise exception 'Journal entry already reversed'; end if;
 insert into public.journal_entries(company_id,entry_number,entry_date,memo,status,reverses_entry_id,posted_at,posted_by,created_by) values(target_company_id,new_entry_number,reversal_date,'Reversal of JE-'||source.entry_number||': '||source.memo,'posted',source.id,now(),auth.uid(),auth.uid()) returning id into result_id;
 insert into public.journal_lines(company_id,journal_entry_id,account_id,description,debit,credit,customer_id,vendor_id,truck_id,load_id) select company_id,result_id,account_id,description,credit,debit,customer_id,vendor_id,truck_id,load_id from public.journal_lines where journal_entry_id=source.id;
 return result_id;
end $$;
revoke all on function public.reverse_journal_entry(uuid,uuid,bigint,date) from public,anon;
grant execute on function public.reverse_journal_entry(uuid,uuid,bigint,date) to authenticated;

create or replace function private.protect_posted_journal() returns trigger language plpgsql set search_path='' as $$ begin if old.status='posted' then raise exception 'Posted journal entries are immutable'; end if; return coalesce(new,old); end $$;
create trigger protect_posted_journal before update or delete on public.journal_entries for each row execute function private.protect_posted_journal();
create or replace function private.protect_posted_journal_line() returns trigger language plpgsql set search_path='' as $$ begin if exists(select 1 from public.journal_entries where id=coalesce(old.journal_entry_id,new.journal_entry_id) and status='posted') then raise exception 'Posted journal entries are immutable'; end if; return coalesce(new,old); end $$;
create trigger protect_posted_journal_line before update or delete on public.journal_lines for each row execute function private.protect_posted_journal_line();
