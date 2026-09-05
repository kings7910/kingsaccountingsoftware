begin;
select plan(20);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000501','authenticated','authenticated','bill-owner@test.local','','{}','{}'),
 ('00000000-0000-0000-0000-000000000502','authenticated','authenticated','bill-auditor@test.local','','{}','{}'),
 ('00000000-0000-0000-0000-000000000503','authenticated','authenticated','bill-driver@test.local','','{}','{}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000501','Bill Test LLC','Bill Test','00000000-0000-0000-0000-000000000501');
insert into public.company_memberships(company_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000501','owner'),
 ('10000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000502','auditor'),
 ('10000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000503','driver');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000501';
select lives_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',null,'Road Service','RS-100','2026-07-01','2026-07-31','open',1000,'Repair')$$,'owner creates vendor bill atomically');
select is((select count(*) from public.vendors where company_id='10000000-0000-0000-0000-000000000501'),1::bigint,'vendor resolves atomically');
select is((select amount from public.vendor_bills where bill_number='RS-100'),1000.00::numeric,'bill amount persists');
select lives_ok($$select public.record_vendor_bill_payment('10000000-0000-0000-0000-000000000501',(select id from public.vendor_bills where bill_number='RS-100'),'2026-08-15',400,'ACH-1')$$,'partial payment records');
select is((select status from public.vendor_bills where bill_number='RS-100'),'open','partial payment keeps bill open');
select is((select sum(amount) from public.vendor_bill_payments),'400.00'::numeric,'dated allocation persists');
select throws_ok($$update public.vendor_bills set status='paid' where bill_number='RS-100'$$,'P0001','Paid bill requires a full dated payment allocation','partial bill cannot be marked paid directly');
select throws_ok($$update public.vendor_bills set status='void' where bill_number='RS-100'$$,'P0001','Bills with payments require an adjustment','partially paid bill cannot be voided');
select throws_ok($$select public.record_vendor_bill_payment('10000000-0000-0000-0000-000000000501',(select id from public.vendor_bills where bill_number='RS-100'),'2026-08-16',601,'ACH-2')$$,'P0001','Payment exceeds the outstanding balance','overpayment is rejected');
select lives_ok($$select public.record_vendor_bill_payment('10000000-0000-0000-0000-000000000501',(select id from public.vendor_bills where bill_number='RS-100'),'2026-08-16',600,'ACH-2')$$,'final payment records');
select is((select status from public.vendor_bills where bill_number='RS-100'),'paid','full allocation marks bill paid');
select throws_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',(select id from public.vendor_bills where bill_number='RS-100'),'Road Service','RS-100','2026-07-01','2026-07-31','open',999,'Changed')$$,'P0001','Paid or void bills require an adjustment','paid bill cannot be edited');
select throws_ok($$delete from public.vendor_bills where bill_number='RS-100'$$,'P0001','Only unpaid draft bills can be deleted','paid bill cannot be deleted');
select lives_ok($$update public.vendor_bill_payments set amount=1$$,'unauthorized payment update is safely ignored by RLS');
select is((select sum(amount) from public.vendor_bill_payments),1000.00::numeric,'payment allocations remain immutable');
select lives_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',null,'Insurance Co','INS-10','2026-09-01','2026-09-30','paid',250,'Policy')$$,'mark paid records the bill and payment');
select is((select count(*) from public.vendor_bill_payments p join public.vendor_bills b on b.id=p.vendor_bill_id where b.bill_number='INS-10' and p.paid_on=current_date and p.amount=250),1::bigint,'mark paid creates a dated full allocation');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000502';
select is((select count(*) from public.vendor_bills),2::bigint,'auditor can read company payables');
select throws_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',null,'Denied','NO-1','2026-09-01','2026-09-30','open',1,'')$$,'P0001','Finance access required','auditor cannot mutate bills');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000503';
select is((select count(*) from public.vendor_bills),0::bigint,'driver cannot read company payables');
select * from finish();
rollback;
