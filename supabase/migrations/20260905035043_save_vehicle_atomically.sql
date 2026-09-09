create or replace function public.save_vehicle(target_company_id uuid,target_vehicle_id uuid,vehicle_type text,target_unit_number text,model_year int,make_name text,model_name text,vin_value text,odometer_value numeric,next_service_odometer_value numeric,status_value text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare vehicle_id_value uuid;schedule_id_value uuid;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required';end if;
 if not private.has_company_role(target_company_id,array['owner','administrator','fleet_manager']::public.member_role[]) then raise exception 'Fleet access required';end if;
 if vehicle_type not in ('Truck','Trailer') or btrim(target_unit_number)='' or model_year not between 1950 and extract(year from current_date)::int+1 or btrim(make_name)='' or btrim(model_name)='' or odometer_value<0 or next_service_odometer_value<0 or status_value not in ('active','out_of_service','sold') then raise exception 'Invalid vehicle';end if;
 if vehicle_type='Truck' then
  if target_vehicle_id is null then insert into public.trucks(company_id,unit_number,year,make,model,vin,current_odometer,status) values(target_company_id,btrim(target_unit_number),model_year,btrim(make_name),btrim(model_name),nullif(btrim(vin_value),''),odometer_value,status_value) returning public.trucks.id into vehicle_id_value;
  else update public.trucks set unit_number=btrim(target_unit_number),year=model_year,make=btrim(make_name),model=btrim(model_name),vin=nullif(btrim(vin_value),''),current_odometer=odometer_value,status=status_value where id=target_vehicle_id and company_id=target_company_id returning id into vehicle_id_value;end if;
  select id into schedule_id_value from public.maintenance_schedules where company_id=target_company_id and truck_id=vehicle_id_value and service_type='General service' limit 1;
  if schedule_id_value is null then insert into public.maintenance_schedules(company_id,truck_id,service_type,next_due_odometer,active) values(target_company_id,vehicle_id_value,'General service',nullif(next_service_odometer_value,0),next_service_odometer_value>0);
  else update public.maintenance_schedules set next_due_odometer=nullif(next_service_odometer_value,0),active=next_service_odometer_value>0 where id=schedule_id_value;end if;
 else
  if target_vehicle_id is null then insert into public.trailers(company_id,unit_number,year,make,model,vin,status) values(target_company_id,btrim(target_unit_number),model_year,btrim(make_name),btrim(model_name),nullif(btrim(vin_value),''),status_value) returning public.trailers.id into vehicle_id_value;
  else update public.trailers set unit_number=btrim(target_unit_number),year=model_year,make=btrim(make_name),model=btrim(model_name),vin=nullif(btrim(vin_value),''),status=status_value where id=target_vehicle_id and company_id=target_company_id returning id into vehicle_id_value;end if;
  select id into schedule_id_value from public.maintenance_schedules where company_id=target_company_id and trailer_id=vehicle_id_value and service_type='General service' limit 1;
  if schedule_id_value is null then insert into public.maintenance_schedules(company_id,trailer_id,service_type,next_due_odometer,active) values(target_company_id,vehicle_id_value,'General service',nullif(next_service_odometer_value,0),next_service_odometer_value>0);
  else update public.maintenance_schedules set next_due_odometer=nullif(next_service_odometer_value,0),active=next_service_odometer_value>0 where id=schedule_id_value;end if;
 end if;
 if vehicle_id_value is null then raise exception 'Vehicle not found';end if;return vehicle_id_value;
end;$$;
revoke all on function public.save_vehicle(uuid,uuid,text,text,int,text,text,text,numeric,numeric,text) from public,anon;
grant execute on function public.save_vehicle(uuid,uuid,text,text,int,text,text,text,numeric,numeric,text) to authenticated;

create or replace function public.delete_vehicle(target_company_id uuid,target_vehicle_id uuid,vehicle_type text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required';end if;
 if not private.has_company_role(target_company_id,array['owner','administrator']::public.member_role[]) then raise exception 'Owner or administrator access required';end if;
 if vehicle_type='Truck' then delete from public.maintenance_schedules where company_id=target_company_id and truck_id=target_vehicle_id;delete from public.trucks where company_id=target_company_id and id=target_vehicle_id;
 elsif vehicle_type='Trailer' then delete from public.maintenance_schedules where company_id=target_company_id and trailer_id=target_vehicle_id;delete from public.trailers where company_id=target_company_id and id=target_vehicle_id;
 else raise exception 'Invalid vehicle type';end if;
 if not found then raise exception 'Vehicle not found';end if;
end;$$;
revoke all on function public.delete_vehicle(uuid,uuid,text) from public,anon;
grant execute on function public.delete_vehicle(uuid,uuid,text) to authenticated;
