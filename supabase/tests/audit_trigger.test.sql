begin;select plan(7);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000111','authenticated','authenticated','audit-owner@test.local','','{}','{"full_name":"Audit Owner"}'),
('00000000-0000-0000-0000-000000000112','authenticated','authenticated','audit-driver@test.local','','{}','{"full_name":"Audit Driver"}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000111','Audit Test LLC','Audit Test','00000000-0000-0000-0000-000000000111');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000111','owner'),
('10000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000112','driver');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000111';
insert into public.trucks(company_id,unit_number,status) values('10000000-0000-0000-0000-000000000111','501','active');
select is((select count(*) from public.audit_logs where company_id='10000000-0000-0000-0000-000000000111' and action='trucks.insert'),1::bigint,'insert emits audit event');
update public.trucks set current_odometer=100 where company_id='10000000-0000-0000-0000-000000000111' and unit_number='501';
select is((select count(*) from public.audit_logs where company_id='10000000-0000-0000-0000-000000000111' and action='trucks.update'),1::bigint,'update emits audit event');
select is((select after_data->>'current_odometer' from public.audit_logs where company_id='10000000-0000-0000-0000-000000000111' and action='trucks.update'),'100.0','after snapshot retained');
delete from public.trucks where company_id='10000000-0000-0000-0000-000000000111' and unit_number='501';
select is((select count(*) from public.audit_logs where company_id='10000000-0000-0000-0000-000000000111' and action='trucks.delete'),1::bigint,'delete emits audit event');
select is((select actor_id from public.audit_logs where company_id='10000000-0000-0000-0000-000000000111' and action='trucks.insert'),'00000000-0000-0000-0000-000000000111'::uuid,'actor identity retained');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000112';
select is((select count(*) from public.audit_logs where company_id='10000000-0000-0000-0000-000000000111'),0::bigint,'driver cannot read company audit history');
select throws_ok($$delete from public.audit_logs where company_id='10000000-0000-0000-0000-000000000111'$$,'42501','permission denied for table audit_logs','authenticated users cannot delete audit history');
select * from finish();rollback;
