begin;
select plan(8);
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000301','release-owner@test.local'),('00000000-0000-0000-0000-000000000302','release-dispatch@test.local');
insert into public.companies(id,legal_name,display_name,created_by) values
('10000000-0000-0000-0000-000000000301','A','A','00000000-0000-0000-0000-000000000301'),
('10000000-0000-0000-0000-000000000302','B','B','00000000-0000-0000-0000-000000000301');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000301','owner'),
('10000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000301','owner'),
('10000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000302','dispatcher');
insert into public.customers(id,company_id,name) values('20000000-0000-0000-0000-000000000302','10000000-0000-0000-0000-000000000302','Other company customer');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000301';
select throws_ok($$insert into public.invoices(company_id,customer_id,issued_on,due_on,created_by) values('10000000-0000-0000-0000-000000000301','20000000-0000-0000-0000-000000000302','2026-09-01','2026-09-30','00000000-0000-0000-0000-000000000301')$$,'23503',null,'cross-company reference rejected even for an owner of both companies');
select throws_ok($$insert into public.journal_entries(company_id,entry_number,entry_date,memo,status,created_by) values('10000000-0000-0000-0000-000000000301',301,'2026-09-01','Bypass','posted','00000000-0000-0000-0000-000000000301')$$,'P0001','Create a draft and balance its lines before posting','direct posted insert rejected');
select lives_ok($$select public.save_journal_entry('10000000-0000-0000-0000-000000000301',null,302,'2026-09-01','Balanced','[{"account":"1000 · Cash","debit":100,"credit":0},{"account":"4000 · Revenue","debit":0,"credit":100}]',true)$$,'balanced journal posts');
select throws_ok($$insert into public.journal_lines(company_id,journal_entry_id,account_id,debit,credit) select company_id,id,(select id from public.chart_of_accounts where company_id='10000000-0000-0000-0000-000000000301' and account_number='1000'),1,0 from public.journal_entries where company_id='10000000-0000-0000-0000-000000000301' and entry_number=302$$,'P0001','Posted journal entries are immutable','cannot append a line to posted journal');
select lives_ok($$select public.reverse_journal_entry('10000000-0000-0000-0000-000000000301',(select id from public.journal_entries where company_id='10000000-0000-0000-0000-000000000301' and entry_number=302),303,'2026-09-02')$$,'reversal uses balanced posting workflow');
insert into public.accounting_periods(company_id,starts_on,ends_on,closed_at) values('10000000-0000-0000-0000-000000000301','2026-08-01','2026-08-31',now());
select throws_ok($$select public.save_journal_entry('10000000-0000-0000-0000-000000000301',null,304,'2026-08-10','Closed','[{"account":"1000 · Cash","debit":100,"credit":0},{"account":"4000 · Revenue","debit":0,"credit":100}]',true)$$,'P0001','Accounting period is closed','cannot post into a closed period');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000302';
select is((select count(*) from public.journal_entries),0::bigint,'dispatcher cannot read ledger');
select throws_ok($$insert into public.journal_entries(company_id,entry_number,entry_date,memo,created_by) values('10000000-0000-0000-0000-000000000301',305,'2026-09-01','Unauthorized','00000000-0000-0000-0000-000000000302')$$,'42501',null,'dispatcher cannot write directly to ledger');
select * from finish();rollback;
