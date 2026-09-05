create or replace function private.capture_audit_event() returns trigger language plpgsql security definer set search_path='' as $$
declare before_value jsonb;after_value jsonb;company_value uuid;record_value uuid;
begin
 before_value:=case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
 after_value:=case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
 if tg_table_name='companies' then company_value:=coalesce((after_value->>'id')::uuid,(before_value->>'id')::uuid); else company_value:=coalesce((after_value->>'company_id')::uuid,(before_value->>'company_id')::uuid); end if;
 record_value:=coalesce((after_value->>'id')::uuid,(before_value->>'id')::uuid);
 before_value:=before_value-'company_id'-'created_at'-'updated_at';
 after_value:=after_value-'company_id'-'created_at'-'updated_at';
 if tg_table_name='companies' then before_value:=jsonb_set(coalesce(before_value,'{}'::jsonb),'{settings}',coalesce(before_value->'settings','{}'::jsonb)-'ein');after_value:=jsonb_set(coalesce(after_value,'{}'::jsonb),'{settings}',coalesce(after_value->'settings','{}'::jsonb)-'ein');end if;
 insert into public.audit_logs(company_id,actor_id,action,record_type,record_id,before_data,after_data) values(company_value,auth.uid(),tg_table_name||'.'||lower(tg_op),tg_table_name,record_value,before_value,after_value);
 return coalesce(new,old);
end $$;
revoke all on function private.capture_audit_event() from public;

do $$ declare table_name text;begin
 foreach table_name in array array['companies','company_memberships','customers','vendors','trucks','trailers','loads','fuel_entries','expenses','income','invoices','payments','driver_settlements','work_orders','journal_entries'] loop
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.capture_audit_event()',table_name||'_audit',table_name);
 end loop;
end $$;
