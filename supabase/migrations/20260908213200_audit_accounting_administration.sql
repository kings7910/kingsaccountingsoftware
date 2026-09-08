-- Track accounting administration and customer corrections in the existing audit history.
create trigger chart_of_accounts_audit after insert or update or delete on public.chart_of_accounts
for each row execute function private.capture_audit_event();
create trigger accounting_periods_audit after insert or update or delete on public.accounting_periods
for each row execute function private.capture_audit_event();
create trigger customer_payment_adjustments_audit after insert or update or delete on public.customer_payment_adjustments
for each row execute function private.capture_audit_event();
