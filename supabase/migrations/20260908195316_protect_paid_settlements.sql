begin;
create or replace function private.guard_paid_settlement()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then raise exception 'Paid settlements cannot be deleted'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'posted' and new is distinct from old then
    raise exception 'Paid settlements require a separate correction';
  end if;
  -- Serialize payment with edits to the shared period so historical dates stay fixed.
  if new.payroll_period_id is not null then
    perform 1 from public.payroll_periods
      where company_id = new.company_id and id = new.payroll_period_id for update;
  end if;
  if new.status = 'posted' and new.paid_on is null then
    raise exception 'Paid date is required';
  end if;
  return new;
end $$;
revoke all on function private.guard_paid_settlement() from public, anon, authenticated;
create trigger paid_settlement_guard before insert or update or delete on public.driver_settlements
  for each row execute function private.guard_paid_settlement();

create or replace function private.guard_paid_payroll_period()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (tg_op = 'DELETE' or (new.company_id, new.id, new.starts_on, new.ends_on) is distinct from
      (old.company_id, old.id, old.starts_on, old.ends_on))
    and exists(select 1 from public.driver_settlements where company_id = old.company_id
      and payroll_period_id = old.id and status = 'posted') then
    raise exception 'Periods with paid settlements cannot be changed or deleted';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.guard_paid_payroll_period() from public, anon, authenticated;
create trigger paid_payroll_period_guard before update or delete on public.payroll_periods
  for each row execute function private.guard_paid_payroll_period();
commit;
