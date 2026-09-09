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

insert into public.fuel_entries(id,company_id,driver_id,truck_id,load_id,purchased_at,station_name,gallons,price_per_gallon,total_cost,status) values
('60000000-0000-0000-0000-000000000071','10000000-0000-0000-0000-000000000071','20000000-0000-0000-0000-000000000071','30000000-0000-0000-0000-000000000071','40000000-0000-0000-0000-000000000071',now(),'Gas station',10,4,40,'pending'),
('60000000-0000-0000-0000-000000000072','10000000-0000-0000-0000-000000000071','20000000-0000-0000-0000-000000000072','30000000-0000-0000-0000-000000000072','40000000-0000-0000-0000-000000000072',now(),'Other station',10,4,40,'pending');
insert into storage.objects(bucket_id,name) values
('receipts','10000000-0000-0000-0000-000000000071/00000000-0000-0000-0000-000000000072/gas.jpg'),
('receipts','10000000-0000-0000-0000-000000000071/00000000-0000-0000-0000-000000000071/office.pdf');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000072';
select lives_ok($$select public.record_fuel_receipt('60000000-0000-0000-0000-000000000071','10000000-0000-0000-0000-000000000071/00000000-0000-0000-0000-000000000072/gas.jpg','gas.jpg','image/jpeg',100)$$,'driver attaches gas receipt to their pending fuel entry');
select is((select fuel_entry_id from public.receipts limit 1),'60000000-0000-0000-0000-000000000071'::uuid,'receipt links to exact fuel entry');
select is((select load_id from public.receipts limit 1),'40000000-0000-0000-0000-000000000071'::uuid,'receipt also appears under the load');
select is((select linked_type from public.documents limit 1),'fuel_entry','document links to fuel');
select throws_ok($$select public.record_fuel_receipt('60000000-0000-0000-0000-000000000072','10000000-0000-0000-0000-000000000071/00000000-0000-0000-0000-000000000072/gas.jpg','gas.jpg','image/jpeg',100)$$,'P0001','Fuel entry not found','driver cannot attach to another driver fuel');
select throws_ok($$select public.record_fuel_receipt('60000000-0000-0000-0000-000000000071','10000000-0000-0000-0000-000000000071/00000000-0000-0000-0000-000000000071/office.pdf','office.pdf','application/pdf',100)$$,'P0001','Invalid receipt path','driver cannot attach another uploader file');
select throws_ok($$select public.record_fuel_receipt('60000000-0000-0000-0000-000000000071','10000000-0000-0000-0000-000000000071/00000000-0000-0000-0000-000000000072/missing.pdf','missing.pdf','application/pdf',100)$$,'P0001','Uploaded receipt not found','missing object is rejected');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000073';
select is((select count(*) from public.receipts),0::bigint,'other driver cannot read the receipt');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000071';
select lives_ok($$select public.record_fuel_receipt('60000000-0000-0000-0000-000000000071','10000000-0000-0000-0000-000000000071/00000000-0000-0000-0000-000000000071/office.pdf','office.pdf','application/pdf',100)$$,'owner attaches receipt to driver fuel');
select is((select total_cost from public.fuel_entries where id='60000000-0000-0000-0000-000000000071'),40::numeric,'attaching receipts does not change fuel cost');
select * from finish();rollback;
