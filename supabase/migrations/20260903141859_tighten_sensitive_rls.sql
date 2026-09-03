-- Narrow access to financial secrets, payroll data, audit history, and
-- driver-owned operational records. These replace the platform-wide defaults.
create function private.is_own_driver(target_driver uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.drivers d
    where d.id = target_driver and d.profile_id = (select auth.uid())
  )
$$;
revoke all on function private.is_own_driver(uuid) from public;
grant execute on function private.is_own_driver(uuid) to authenticated;

-- Personally identifying worker records.
drop policy employees_select on public.employees;
drop policy employees_insert on public.employees;
drop policy employees_update on public.employees;
create policy employees_select on public.employees for select to authenticated using (
  profile_id = (select auth.uid()) or
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
);
create policy employees_insert on public.employees for insert to authenticated with check (
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
);
create policy employees_update on public.employees for update to authenticated using (
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
) with check (
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
);

drop policy contractors_select on public.contractors;
drop policy contractors_insert on public.contractors;
drop policy contractors_update on public.contractors;
create policy contractors_select on public.contractors for select to authenticated using (
  profile_id = (select auth.uid()) or
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
);
create policy contractors_insert on public.contractors for insert to authenticated with check (
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
);
create policy contractors_update on public.contractors for update to authenticated using (
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
) with check (
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
);

-- Payroll managers administer payroll; drivers can read only their settlement.
do $$ declare t text; begin
  foreach t in array array['payroll_periods','payroll_entries'] loop
    execute format('drop policy %I on public.%I', t || '_select', t);
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.has_company_role(company_id,array[''owner'',''administrator'',''payroll_manager'']::public.member_role[])))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.has_company_role(company_id,array[''owner'',''administrator'',''payroll_manager'']::public.member_role[])))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.has_company_role(company_id,array[''owner'',''administrator'',''payroll_manager'']::public.member_role[]))) with check ((select private.has_company_role(company_id,array[''owner'',''administrator'',''payroll_manager'']::public.member_role[])))', t || '_update', t);
  end loop;
end $$;

drop policy driver_settlements_select on public.driver_settlements;
drop policy driver_settlements_insert on public.driver_settlements;
drop policy driver_settlements_update on public.driver_settlements;
create policy driver_settlements_select on public.driver_settlements for select to authenticated using (
  (select private.is_own_driver(driver_id)) or
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
);
create policy driver_settlements_insert on public.driver_settlements for insert to authenticated with check (
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
);
create policy driver_settlements_update on public.driver_settlements for update to authenticated using (
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
) with check (
  (select private.has_company_role(company_id, array['owner','administrator','payroll_manager']::public.member_role[]))
);

-- Bank credentials and reconciliation data are finance-only.
do $$ declare t text; begin
  foreach t in array array['bank_connections','bank_accounts','imported_transactions','reconciliations','tax_year_settings'] loop
    execute format('drop policy %I on public.%I', t || '_select', t);
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'']::public.member_role[])))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'']::public.member_role[])))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'']::public.member_role[]))) with check ((select private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'']::public.member_role[])))', t || '_update', t);
  end loop;
end $$;

-- Audit history is append-only from trusted server/database code.
drop policy audit_logs_select on public.audit_logs;
drop policy audit_logs_insert on public.audit_logs;
drop policy audit_logs_update on public.audit_logs;
drop policy audit_logs_delete on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated using (
  (select private.has_company_role(company_id, array['owner','administrator','auditor']::public.member_role[]))
);
revoke insert, update, delete on public.audit_logs from authenticated;

-- Personal notifications never leak to coworkers.
drop policy notifications_select on public.notifications;
drop policy notifications_update on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (
  user_id = (select auth.uid())
);
create policy notifications_update on public.notifications for update to authenticated using (
  user_id = (select auth.uid())
) with check (
  user_id = (select auth.uid())
);

-- Drivers see only their own identity and assigned operational records.
drop policy drivers_select on public.drivers;
create policy drivers_select on public.drivers for select to authenticated using (
  profile_id = (select auth.uid()) or
  (select private.has_company_role(company_id, array['owner','administrator','accountant','dispatcher','fleet_manager','payroll_manager','auditor']::public.member_role[]))
);

drop policy loads_select on public.loads;
create policy loads_select on public.loads for select to authenticated using (
  (select private.is_own_driver(driver_id)) or
  (select private.has_company_role(company_id, array['owner','administrator','accountant','dispatcher','fleet_manager','payroll_manager','auditor']::public.member_role[]))
);

do $$ declare t text; begin
  foreach t in array array['mileage_logs','fuel_entries'] loop
    execute format('drop policy %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_own_driver(driver_id)) or (select private.has_company_role(company_id,array[''owner'',''administrator'',''accountant'',''dispatcher'',''fleet_manager'',''payroll_manager'',''auditor'']::public.member_role[])))', t || '_select', t);
  end loop;
end $$;
