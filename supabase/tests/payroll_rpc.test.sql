begin;select plan(18);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000061','authenticated','authenticated','payroll-owner@test.local','','{}','{"full_name":"Payroll Owner"}'),
('00000000-0000-0000-0000-000000000062','authenticated','authenticated','payroll-driver@test.local','','{}','{"full_name":"Avery Driver"}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000061','Payroll Test LLC','Payroll Test','00000000-0000-0000-0000-000000000061');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000061','owner'),
('10000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000062','driver');
insert into public.drivers(company_id,profile_id,status) values('10000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000062','active');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000061';
select lives_ok($$select public.save_driver_settlement('10000000-0000-0000-0000-000000000061',null,'Avery Driver','2026-09-01','2026-09-15',8,6000,200,300,'draft',null)$$,'owner creates settlement');
select is((select count(*) from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'),1::bigint,'settlement created');
select is((select count(*) from public.payroll_periods where company_id='10000000-0000-0000-0000-000000000061'),1::bigint,'pay period created atomically');
select is((select details->>'loads' from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'),'8','load count retained');
select lives_ok($$select public.save_driver_settlement('10000000-0000-0000-0000-000000000061',(select id from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'),'Avery Driver','2026-09-01','2026-09-15',8,6000,200,300,'posted','2026-09-16')$$,'owner marks settlement paid');
select throws_ok($$select public.delete_driver_settlement('10000000-0000-0000-0000-000000000061',(select id from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'))$$,'P0001','Paid settlements cannot be deleted','paid settlement cannot be deleted');
select throws_ok($$select public.save_driver_settlement('10000000-0000-0000-0000-000000000061',(select id from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'),'Avery Driver','2026-09-01','2026-09-15',8,1,0,0,'draft',null)$$,'P0001','Paid settlements require a separate correction','paid settlement cannot be reopened through save RPC');
select throws_ok($$update public.driver_settlements set gross_pay=1 where company_id='10000000-0000-0000-0000-000000000061'$$,'P0001','Paid settlements require a separate correction','direct amount edits are blocked');
select throws_ok($$update public.driver_settlements set status='draft' where company_id='10000000-0000-0000-0000-000000000061'$$,'P0001','Paid settlements require a separate correction','direct reopening is blocked');
select throws_ok($$delete from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'$$,'P0001','Paid settlements cannot be deleted','direct deletion is blocked');
select throws_ok($$update public.payroll_periods set ends_on='2026-09-30' where company_id='10000000-0000-0000-0000-000000000061'$$,'P0001','Periods with paid settlements cannot be changed or deleted','shared period dates cannot rewrite paid history');
select throws_ok($$delete from public.payroll_periods where company_id='10000000-0000-0000-0000-000000000061'$$,'P0001','Periods with paid settlements cannot be changed or deleted','shared period deletion cannot remove paid history');
select is((select gross_pay from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'),6000::numeric,'failed changes preserve paid amounts');
select is((select sum(l.debit-l.credit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where l.company_id='10000000-0000-0000-0000-000000000061' and a.account_type='expense'),6200::numeric,'paid settlement posts compensation and reimbursements as expenses');
select is((select sum(l.credit-l.debit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where l.company_id='10000000-0000-0000-0000-000000000061' and a.account_number='1000'),5900::numeric,'paid settlement credits only net pay to cash');
select is((select sum(l.credit-l.debit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where l.company_id='10000000-0000-0000-0000-000000000061' and a.account_number='2350'),300::numeric,'authorized deductions remain payable');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000062';
select throws_ok($$select public.save_driver_settlement('10000000-0000-0000-0000-000000000061',null,'Avery Driver','2026-09-01','2026-09-15',1,1,0,0,'draft',null)$$,'P0001','Payroll access required','driver cannot manage payroll');
select is((select count(*) from public.driver_settlements where company_id='10000000-0000-0000-0000-000000000061'),1::bigint,'unauthorized attempt made no changes');
select * from finish();rollback;
