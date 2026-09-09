create or replace function public.save_fuel_entry(target_company_id uuid,target_entry_id uuid,purchased_on date,target_unit_number text,station text,location_name text,state_code text,gallons_value numeric,total_cost_value numeric,odometer_value numeric,receipt_reference text) returns uuid language plpgsql security invoker set search_path=public as $$
declare result_id uuid; target_truck_id uuid;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant','fleet_manager']::public.member_role[]) then raise exception 'Fuel access required'; end if;
 if purchased_on is null or trim(target_unit_number)='' or trim(station)='' or gallons_value<=0 or total_cost_value<=0 or odometer_value<0 then raise exception 'Invalid fuel entry'; end if;
 select id into target_truck_id from public.trucks where company_id=target_company_id and lower(unit_number)=lower(trim(target_unit_number)); if target_truck_id is null then raise exception 'Truck unit not found'; end if;
 if target_entry_id is null then insert into public.fuel_entries(company_id,truck_id,purchased_at,station_name,city,state,gallons,price_per_gallon,total_cost,odometer,provider_transaction_id,status) values(target_company_id,target_truck_id,purchased_on,trim(station),nullif(trim(split_part(coalesce(location_name,''),',',1)),''),nullif(upper(trim(state_code)),''),gallons_value,total_cost_value/gallons_value,total_cost_value,odometer_value,nullif(trim(receipt_reference),''),'approved') returning id into result_id;
 else update public.fuel_entries set truck_id=target_truck_id,purchased_at=purchased_on,station_name=trim(station),city=nullif(trim(split_part(coalesce(location_name,''),',',1)),''),state=nullif(upper(trim(state_code)),''),gallons=gallons_value,price_per_gallon=total_cost_value/gallons_value,total_cost=total_cost_value,odometer=odometer_value,provider_transaction_id=nullif(trim(receipt_reference),''),updated_at=now() where id=target_entry_id and company_id=target_company_id returning id into result_id; if result_id is null then raise exception 'Fuel entry not found'; end if; end if;
 return result_id;
end $$;
revoke all on function public.save_fuel_entry(uuid,uuid,date,text,text,text,text,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.save_fuel_entry(uuid,uuid,date,text,text,text,text,numeric,numeric,numeric,text) to authenticated;
