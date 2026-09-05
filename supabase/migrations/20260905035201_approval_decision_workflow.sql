alter table public.approvals add column if not exists metadata jsonb not null default '{}';

create or replace function private.write_approval_audit(target_company_id uuid,action_value text,record_type_value text,record_id_value uuid,before_value jsonb,after_value jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.has_company_role(target_company_id,array['owner','administrator','accountant','dispatcher','fleet_manager','payroll_manager']::public.member_role[]) then raise exception 'Approval access required'; end if;
 insert into public.audit_logs(company_id,actor_id,action,record_type,record_id,before_data,after_data) values(target_company_id,auth.uid(),action_value,record_type_value,record_id_value,before_value,after_value);
end $$;
revoke all on function private.write_approval_audit(uuid,text,text,uuid,jsonb,jsonb) from public;
grant execute on function private.write_approval_audit(uuid,text,text,uuid,jsonb,jsonb) to authenticated;

create or replace function public.decide_approval(target_company_id uuid,target_approval_id uuid,decision public.record_status,review_note text) returns void language plpgsql security invoker set search_path=public as $$
declare previous public.approvals;
begin
 if not private.has_company_role(target_company_id,array['owner','administrator','accountant','dispatcher','fleet_manager','payroll_manager']::public.member_role[]) then raise exception 'Approval access required'; end if;
 if decision not in ('approved','rejected') then raise exception 'Invalid approval decision'; end if;
 if decision='rejected' and trim(coalesce(review_note,''))='' then raise exception 'A rejection note is required'; end if;
 select * into previous from public.approvals where id=target_approval_id and company_id=target_company_id for update;
 if not found then raise exception 'Approval not found'; end if;
 if previous.status<>'pending' then raise exception 'Only pending items can be reviewed'; end if;
 update public.approvals set status=decision,assigned_to=auth.uid(),decision_notes=nullif(trim(review_note),''),decided_at=now() where id=target_approval_id;
 perform private.write_approval_audit(target_company_id,'approval.'||decision::text,previous.record_type,previous.record_id,jsonb_build_object('status',previous.status),jsonb_build_object('status',decision,'note',nullif(trim(review_note),'')));
end $$;
revoke all on function public.decide_approval(uuid,uuid,public.record_status,text) from public,anon;
grant execute on function public.decide_approval(uuid,uuid,public.record_status,text) to authenticated;

create or replace function private.protect_decided_approval() returns trigger language plpgsql set search_path='' as $$ begin if old.status<>'pending' and new.* is distinct from old.* then raise exception 'Decided approvals are immutable'; end if; return new; end $$;
create trigger protect_decided_approval before update on public.approvals for each row execute function private.protect_decided_approval();
