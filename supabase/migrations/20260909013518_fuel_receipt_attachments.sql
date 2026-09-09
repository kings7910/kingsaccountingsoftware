-- Attach a private receipt to an existing fuel entry without changing its cost or posting.
create or replace function public.record_fuel_receipt(target_entry_id uuid,path_value text,name_value text,mime_value text,size_value bigint)
returns uuid language plpgsql security invoker set search_path=public as $$
declare entry public.fuel_entries; document_id uuid; receipt_id uuid;
begin
 select * into entry from public.fuel_entries where id=target_entry_id;
 if not found or not private.is_company_member(entry.company_id) then raise exception 'Fuel entry not found'; end if;
 if not private.has_company_role(entry.company_id,array['owner','administrator','accountant','fleet_manager']::public.member_role[]) and not exists(
  select 1 from public.drivers d where d.id=entry.driver_id and d.company_id=entry.company_id and d.profile_id=auth.uid() and d.status='active'
 ) then raise exception 'Fuel access required'; end if;
 if path_value is null or path_value not like entry.company_id::text||'/'||auth.uid()::text||'/%' then raise exception 'Invalid receipt path'; end if;
 if name_value is null or trim(name_value)='' or mime_value is null or mime_value not in ('image/jpeg','image/png','image/webp','application/pdf') or size_value is null or size_value<=0 or size_value>4194304 then raise exception 'Invalid receipt metadata'; end if;
 if not exists(select 1 from storage.objects where bucket_id='receipts' and name=path_value) then raise exception 'Uploaded receipt not found'; end if;
 insert into public.documents(company_id,bucket,object_path,document_type,original_name,mime_type,size_bytes,linked_type,linked_id,uploaded_by)
 values(entry.company_id,'receipts',path_value,'receipt',trim(name_value),mime_value,size_value,'fuel_entry',entry.id,auth.uid()) returning id into document_id;
 insert into public.receipts(company_id,document_id,fuel_entry_id,load_id,status)
 values(entry.company_id,document_id,entry.id,entry.load_id,'pending') returning id into receipt_id;
 return receipt_id;
end $$;
revoke all on function public.record_fuel_receipt(uuid,text,text,text,bigint) from public,anon;
grant execute on function public.record_fuel_receipt(uuid,text,text,text,bigint) to authenticated;
create index if not exists receipts_fuel_entry_idx on public.receipts(fuel_entry_id) where fuel_entry_id is not null;
