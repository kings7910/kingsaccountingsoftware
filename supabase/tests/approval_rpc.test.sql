begin;select plan(8);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000081','authenticated','authenticated','approval-owner@test.local','','{}','{"full_name":"Approval Owner"}'),
('00000000-0000-0000-0000-000000000082','authenticated','authenticated','approval-driver@test.local','','{}','{"full_name":"Approval Driver"}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000081','Approval Test LLC','Approval Test','00000000-0000-0000-0000-000000000081');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000081','owner'),
('10000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','driver');
insert into public.trucks(id,company_id,unit_number) values('40000000-0000-0000-0000-000000000081','10000000-0000-0000-0000-000000000081','APP-81');
insert into public.fuel_entries(id,company_id,truck_id,purchased_at,station_name,gallons,price_per_gallon,total_cost,status) values('30000000-0000-0000-0000-000000000081','10000000-0000-0000-0000-000000000081','40000000-0000-0000-0000-000000000081',now(),'Pilot',100,4,400,'pending');
delete from public.approvals where record_id='30000000-0000-0000-0000-000000000081';
insert into public.approvals(id,company_id,record_type,record_id,requested_by,metadata) values
('20000000-0000-0000-0000-000000000081','10000000-0000-0000-0000-000000000081','fuel_entry','30000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','{"type":"Fuel entry","reference":"FUEL-1","amount":400}');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000081';
select throws_ok($$select public.decide_approval('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000081','rejected','')$$,'P0001','A rejection note is required','rejection note required');
select lives_ok($$select public.decide_approval('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000081','approved','Verified receipt')$$,'owner approves pending item');
select is((select status from public.approvals where id='20000000-0000-0000-0000-000000000081'),'approved'::public.record_status,'decision persisted');
select is((select assigned_to from public.approvals where id='20000000-0000-0000-0000-000000000081'),'00000000-0000-0000-0000-000000000081'::uuid,'reviewer recorded');
select is((select count(*) from public.audit_logs where company_id='10000000-0000-0000-0000-000000000081' and action='approval.approved'),1::bigint,'decision audit event created');
select throws_ok($$select public.decide_approval('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000081','rejected','Changed mind')$$,'P0001','Only pending items can be reviewed','decision cannot be repeated');
select throws_ok($$update public.approvals set decision_notes='tampered' where id='20000000-0000-0000-0000-000000000081'$$,'P0001','Decided approvals are immutable','decided approval immutable');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000082';
select throws_ok($$select public.decide_approval('10000000-0000-0000-0000-000000000081','20000000-0000-0000-0000-000000000081','approved','')$$,'P0001','Approval access required','driver cannot decide approvals');
select * from finish();rollback;
