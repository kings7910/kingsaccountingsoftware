begin;
select plan(10);

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000071','authenticated','authenticated','portal-owner@test.local','','{}','{}'),
('00000000-0000-0000-0000-000000000072','authenticated','authenticated','portal-driver@test.local','','{}','{}'),
('00000000-0000-0000-0000-000000000073','authenticated','authenticated','portal-other@test.local','','{}','{}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000071','Portal Test LLC','Portal Test','00000000-0000-0000-0000-000000000071');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000071','owner'),
('10000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000072','driver'),
('10000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000073','driver');
insert into public.drivers(id,company_id,profile_id,employee_number) values
('20000000-0000-0000-0000-000000000071','10000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000072','D71'),
('20000000-0000-0000-0000-000000000072','10000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000073','D72');
insert into public.trucks(id,company_id,unit_number,status) values
('30000000-0000-0000-0000-000000000071','10000000-0000-0000-0000-000000000071','P71','active'),
('30000000-0000-0000-0000-000000000072','10000000-0000-0000-0000-000000000071','P72','active');
insert into public.loads(id,company_id,load_number,driver_id,truck_id,status) values
('40000000-0000-0000-0000-000000000071','10000000-0000-0000-0000-000000000071','PORTAL-OWN','20000000-0000-0000-0000-000000000071','30000000-0000-0000-0000-000000000071','dispatched'),
('40000000-0000-0000-0000-000000000072','10000000-0000-0000-0000-000000000071','PORTAL-OTHER','20000000-0000-0000-0000-000000000072','30000000-0000-0000-0000-000000000072','dispatched');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000072';
select lives_ok($$select public.submit_driver_submission('60000000-0000-0000-0000-000000000071','20000000-0000-0000-0000-000000000071','40000000-0000-0000-0000-000000000071','fuel','{"vendor":"Pilot","gallons":"50","cost":"200","odometer":"1050"}')$$,'first queued request succeeds');
select lives_ok($$select public.submit_driver_submission('60000000-0000-0000-0000-000000000071','20000000-0000-0000-0000-000000000071','40000000-0000-0000-0000-000000000071','fuel','{"vendor":"Pilot","gallons":"50","cost":"200","odometer":"1050"}')$$,'retry succeeds with same request ID');
select is((select count(*) from public.fuel_entries where load_id='40000000-0000-0000-0000-000000000071'),1::bigint,'retry creates only one fuel entry');
select throws_ok($$select public.submit_driver_submission('60000000-0000-0000-0000-000000000071','20000000-0000-0000-0000-000000000071','40000000-0000-0000-0000-000000000071','fuel','{"vendor":"Pilot","gallons":"50","cost":"201","odometer":"1050"}')$$,'P0001','Submission reference already used for different data','request cannot be reused for different payload');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000071';
select is((select count(*) from public.approvals where company_id='10000000-0000-0000-0000-000000000071' and record_type='fuel_entry'),1::bigint,'driver submission creates exactly one approval');
select lives_ok($$select public.decide_approval('10000000-0000-0000-0000-000000000071',(select id from public.approvals where company_id='10000000-0000-0000-0000-000000000071' and record_type='fuel_entry'),'approved','Verified')$$,'owner completes approval');
select is((select status from public.fuel_entries where load_id='40000000-0000-0000-0000-000000000071'),'approved'::public.record_status,'approval updates source record');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000073';
select throws_ok($$select public.submit_driver_submission('60000000-0000-0000-0000-000000000071','20000000-0000-0000-0000-000000000071','40000000-0000-0000-0000-000000000071','fuel','{"vendor":"Pilot","gallons":"50","cost":"200","odometer":"1050"}')$$,'P0001','Active driver access required','different driver cannot replay request');
select throws_ok($$select * from private.driver_submission_requests$$,'42501',null,'request ledger is private');
reset role;
update public.company_memberships set is_active=false where company_id='10000000-0000-0000-0000-000000000071' and user_id='00000000-0000-0000-0000-000000000072';
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000072';
select is((select count(*) from public.loads),0::bigint,'removed driver loses assigned-load access');
select * from finish();rollback;
