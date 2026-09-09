create or replace function public.save_load(target_company_id uuid,target_load_id uuid,origin_label text,destination_label text,customer_name text,driver_name text,target_unit_number text,customer_rate_value numeric,planned_miles_value numeric,pickup_date date,delivery_date date,load_status_value public.load_status)
returns table(id uuid,load_number text) language plpgsql security invoker set search_path='' as $$
declare customer_id_value uuid;truck_id_value uuid;driver_id_value uuid;route_id_value uuid;load_id_value uuid;load_number_value text;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if not private.has_company_role(target_company_id,array['owner','administrator','dispatcher']::public.member_role[]) then raise exception 'Dispatch access required'; end if;
 if btrim(origin_label)='' or btrim(destination_label)='' or btrim(customer_name)='' or btrim(driver_name)='' or btrim(target_unit_number)='' or customer_rate_value<=0 or planned_miles_value<=0 or delivery_date<pickup_date then raise exception 'Invalid load'; end if;
 select c.id into customer_id_value from public.customers c where c.company_id=target_company_id and lower(c.name)=lower(btrim(customer_name)) limit 1;
 if customer_id_value is null then insert into public.customers(company_id,name) values(target_company_id,btrim(customer_name)) returning public.customers.id into customer_id_value;end if;
 select t.id into truck_id_value from public.trucks t where t.company_id=target_company_id and lower(t.unit_number)=lower(btrim(target_unit_number)) limit 1;
 if truck_id_value is null then insert into public.trucks(company_id,unit_number) values(target_company_id,btrim(target_unit_number)) returning public.trucks.id into truck_id_value;end if;
 select d.id into driver_id_value from public.drivers d join public.profiles p on p.id=d.profile_id where d.company_id=target_company_id and lower(p.full_name)=lower(btrim(driver_name)) limit 1;
 if target_load_id is null then
  insert into public.routes(company_id,name,origin,destination,planned_miles) values(target_company_id,origin_label||' → '||destination_label,jsonb_build_object('label',origin_label),jsonb_build_object('label',destination_label),planned_miles_value) returning public.routes.id into route_id_value;
  select 'LD-'||(coalesce(max(nullif(regexp_replace(l.load_number,'\D','','g'),'' )::bigint),2800)+1)::text into load_number_value from public.loads l where l.company_id=target_company_id;
  insert into public.loads(company_id,load_number,customer_id,driver_id,truck_id,route_id,status,customer_rate,planned_miles,fees) values(target_company_id,load_number_value,customer_id_value,driver_id_value,truck_id_value,route_id_value,load_status_value,customer_rate_value,planned_miles_value,jsonb_build_object('driver_name',driver_name,'pickup_on',pickup_date,'delivery_on',delivery_date)) returning public.loads.id into load_id_value;
 else
  select l.route_id,l.load_number into route_id_value,load_number_value from public.loads l where l.id=target_load_id and l.company_id=target_company_id;
  if load_number_value is null then raise exception 'Load not found';end if;
  update public.routes set name=origin_label||' → '||destination_label,origin=jsonb_build_object('label',origin_label),destination=jsonb_build_object('label',destination_label),planned_miles=planned_miles_value where public.routes.id=route_id_value and company_id=target_company_id;
  update public.loads set customer_id=customer_id_value,driver_id=driver_id_value,truck_id=truck_id_value,status=load_status_value,customer_rate=customer_rate_value,planned_miles=planned_miles_value,fees=jsonb_build_object('driver_name',driver_name,'pickup_on',pickup_date,'delivery_on',delivery_date) where public.loads.id=target_load_id and company_id=target_company_id returning public.loads.id into load_id_value;
 end if;
 return query select load_id_value,load_number_value;
end;$$;
revoke all on function public.save_load(uuid,uuid,text,text,text,text,text,numeric,numeric,date,date,public.load_status) from public,anon;
grant execute on function public.save_load(uuid,uuid,text,text,text,text,text,numeric,numeric,date,date,public.load_status) to authenticated;
