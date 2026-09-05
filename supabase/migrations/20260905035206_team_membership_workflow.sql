alter table public.company_memberships add column if not exists display_name text not null default '', add column if not exists email text not null default '', add column if not exists membership_status text not null default 'active' check(membership_status in ('invited','active','suspended'));
update public.company_memberships m set display_name=p.full_name from public.profiles p where p.id=m.user_id and m.display_name='';
update public.company_memberships m set email=lower(u.email) from auth.users u where u.id=m.user_id and m.email='' and u.email is not null;

create or replace function public.update_company_member(target_company_id uuid,target_membership_id uuid,display_name_value text,email_value text,role_value public.member_role,status_value text) returns void language plpgsql security invoker set search_path=public as $$
declare caller_role public.member_role; previous public.company_memberships;
begin
 select role into caller_role from public.company_memberships where company_id=target_company_id and user_id=auth.uid() and is_active;
 if caller_role not in ('owner','administrator') then raise exception 'Team administration access required'; end if;
 if status_value not in ('invited','active','suspended') or trim(display_name_value)='' or trim(email_value)='' then raise exception 'Invalid team member'; end if;
 select * into previous from public.company_memberships where id=target_membership_id and company_id=target_company_id for update;if not found then raise exception 'Team member not found';end if;
 if caller_role='administrator' and (previous.role='owner' or role_value='owner') then raise exception 'Only owners can manage owner accounts'; end if;
 if previous.role='owner' and previous.is_active and (role_value<>'owner' or status_value<>'active') and (select count(*) from public.company_memberships where company_id=target_company_id and role='owner' and is_active and id<>target_membership_id)=0 then raise exception 'The last active owner cannot be changed'; end if;
 update public.company_memberships set display_name=trim(display_name_value),email=lower(trim(email_value)),role=role_value,membership_status=status_value,is_active=(status_value='active'),updated_at=now() where id=target_membership_id;
end $$;
revoke all on function public.update_company_member(uuid,uuid,text,text,public.member_role,text) from public,anon;
grant execute on function public.update_company_member(uuid,uuid,text,text,public.member_role,text) to authenticated;

create or replace function public.remove_company_member(target_company_id uuid,target_membership_id uuid) returns void language plpgsql security invoker set search_path=public as $$
declare caller_role public.member_role; previous public.company_memberships;
begin
 select role into caller_role from public.company_memberships where company_id=target_company_id and user_id=auth.uid() and is_active;
 if caller_role not in ('owner','administrator') then raise exception 'Team administration access required'; end if;
 select * into previous from public.company_memberships where id=target_membership_id and company_id=target_company_id for update;if not found then raise exception 'Team member not found';end if;
 if caller_role='administrator' and previous.role='owner' then raise exception 'Only owners can manage owner accounts'; end if;
 if previous.role='owner' and previous.is_active and (select count(*) from public.company_memberships where company_id=target_company_id and role='owner' and is_active and id<>target_membership_id)=0 then raise exception 'The last active owner cannot be removed'; end if;
 delete from public.company_memberships where id=target_membership_id;
end $$;
revoke all on function public.remove_company_member(uuid,uuid) from public,anon;
grant execute on function public.remove_company_member(uuid,uuid) to authenticated;
