begin;
select plan(39);
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
select lives_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',null,'Road Service','RS-100','2026-07-01','2026-07-31','open',1000,'Repair','5200 · Repairs & maintenance','1000 · Cash')$$,'owner creates vendor bill atomically');
select is((select count(*) from public.vendors where company_id='10000000-0000-0000-0000-000000000501'),1::bigint,'vendor resolves atomically');
select is((select amount from public.vendor_bills where bill_number='RS-100'),1000.00::numeric,'bill amount persists');
select isnt((select journal_entry_id from public.vendor_bills where bill_number='RS-100'),null::uuid,'open bill links to a journal');
select is((select count(*) from public.journal_lines where journal_entry_id=(select journal_entry_id from public.vendor_bills where bill_number='RS-100')),2::bigint,'bill journal has two lines');
select is((select sum(l.credit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where a.account_number='2000'),1000.00::numeric,'bill credits the A/P control account');
select is((select sum(l.debit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where a.account_number='5200'),1000.00::numeric,'bill debits the selected expense account');
select lives_ok($$select public.record_vendor_bill_payment('10000000-0000-0000-0000-000000000501',(select id from public.vendor_bills where bill_number='RS-100'),'2026-08-15',400,'ACH-1','1010 · Operating checking')$$,'partial payment records');
select is((select status from public.vendor_bills where bill_number='RS-100'),'open','partial payment keeps bill open');
select is((select sum(amount) from public.vendor_bill_payments),'400.00'::numeric,'dated allocation persists');
select isnt((select journal_entry_id from public.vendor_bill_payments where reference='ACH-1'),null::uuid,'payment links to a journal');
select is((select count(*) from public.journal_lines where journal_entry_id=(select journal_entry_id from public.vendor_bill_payments where reference='ACH-1')),2::bigint,'payment journal has two lines');
select is((select sum(l.credit)-sum(l.debit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where a.account_number='2000'),600.00::numeric,'A/P control balance matches the partial balance');
select throws_ok($$update public.vendor_bills set status='paid' where bill_number='RS-100'$$,'P0001','Paid bill requires a full dated payment allocation','partial bill cannot be marked paid directly');
select throws_ok($$update public.vendor_bills set status='void' where bill_number='RS-100'$$,'P0001','Bills with payments require an adjustment','partially paid bill cannot be voided');
select throws_ok($$select public.record_vendor_bill_payment('10000000-0000-0000-0000-000000000501',(select id from public.vendor_bills where bill_number='RS-100'),'2026-08-16',601,'ACH-2','1010 · Operating checking')$$,'P0001','Payment exceeds the outstanding balance','overpayment is rejected');
select lives_ok($$select public.record_vendor_bill_payment('10000000-0000-0000-0000-000000000501',(select id from public.vendor_bills where bill_number='RS-100'),'2026-08-16',600,'ACH-2','1010 · Operating checking')$$,'final payment records');
select is((select status from public.vendor_bills where bill_number='RS-100'),'paid','full allocation marks bill paid');
select is((select sum(l.credit)-sum(l.debit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where a.account_number='2000'),0.00::numeric,'full payment clears the A/P control balance');
select throws_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',(select id from public.vendor_bills where bill_number='RS-100'),'Road Service','RS-100','2026-07-01','2026-07-31','open',999,'Changed','5200 · Repairs & maintenance','1000 · Cash')$$,'P0001','Paid or void bills require an adjustment','paid bill cannot be edited');
select throws_ok($$delete from public.vendor_bills where bill_number='RS-100'$$,'P0001','Only unpaid draft bills can be deleted','paid bill cannot be deleted');
select lives_ok($$update public.vendor_bill_payments set amount=1$$,'unauthorized payment update is safely ignored by RLS');
select is((select sum(amount) from public.vendor_bill_payments),1000.00::numeric,'payment allocations remain immutable');
select lives_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',null,'Insurance Co','INS-10','2026-09-01','2026-09-30','paid',250,'Policy','5900 · Other expense','1000 · Cash')$$,'mark paid records the bill and payment');
select is((select count(*) from public.vendor_bill_payments p join public.vendor_bills b on b.id=p.vendor_bill_id where b.bill_number='INS-10' and p.paid_on=current_date and p.amount=250),1::bigint,'mark paid creates a dated full allocation');
select is((select count(*) from public.journal_entries j where j.id in ((select journal_entry_id from public.vendor_bills where bill_number='INS-10'),(select p.journal_entry_id from public.vendor_bill_payments p join public.vendor_bills b on b.id=p.vendor_bill_id where b.bill_number='INS-10')) and j.status='posted'),2::bigint,'mark paid posts bill and payment journals');
insert into public.accounting_periods(company_id,starts_on,ends_on,closed_at,closed_by) values('10000000-0000-0000-0000-000000000501','2026-06-01','2026-06-30',now(),'00000000-0000-0000-0000-000000000501');
select throws_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',null,'Closed Vendor','CLOSED-1','2026-06-15','2026-06-30','open',50,'Closed','5900 · Other expense','1000 · Cash')$$,'P0001','Accounting period is closed','closed period rejects the entire bill posting');
select is((select count(*) from public.vendor_bills where bill_number='CLOSED-1'),0::bigint,'failed posting leaves no bill');
select throws_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',null,'Wrong Account','WRONG-1','2026-09-01','2026-09-30','open',50,'Wrong','1000 · Cash','1000 · Cash')$$,'P0001','Ledger account has the wrong type or is inactive','asset account cannot be used as an expense');
select lives_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',null,'Open Vendor','OPEN-1','2026-09-01','2026-09-30','open',75,'Posted','5900 · Other expense','1000 · Cash')$$,'open bill posts immediately');
select throws_ok($$update public.vendor_bills set description='tampered' where bill_number='OPEN-1'$$,'P0001','Posted vendor bills require a reversing adjustment','posted bill cannot diverge from its journal');
select lives_ok($$select public.void_vendor_bill('10000000-0000-0000-0000-000000000501',(select id from public.vendor_bills where bill_number='OPEN-1'),'2026-09-05')$$,'unpaid posted bill voids with a reversal');
select is((select status from public.vendor_bills where bill_number='OPEN-1'),'void','reversed vendor bill is void');
select is((select count(*) from public.journal_entries where reverses_entry_id=(select journal_entry_id from public.vendor_bills where bill_number='OPEN-1') and status='posted'),1::bigint,'void links a posted reversal');
select is((select sum(debit)-sum(credit) from public.journal_lines where journal_entry_id=(select id from public.journal_entries where reverses_entry_id=(select journal_entry_id from public.vendor_bills where bill_number='OPEN-1'))),0.00::numeric,'void reversal remains balanced');
select throws_ok($$select public.void_vendor_bill('10000000-0000-0000-0000-000000000501',(select id from public.vendor_bills where bill_number='OPEN-1'),'2026-09-05')$$,'P0001','Open vendor bill not found','void cannot be repeated');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000502';
select is((select count(*) from public.vendor_bills),3::bigint,'auditor can read company payables');
select throws_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000501',null,'Denied','NO-1','2026-09-01','2026-09-30','open',1,'','5900 · Other expense','1000 · Cash')$$,'P0001','Finance access required','auditor cannot mutate bills');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000503';
select is((select count(*) from public.vendor_bills),0::bigint,'driver cannot read company payables');
select * from finish();
rollback;
