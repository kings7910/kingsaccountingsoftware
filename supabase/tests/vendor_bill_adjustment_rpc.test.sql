begin;
select plan(34);

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000511','authenticated','authenticated','adjust-owner@test.local','','{}','{}'),
 ('00000000-0000-0000-0000-000000000512','authenticated','authenticated','adjust-auditor@test.local','','{}','{}'),
 ('00000000-0000-0000-0000-000000000513','authenticated','authenticated','adjust-driver@test.local','','{}','{}');
insert into public.companies(id,legal_name,display_name,created_by)
values('10000000-0000-0000-0000-000000000511','Adjustment Test LLC','Adjustment Test','00000000-0000-0000-0000-000000000511');
insert into public.company_memberships(company_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000511','00000000-0000-0000-0000-000000000511','owner'),
 ('10000000-0000-0000-0000-000000000511','00000000-0000-0000-0000-000000000512','auditor'),
 ('10000000-0000-0000-0000-000000000511','00000000-0000-0000-0000-000000000513','driver');

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000511';

select lives_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000511',null,'Parts Vendor','PART-1','2026-09-01','2026-09-30','paid',100,'Parts','5900 · Other expense','1000 · Cash')$$,'creates and pays the source bill');
select is((select status from public.vendor_bills where bill_number='PART-1'),'paid','source bill starts paid');
select is((select sum(amount) from public.vendor_bill_payments),100.00::numeric,'source payment is dated and preserved');

select lives_ok($$select public.record_vendor_bill_adjustment('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='PART-1'),'2026-09-05','credit',25,'Returned parts')$$,'records a vendor credit atomically');
select is((select count(*) from public.vendor_bill_adjustments where adjustment_type='credit'),1::bigint,'credit record persists');
select isnt((select journal_entry_id from public.vendor_bill_adjustments where adjustment_type='credit'),null::uuid,'credit links to a journal');
select is((select status from public.vendor_bills where bill_number='PART-1'),'paid','credit keeps the overpaid bill closed');
select is(private.vendor_bill_adjusted_total('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='PART-1')),75.00::numeric,'credit reduces the adjusted bill total');
select is((select sum(l.credit)-sum(l.debit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where a.account_number='2000'),'-25.00'::numeric,'credit creates a vendor credit in A/P control');
select is((select sum(l.debit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where a.account_number='2000' and l.journal_entry_id=(select journal_entry_id from public.vendor_bill_adjustments where adjustment_type='credit')),25.00::numeric,'credit debits A/P');
select is((select sum(l.credit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where a.account_number='5900' and l.journal_entry_id=(select journal_entry_id from public.vendor_bill_adjustments where adjustment_type='credit')),25.00::numeric,'credit reduces the original expense');

select lives_ok($$select public.record_vendor_bill_adjustment('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='PART-1'),'2026-09-06','debit',40,'Replacement surcharge')$$,'records a vendor debit atomically');
select is((select status from public.vendor_bills where bill_number='PART-1'),'open','debit reopens the paid bill');
select is(private.vendor_bill_adjusted_total('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='PART-1')),115.00::numeric,'debit increases the adjusted bill total');
select is((select sum(l.credit)-sum(l.debit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where a.account_number='2000'),15.00::numeric,'A/P control matches the reopened balance');
select is((select sum(debit)-sum(credit) from public.journal_lines where journal_entry_id=(select journal_entry_id from public.vendor_bill_adjustments where adjustment_type='debit')),0.00::numeric,'debit journal balances');
select throws_ok($$select public.record_vendor_bill_payment('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='PART-1'),'2026-09-07',16,'Too much','1000 · Cash')$$,'P0001','Payment exceeds the outstanding balance','adjusted total limits later payments');
select lives_ok($$select public.record_vendor_bill_payment('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='PART-1'),'2026-09-07',15,'Balance','1000 · Cash')$$,'pays the reopened balance');
select is((select status from public.vendor_bills where bill_number='PART-1'),'paid','adjusted bill closes after full payment');
select is((select sum(l.credit)-sum(l.debit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where a.account_number='2000'),0.00::numeric,'final payment clears adjusted A/P');

select lives_ok($$select public.save_vendor_bill('10000000-0000-0000-0000-000000000511',null,'Adjusted Open Vendor','ADJ-VOID','2026-09-01','2026-09-30','open',50,'Adjusted open bill','5900 · Other expense','1000 · Cash')$$,'creates a second open bill');
select lives_ok($$select public.record_vendor_bill_adjustment('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='ADJ-VOID'),'2026-09-08','credit',10,'Open bill credit')$$,'credits the open bill');
select throws_ok($$select public.void_vendor_bill('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='ADJ-VOID'),'2026-09-09')$$,'P0001','Bills with adjustments cannot be voided','adjusted bill cannot be voided by reversing only its original journal');

select throws_ok($$select public.record_vendor_bill_adjustment('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='PART-1'),'2026-09-08','credit',116,'Invalid credit')$$,'P0001','Credit exceeds the adjusted bill total','credit cannot make the adjusted bill total negative');
select throws_ok($$select public.record_vendor_bill_adjustment('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='PART-1'),'2026-08-31','debit',1,'Before bill')$$,'P0001','Adjustment date cannot precede the bill date','adjustment date cannot precede bill');
select is((select count(*) from public.vendor_bill_adjustments),3::bigint,'failed adjustments leave no records');

insert into public.accounting_periods(company_id,starts_on,ends_on,closed_at,closed_by)
values('10000000-0000-0000-0000-000000000511','2026-10-01','2026-10-31',now(),'00000000-0000-0000-0000-000000000511');
select throws_ok($$select public.record_vendor_bill_adjustment('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='PART-1'),'2026-10-05','debit',10,'Closed period')$$,'P0001','Accounting period is closed','closed period rejects the entire adjustment posting');
select is((select count(*) from public.vendor_bill_adjustments),3::bigint,'closed-period failure is atomic');
select throws_ok($$update public.vendor_bill_adjustments set amount=1$$,'42501','permission denied for table vendor_bill_adjustments','adjustments cannot be updated');
select throws_ok($$delete from public.vendor_bill_adjustments$$,'42501','permission denied for table vendor_bill_adjustments','adjustments cannot be deleted');
select is((select count(distinct journal_entry_id) from public.vendor_bill_adjustments),3::bigint,'each adjustment has a distinct journal');

set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000512';
select is((select count(*) from public.vendor_bill_adjustments),3::bigint,'auditor can read adjustments');
select throws_ok($$select public.record_vendor_bill_adjustment('10000000-0000-0000-0000-000000000511',(select id from public.vendor_bills where bill_number='PART-1'),'2026-09-09','debit',1,'Denied')$$,'P0001','Finance access required','auditor cannot create adjustments');

set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000513';
select is((select count(*) from public.vendor_bill_adjustments),0::bigint,'driver cannot read adjustments');

select * from finish();
rollback;
