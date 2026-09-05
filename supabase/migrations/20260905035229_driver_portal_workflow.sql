drop policy mileage_logs_insert on public.mileage_logs;
create policy mileage_logs_insert on public.mileage_logs for insert to authenticated with check(private.is_own_driver(driver_id) or private.has_company_role(company_id,array['owner','administrator','dispatcher','fleet_manager']::public.member_role[]));
drop policy mileage_logs_update on public.mileage_logs;
create policy mileage_logs_update on public.mileage_logs for update to authenticated using((private.is_own_driver(driver_id) and status='draft') or private.has_company_role(company_id,array['owner','administrator','dispatcher','fleet_manager']::public.member_role[])) with check(private.is_own_driver(driver_id) or private.has_company_role(company_id,array['owner','administrator','dispatcher','fleet_manager']::public.member_role[]));
drop policy fuel_entries_insert on public.fuel_entries;
create policy fuel_entries_insert on public.fuel_entries for insert to authenticated with check(private.is_own_driver(driver_id) or private.has_company_role(company_id,array['owner','administrator','accountant','fleet_manager']::public.member_role[]));
drop policy documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated with check((uploaded_by=auth.uid() and private.is_company_member(company_id)) or private.has_company_role(company_id,array['owner','administrator','accountant','dispatcher','fleet_manager','payroll_manager']::public.member_role[]));
drop policy receipts_insert on public.receipts;
create policy receipts_insert on public.receipts for insert to authenticated with check((private.is_company_member(company_id) and exists(select 1 from public.documents d where d.id=document_id and d.company_id=company_id and d.uploaded_by=auth.uid())) or private.has_company_role(company_id,array['owner','administrator','accountant','dispatcher','fleet_manager']::public.member_role[]));
drop policy work_orders_insert on public.work_orders;
create policy work_orders_insert on public.work_orders for insert to authenticated with check((reported_by=auth.uid() and private.is_company_member(company_id)) or private.has_company_role(company_id,array['owner','administrator','fleet_manager']::public.member_role[]));

-- A driver may only read the operational records and private files they created.
drop policy documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated using(uploaded_by=auth.uid() or private.has_company_role(company_id,array['owner','administrator','accountant','dispatcher','fleet_manager','payroll_manager','auditor']::public.member_role[]));
drop policy receipts_select on public.receipts;
create policy receipts_select on public.receipts for select to authenticated using(exists(select 1 from public.documents d where d.id=document_id and d.uploaded_by=auth.uid()) or private.has_company_role(company_id,array['owner','administrator','accountant','dispatcher','fleet_manager','auditor']::public.member_role[]));
drop policy work_orders_select on public.work_orders;
create policy work_orders_select on public.work_orders for select to authenticated using(reported_by=auth.uid() or private.has_company_role(company_id,array['owner','administrator','fleet_manager','auditor']::public.member_role[]));
drop policy storage_select on storage.objects;
create policy storage_select on storage.objects for select to authenticated using(bucket_id in ('receipts','company-documents','payroll-documents') and private.is_company_member((storage.foldername(name))[1]::uuid) and ((storage.foldername(name))[2]=auth.uid()::text or private.has_company_role((storage.foldername(name))[1]::uuid,array['owner','administrator','accountant','dispatcher','fleet_manager','payroll_manager','auditor']::public.member_role[])));

create or replace function public.submit_driver_mileage(target_load_id uuid,starting_value numeric,ending_value numeric,loaded_value numeric,empty_value numeric,note_value text) returns uuid language plpgsql security invoker set search_path=public as $$
declare target_load public.loads;target_driver uuid;result_id uuid;
begin
 select l.* into target_load from public.loads l join public.drivers d on d.id=l.driver_id where l.id=target_load_id and d.profile_id=auth.uid();
 if not found then raise exception 'Assigned load not found';end if;
 if target_load.truck_id is null then raise exception 'Assigned truck is required';end if;
 target_driver:=target_load.driver_id;
 if starting_value<0 or ending_value<starting_value or loaded_value<0 or empty_value<0 or abs((ending_value-starting_value)-(loaded_value+empty_value))>5 then raise exception 'Invalid mileage submission';end if;
 insert into public.mileage_logs(company_id,driver_id,truck_id,route_id,load_id,started_at,ended_at,starting_odometer,ending_odometer,loaded_miles,empty_miles,business_purpose,status) values(target_load.company_id,target_driver,target_load.truck_id,target_load.route_id,target_load.id,now(),now(),starting_value,ending_value,loaded_value,empty_value,nullif(trim(note_value),''),'pending') returning id into result_id;
 return result_id;
end $$;
revoke all on function public.submit_driver_mileage(uuid,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.submit_driver_mileage(uuid,numeric,numeric,numeric,numeric,text) to authenticated;

create or replace function public.submit_driver_fuel(target_load_id uuid,station_value text,gallons_value numeric,cost_value numeric,odometer_value numeric) returns uuid language plpgsql security invoker set search_path=public as $$
declare target_load public.loads;result_id uuid;
begin
 select l.* into target_load from public.loads l join public.drivers d on d.id=l.driver_id where l.id=target_load_id and d.profile_id=auth.uid();
 if not found then raise exception 'Assigned load not found';end if;
 if target_load.truck_id is null then raise exception 'Assigned truck is required';end if;
 if trim(station_value)='' or gallons_value<=0 or cost_value<=0 or odometer_value<0 then raise exception 'Invalid fuel submission';end if;
 insert into public.fuel_entries(company_id,driver_id,truck_id,route_id,load_id,purchased_at,station_name,gallons,price_per_gallon,total_cost,odometer,status) values(target_load.company_id,target_load.driver_id,target_load.truck_id,target_load.route_id,target_load.id,now(),trim(station_value),gallons_value,cost_value/gallons_value,cost_value,odometer_value,'pending') returning id into result_id;
 return result_id;
end $$;
revoke all on function public.submit_driver_fuel(uuid,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.submit_driver_fuel(uuid,text,numeric,numeric,numeric) to authenticated;

create or replace function public.report_driver_vehicle_issue(target_load_id uuid,issue_value text) returns uuid language plpgsql security invoker set search_path=public as $$
declare target_load public.loads;result_id uuid;
begin
 select l.* into target_load from public.loads l join public.drivers d on d.id=l.driver_id where l.id=target_load_id and d.profile_id=auth.uid();
 if not found then raise exception 'Assigned load not found';end if;
 if target_load.truck_id is null then raise exception 'Assigned truck is required';end if;
 if trim(issue_value)='' then raise exception 'Issue description is required';end if;
 insert into public.work_orders(company_id,truck_id,reported_by,issue,priority,status,details) values(target_load.company_id,target_load.truck_id,auth.uid(),trim(issue_value),'normal','open',jsonb_build_object('source','driver_portal','load_id',target_load.id)) returning id into result_id;
 return result_id;
end $$;
revoke all on function public.report_driver_vehicle_issue(uuid,text) from public,anon;
grant execute on function public.report_driver_vehicle_issue(uuid,text) to authenticated;

create or replace function public.record_driver_receipt(target_load_id uuid,bucket_value text,path_value text,name_value text,mime_value text,size_value bigint) returns uuid language plpgsql security invoker set search_path=public as $$
declare target_load public.loads;document_id uuid;result_id uuid;
begin
 select l.* into target_load from public.loads l join public.drivers d on d.id=l.driver_id where l.id=target_load_id and d.profile_id=auth.uid();
 if not found then raise exception 'Assigned load not found';end if;
 if bucket_value<>'receipts' or path_value not like target_load.company_id::text||'/'||auth.uid()::text||'/%' then raise exception 'Invalid receipt path';end if;
 if trim(name_value)='' or mime_value not in ('image/jpeg','image/png','image/webp','application/pdf') or size_value<=0 or size_value>26214400 then raise exception 'Invalid receipt metadata';end if;
 insert into public.documents(company_id,bucket,object_path,document_type,original_name,mime_type,size_bytes,linked_type,linked_id,uploaded_by) values(target_load.company_id,bucket_value,path_value,'receipt',trim(name_value),mime_value,size_value,'load',target_load.id,auth.uid()) returning id into document_id;
 insert into public.receipts(company_id,document_id,load_id,status) values(target_load.company_id,document_id,target_load.id,'pending') returning id into result_id;
 return result_id;
end $$;
revoke all on function public.record_driver_receipt(uuid,text,text,text,text,bigint) from public,anon;
grant execute on function public.record_driver_receipt(uuid,text,text,text,text,bigint) to authenticated;
