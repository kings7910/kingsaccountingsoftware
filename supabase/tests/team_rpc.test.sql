begin;select plan(8);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000091','authenticated','authenticated','team-owner@test.local','','{}','{"full_name":"Team Owner"}'),
('00000000-0000-0000-0000-000000000092','authenticated','authenticated','team-admin@test.local','','{}','{"full_name":"Team Admin"}'),
('00000000-0000-0000-0000-000000000093','authenticated','authenticated','team-driver@test.local','','{}','{"full_name":"Team Driver"}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000091','Team Test LLC','Team Test','00000000-0000-0000-0000-000000000091');
insert into public.company_memberships(id,company_id,user_id,role,is_active) values
('20000000-0000-0000-0000-000000000091','10000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091','owner',true),
('20000000-0000-0000-0000-000000000092','10000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000092','administrator',true),
('20000000-0000-0000-0000-000000000093','10000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000093','driver',false);
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000091';
select lives_ok($$select public.update_company_member('10000000-0000-0000-0000-000000000091','20000000-0000-0000-0000-000000000093','Team Driver','driver@test.local','dispatcher','active')$$,'owner activates and changes member role');
select is((select role from public.company_memberships where id='20000000-0000-0000-0000-000000000093'),'dispatcher'::public.member_role,'role persisted');
select is((select membership_status from public.company_memberships where id='20000000-0000-0000-0000-000000000093'),'active','status persisted');
select throws_ok($$select public.update_company_member('10000000-0000-0000-0000-000000000091','20000000-0000-0000-0000-000000000091','Team Owner','owner@test.local','accountant','active')$$,'P0001','The last active owner cannot be changed','last owner cannot be demoted');
select throws_ok($$select public.remove_company_member('10000000-0000-0000-0000-000000000091','20000000-0000-0000-0000-000000000091')$$,'P0001','The last active owner cannot be removed','last owner cannot be removed');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000092';
select throws_ok($$select public.update_company_member('10000000-0000-0000-0000-000000000091','20000000-0000-0000-0000-000000000091','Team Owner','owner@test.local','owner','active')$$,'P0001','Only owners can manage owner accounts','administrator cannot alter owner');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000093';
select throws_ok($$select public.remove_company_member('10000000-0000-0000-0000-000000000091','20000000-0000-0000-0000-000000000092')$$,'P0001','Team administration access required','non-admin cannot remove members');
select is((select count(*) from public.company_memberships where company_id='10000000-0000-0000-0000-000000000091'),3::bigint,'unauthorized operations made no changes');
select * from finish();rollback;
