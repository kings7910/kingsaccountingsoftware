create or replace function private.notify_workflow_submission() returns trigger language plpgsql security definer set search_path='' as $$
declare notification_title text;notification_body text;notification_kind text;allowed_roles public.member_role[];
begin
 if tg_table_name='receipts' then
  notification_title:='Receipt needs review';notification_body:='A driver receipt was submitted for approval.';notification_kind:='receipt_approval';allowed_roles:=array['owner','administrator','accountant','dispatcher','fleet_manager']::public.member_role[];
 elsif tg_table_name='mileage_logs' then
  notification_title:='Mileage needs review';notification_body:='A driver mileage log was submitted for approval.';notification_kind:='mileage_approval';allowed_roles:=array['owner','administrator','dispatcher','fleet_manager']::public.member_role[];
 elsif tg_table_name='fuel_entries' then
  notification_title:='Fuel entry needs review';notification_body:='A driver fuel purchase was submitted for approval.';notification_kind:='fuel_approval';allowed_roles:=array['owner','administrator','accountant','fleet_manager']::public.member_role[];
 elsif tg_table_name='work_orders' then
  notification_title:='Vehicle issue reported';notification_body:=new.issue;notification_kind:='maintenance_issue';allowed_roles:=array['owner','administrator','fleet_manager']::public.member_role[];
 else return new;
 end if;
 insert into public.notifications(company_id,user_id,title,body,kind)
 select new.company_id,m.user_id,notification_title,notification_body,notification_kind
 from public.company_memberships m where m.company_id=new.company_id and m.is_active and m.membership_status='active' and m.role=any(allowed_roles) and m.user_id is distinct from auth.uid();
 return new;
end $$;
revoke all on function private.notify_workflow_submission() from public;

create trigger receipt_submission_notification after insert on public.receipts for each row when(new.status='pending') execute function private.notify_workflow_submission();
create trigger mileage_submission_notification after insert on public.mileage_logs for each row when(new.status='pending') execute function private.notify_workflow_submission();
create trigger fuel_submission_notification after insert on public.fuel_entries for each row when(new.status='pending') execute function private.notify_workflow_submission();
create trigger work_order_submission_notification after insert on public.work_orders for each row when(new.status='open') execute function private.notify_workflow_submission();
