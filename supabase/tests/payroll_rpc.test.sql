begin;select plan(8);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000061','authenticated','authenticated','payroll-owner@test.local','','{}','{"full_name":"Payroll Owner"}'),
('00000000-0000-0000-0000-000000000062','authenticated','authenticated','payroll-driver@test.local','','{}','{"full_name":"Avery Driver"}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000061','Payroll Test LLC','Payroll Test','00000000-0000-0000-0000-000000000061');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000061','owner'),
('10000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000062','driver');
insert into public.drivers(company_id,profile_id,status) values('10000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000062','active');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000061';
select lives_ok($$select public.save_driver_settlement('10000000-0000-0000-0000-000000000061',null,'Avery Driver','2026-09-01','2026-09-15',8,6000,200,300,'draft',null)$$,'owner creates settlement');
select is((select count(*) from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'),1::bigint,'settlement created');
select is((select count(*) from public.payroll_periods where company_id='10000000-0000-0000-0000-000000000061'),1::bigint,'pay period created atomically');
select is((select details->>'loads' from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'),'8','load count retained');
select lives_ok($$select public.save_driver_settlement('10000000-0000-0000-0000-000000000061',(select id from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'),'Avery Driver','2026-09-01','2026-09-15',8,6000,200,300,'posted','2026-09-16')$$,'owner marks settlement paid');
select throws_ok($$select public.delete_driver_settlement('10000000-0000-0000-0000-000000000061',(select id from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'))$$,'P0001','Paid settlements cannot be deleted','paid settlement cannot be deleted');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000062';
select throws_ok($$select public.save_driver_settlement('10000000-0000-0000-0000-000000000061',null,'Avery Driver','2026-09-01','2026-09-15',1,1,0,0,'draft',null)$$,'P0001','Payroll access required','driver cannot manage payroll');
select is((select count(*) from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'),1::bigint,'unauthorized attempt made no changes');
select * from finish();rollback;
