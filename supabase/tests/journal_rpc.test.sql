begin;select plan(10);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000071','authenticated','authenticated','journal-owner@test.local','','{}','{"full_name":"Journal Owner"}'),
('00000000-0000-0000-0000-000000000072','authenticated','authenticated','journal-driver@test.local','','{}','{"full_name":"Journal Driver"}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000071','Journal Test LLC','Journal Test','00000000-0000-0000-0000-000000000071');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000071','owner'),
('10000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000072','driver');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000071';
select lives_ok($$select public.save_journal_entry('10000000-0000-0000-0000-000000000071',null,1001,'2026-09-04','Fuel invoice','[{"account":"5000 · Fuel expense","description":"Fuel","debit":400,"credit":0},{"account":"2000 · Accounts payable","description":"Payable","debit":0,"credit":400}]',false)$$,'owner saves draft');
select is((select count(*) from public.journal_entries where company_id='10000000-0000-0000-0000-000000000071'),1::bigint,'draft created');
select is((select count(*) from public.chart_of_accounts where company_id='10000000-0000-0000-0000-000000000071'),2::bigint,'accounts resolved atomically');
select lives_ok($$select public.save_journal_entry('10000000-0000-0000-0000-000000000071',(select id from public.journal_entries where company_id='10000000-0000-0000-0000-000000000071'),1001,'2026-09-04','Fuel invoice','[{"account":"5000 · Fuel expense","description":"Fuel","debit":400,"credit":0},{"account":"2000 · Accounts payable","description":"Payable","debit":0,"credit":400}]',true)$$,'balanced draft posts');
select is((select status from public.journal_entries where entry_number=1001 and company_id='10000000-0000-0000-0000-000000000071'),'posted'::public.record_status,'posted state persisted');
select throws_ok($$update public.journal_entries set memo='tampered' where entry_number=1001 and company_id='10000000-0000-0000-0000-000000000071'$$,'P0001','Posted journal entries must be reversed, not edited','posted header immutable');
select lives_ok($$select public.reverse_journal_entry('10000000-0000-0000-0000-000000000071',(select id from public.journal_entries where entry_number=1001 and company_id='10000000-0000-0000-0000-000000000071'),1002,'2026-09-05')$$,'posted entry reverses');
select is((select sum(debit)-sum(credit) from public.journal_lines where journal_entry_id=(select id from public.journal_entries where entry_number=1002 and company_id='10000000-0000-0000-0000-000000000071')),0.00::numeric,'reversal remains balanced');
select throws_ok($$select public.reverse_journal_entry('10000000-0000-0000-0000-000000000071',(select id from public.journal_entries where entry_number=1001 and company_id='10000000-0000-0000-0000-000000000071'),1003,'2026-09-05')$$,'P0001','Journal entry already reversed','duplicate reversal rejected');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000072';
select throws_ok($$select public.save_journal_entry('10000000-0000-0000-0000-000000000071',null,1004,'2026-09-04','Unauthorized','[]',false)$$,'P0001','Accounting access required','driver cannot manage journal');
select * from finish();rollback;
