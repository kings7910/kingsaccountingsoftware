begin;
select plan(4);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000081','authenticated','authenticated','notify-owner@test.local','','{}','{}'),
('00000000-0000-0000-0000-000000000082','authenticated','authenticated','notify-driver@test.local','','{}','{}'),
('00000000-0000-0000-0000-000000000083','authenticated','authenticated','notify-auditor@test.local','','{}','{}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000081','Notify Test LLC','Notify Test','00000000-0000-0000-0000-000000000081');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000081','owner'),
('10000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','driver'),
('10000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000083','auditor');
insert into public.drivers(id,company_id,profile_id) values('20000000-0000-0000-0000-000000000081','10000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082');
insert into public.trucks(id,company_id,unit_number) values('30000000-0000-0000-0000-000000000081','10000000-0000-0000-0000-000000000081','N81');
insert into public.loads(id,company_id,load_number,driver_id,truck_id,status) values('40000000-0000-0000-0000-000000000081','10000000-0000-0000-0000-000000000081','NOTIFY-1','20000000-0000-0000-0000-000000000081','30000000-0000-0000-0000-000000000081','dispatched');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000082';
select lives_ok($$select public.submit_driver_fuel('40000000-0000-0000-0000-000000000081','Pilot',10,40,1000)$$,'driver submission succeeds');
reset role;
select is((select count(*) from public.notifications where user_id='00000000-0000-0000-0000-000000000081'),1::bigint,'owner receives submission notification');
select is((select count(*) from public.notifications where user_id='00000000-0000-0000-0000-000000000082'),0::bigint,'submitter is not notified about their own action');
select is((select count(*) from public.notifications where user_id='00000000-0000-0000-0000-000000000083'),0::bigint,'unrelated roles are not notified');
select * from finish();rollback;
