begin;select plan(6);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000041','authenticated','authenticated','fuel-owner@test.local','','{}','{}'),
('00000000-0000-0000-0000-000000000042','authenticated','authenticated','fuel-driver@test.local','','{}','{}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000041','Fuel Test LLC','Fuel Test','00000000-0000-0000-0000-000000000041');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000041','owner'),
('10000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000042','driver');
insert into public.trucks(id,company_id,unit_number,status) values('20000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000041','204','active');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000041';
select lives_ok($$select public.save_fuel_entry('10000000-0000-0000-0000-000000000041',null,'2026-09-04','204','Pilot','Dallas, TX','TX',100,400,120000,'RCT-1')$$,'owner creates fuel entry');
select is((select count(*) from public.fuel_entries where company_id='10000000-0000-0000-0000-000000000041'),1::bigint,'fuel entry created');
select is((select price_per_gallon from public.fuel_entries where company_id='10000000-0000-0000-0000-000000000041'),4.0000::numeric,'price per gallon calculated');
select lives_ok($$select public.save_fuel_entry('10000000-0000-0000-0000-000000000041',(select id from public.fuel_entries where company_id='10000000-0000-0000-0000-000000000041'),'2026-09-04','204','Love''s','Memphis, TN','TN',80,360,120500,'RCT-2')$$,'owner updates fuel entry');
select is((select station_name from public.fuel_entries where company_id='10000000-0000-0000-0000-000000000041'),'Love''s','update persisted');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000042';
select throws_ok($$select public.save_fuel_entry('10000000-0000-0000-0000-000000000041',null,'2026-09-04','204','Pilot','Dallas','TX',1,4,1,'')$$,'P0001','Fuel access required','driver cannot manage company fuel');
select * from finish();rollback;
