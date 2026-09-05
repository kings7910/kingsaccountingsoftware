begin;select plan(7);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000051','authenticated','authenticated','maintenance-owner@test.local','','{}','{}'),
('00000000-0000-0000-0000-000000000052','authenticated','authenticated','maintenance-driver@test.local','','{}','{}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000051','Maintenance Test LLC','Maintenance Test','00000000-0000-0000-0000-000000000051');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000051','owner'),
('10000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000052','driver');
insert into public.trucks(id,company_id,unit_number,status) values('20000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000051','118','active');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000051';
select lives_ok($$select public.save_work_order('10000000-0000-0000-0000-000000000051',null,'WO-1','118','Repair','Replace alternator','Martin Fleet','2026-09-05',100000,1200,0,'scheduled',null)$$,'owner creates work order atomically');
select is((select count(*) from public.work_orders where company_id='10000000-0000-0000-0000-000000000051'),1::bigint,'work order created');
select is((select count(*) from public.vendors where company_id='10000000-0000-0000-0000-000000000051'),1::bigint,'vendor resolved atomically');
select throws_ok($$select public.save_work_order('10000000-0000-0000-0000-000000000051',null,'WO-1','118','Repair','Duplicate','','2026-09-05',1,1,0,'scheduled',null)$$,'P0001','Work order reference already exists','duplicate reference rejected');
select lives_ok($$select public.save_work_order('10000000-0000-0000-0000-000000000051',(select id from public.work_orders where company_id='10000000-0000-0000-0000-000000000051'),'WO-1','118','Repair','Replace alternator','Martin Fleet','2026-09-05',100000,1200,1150,'completed','2026-09-06')$$,'owner completes work order');
select is((select status from public.work_orders where company_id='10000000-0000-0000-0000-000000000051'),'completed','completion persisted');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000052';
select throws_ok($$select public.save_work_order('10000000-0000-0000-0000-000000000051',null,'WO-2','118','Repair','Unauthorized','','2026-09-05',1,1,0,'scheduled',null)$$,'P0001','Maintenance access required','driver cannot manage work orders');
select * from finish();rollback;
