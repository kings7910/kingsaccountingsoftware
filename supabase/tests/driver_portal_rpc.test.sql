begin;
select plan(12);

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
insert into public.documents(id,company_id,bucket,object_path,document_type,original_name,mime_type,size_bytes,uploaded_by) values
('50000000-0000-0000-0000-000000000071','10000000-0000-0000-0000-000000000071','receipts','10000000-0000-0000-0000-000000000071/00000000-0000-0000-0000-000000000073/private.pdf','receipt','private.pdf','application/pdf',10,'00000000-0000-0000-0000-000000000073');
insert into public.receipts(company_id,document_id,load_id) values('10000000-0000-0000-0000-000000000071','50000000-0000-0000-0000-000000000071','40000000-0000-0000-0000-000000000072');

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000072';
select lives_ok($$select public.submit_driver_mileage('40000000-0000-0000-0000-000000000071',1000,1100,80,20,'Delivered safely')$$,'driver submits assigned-load mileage');
select is((select status::text from public.mileage_logs where load_id='40000000-0000-0000-0000-000000000071'),'pending','mileage waits for approval');
select lives_ok($$select public.submit_driver_fuel('40000000-0000-0000-0000-000000000071','Pilot',50,200,1050)$$,'driver submits assigned-load fuel');
select is((select price_per_gallon from public.fuel_entries where load_id='40000000-0000-0000-0000-000000000071'),4.0000::numeric,'fuel unit price is calculated');
select lives_ok($$select public.report_driver_vehicle_issue('40000000-0000-0000-0000-000000000071','Check engine light')$$,'driver reports assigned vehicle issue');
select is((select reported_by from public.work_orders where issue='Check engine light'),'00000000-0000-0000-0000-000000000072'::uuid,'issue is attributed to the driver');
select lives_ok($$select public.record_driver_receipt('40000000-0000-0000-0000-000000000071','receipts','10000000-0000-0000-0000-000000000071/00000000-0000-0000-0000-000000000072/receipt.pdf','receipt.pdf','application/pdf',100)$$,'driver records uploaded receipt atomically');
select is((select count(*) from public.receipts),1::bigint,'driver sees only their own receipt');
select is((select count(*) from public.documents),1::bigint,'driver sees only their own document');
select is((select count(*) from public.work_orders),1::bigint,'driver sees only their reported issue');
select throws_ok($$select public.submit_driver_mileage('40000000-0000-0000-0000-000000000072',1000,1100,80,20,'')$$,'P0001','Assigned load not found','driver cannot submit mileage for another driver');
select throws_ok($$select public.record_driver_receipt('40000000-0000-0000-0000-000000000071','receipts','10000000-0000-0000-0000-000000000071/00000000-0000-0000-0000-000000000073/forged.pdf','forged.pdf','application/pdf',100)$$,'P0001','Invalid receipt path','driver cannot forge another user storage path');

select * from finish();
rollback;
