begin;
select plan(31);

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000611','authenticated','authenticated','bank-owner@test.local','','{}','{}'),
 ('00000000-0000-0000-0000-000000000612','authenticated','authenticated','bank-auditor@test.local','','{}','{}'),
 ('00000000-0000-0000-0000-000000000613','authenticated','authenticated','bank-driver@test.local','','{}','{}');
insert into public.companies(id,legal_name,display_name,created_by) values
 ('10000000-0000-0000-0000-000000000611','Bank Test LLC','Bank Test','00000000-0000-0000-0000-000000000611');
insert into public.company_memberships(company_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000611','00000000-0000-0000-0000-000000000611','owner'),
 ('10000000-0000-0000-0000-000000000611','00000000-0000-0000-0000-000000000612','auditor'),
 ('10000000-0000-0000-0000-000000000611','00000000-0000-0000-0000-000000000613','driver');
insert into public.chart_of_accounts(id,company_id,account_number,name,account_type) values
 ('20000000-0000-0000-0000-000000000611','10000000-0000-0000-0000-000000000611','1000','Operating cash','asset'),
 ('20000000-0000-0000-0000-000000000612','10000000-0000-0000-0000-000000000611','3000','Opening equity','equity'),
 ('20000000-0000-0000-0000-000000000613','10000000-0000-0000-0000-000000000611','5000','Fuel expense','expense');

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000611';
select lives_ok($$select public.create_bank_account('10000000-0000-0000-0000-000000000611','Operating checking','checking','20000000-0000-0000-0000-000000000611')$$,'owner links a bank account to an asset ledger');
select throws_ok($$select public.create_bank_account('10000000-0000-0000-0000-000000000611','Invalid','checking','20000000-0000-0000-0000-000000000612')$$,'P0001','Choose an active asset ledger account','non-asset ledger is rejected');
select lives_ok($$select public.save_journal_entry('10000000-0000-0000-0000-000000000611',null,6101,'2026-09-01','Opening balance','[{"account":"1000 · Operating cash","description":"Cash","debit":1000,"credit":0},{"account":"3000 · Opening equity","description":"Equity","debit":0,"credit":1000}]',true)$$,'posts opening cash journal');
select lives_ok($$select public.save_journal_entry('10000000-0000-0000-0000-000000000611',null,6102,'2026-09-05','Fuel payment','[{"account":"5000 · Fuel expense","description":"Fuel","debit":100,"credit":0},{"account":"1000 · Operating cash","description":"Cash","debit":0,"credit":100}]',true)$$,'posts withdrawal journal');
select throws_ok($$insert into public.imported_transactions(company_id,bank_account_id,import_hash,posted_on,description,amount) values('10000000-0000-0000-0000-000000000611',(select id from public.bank_accounts limit 1),repeat('f',64),'2026-09-01','Bypass',1)$$,'P0001','Use the bank reconciliation workflow','direct statement insertion is blocked');

select lives_ok($$select public.import_bank_statement('10000000-0000-0000-0000-000000000611',(select id from public.bank_accounts where name='Operating checking'),'statement.csv','[{"hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","postedOn":"2026-09-01","description":"Opening deposit","amount":1000,"line":2},{"hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","postedOn":"2026-09-05","description":"Fuel stop","amount":-100,"line":3}]')$$,'imports valid signed statement rows');
select is((select count(*) from public.imported_transactions),2::bigint,'two statement rows persist');
select is((select imported_count from public.bank_statement_imports),2,'batch records imported count');
select is((select duplicate_count from public.bank_statement_imports),0,'first batch has no duplicates');
select lives_ok($$select public.import_bank_statement('10000000-0000-0000-0000-000000000611',(select id from public.bank_accounts where name='Operating checking'),'statement-repeat.csv','[{"hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","postedOn":"2026-09-01","description":"Opening deposit","amount":1000,"line":2},{"hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","postedOn":"2026-09-05","description":"Fuel stop","amount":-100,"line":3}]')$$,'reimport is idempotent');
select is((select duplicate_count from public.bank_statement_imports where original_name='statement-repeat.csv'),2,'repeat batch records both duplicates');
select is((select count(*) from public.imported_transactions),2::bigint,'duplicates do not create rows');

select throws_ok($$select public.review_bank_transaction('10000000-0000-0000-0000-000000000611',(select id from public.imported_transactions where amount=1000),'match',(select id from public.journal_entries where entry_number=6102),null)$$,'P0001','Statement and journal amounts must match','wrong journal amount is rejected');
select lives_ok($$select public.review_bank_transaction('10000000-0000-0000-0000-000000000611',(select id from public.imported_transactions where amount=1000),'match',(select id from public.journal_entries where entry_number=6101),null)$$,'deposit matches exact posted journal');
select lives_ok($$select public.review_bank_transaction('10000000-0000-0000-0000-000000000611',(select id from public.imported_transactions where amount=-100),'match',(select id from public.journal_entries where entry_number=6102),null)$$,'withdrawal matches exact posted journal');
select is((select count(*) from public.imported_transactions where review_status='matched'),2::bigint,'all rows are matched');
select throws_ok($$update public.imported_transactions set review_status='unreviewed',matched_type=null,matched_id=null where amount=1000$$,'P0001','Use the bank reconciliation workflow','direct review mutation is blocked');

select lives_ok($$select public.save_bank_reconciliation('10000000-0000-0000-0000-000000000611',(select id from public.bank_accounts where name='Operating checking'),'2026-09-01','2026-09-30',899)$$,'draft computes current book balance');
select is((select reconciled_balance from public.reconciliations),900.00::numeric,'draft stores posted book balance');
select throws_ok($$select public.complete_bank_reconciliation('10000000-0000-0000-0000-000000000611',(select id from public.reconciliations))$$,'P0001','Statement balance does not equal the posted book balance','nonzero difference cannot complete');
select lives_ok($$select public.save_bank_reconciliation('10000000-0000-0000-0000-000000000611',(select id from public.bank_accounts where name='Operating checking'),'2026-09-01','2026-09-30',900)$$,'draft recalculates with corrected statement balance');
select lives_ok($$select public.complete_bank_reconciliation('10000000-0000-0000-0000-000000000611',(select id from public.reconciliations))$$,'balanced reviewed period completes');
select is((select status from public.reconciliations),'completed','reconciliation is completed');
select is((select count(*) from public.imported_transactions where reconciliation_id is not null),2::bigint,'period rows link to reconciliation');
select throws_ok($$select public.review_bank_transaction('10000000-0000-0000-0000-000000000611',(select id from public.imported_transactions limit 1),'unmatch',null,null)$$,'P0001','Reconciled statement rows are immutable','completed rows cannot be reopened');
select throws_ok($$update public.reconciliations set statement_balance=1$$,'P0001','Use the bank reconciliation workflow','completed reconciliation rejects direct edits');

set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000612';
select is((select count(*) from public.reconciliations),0::bigint,'auditor cannot read bank reconciliation data');
select throws_ok($$select public.create_bank_account('10000000-0000-0000-0000-000000000611','Denied','checking','20000000-0000-0000-0000-000000000611')$$,'P0001','Finance access required','auditor cannot manage bank accounts');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000613';
select is((select count(*) from public.imported_transactions),0::bigint,'driver cannot read statement rows');
select is(has_function_privilege('anon','public.import_bank_statement(uuid,uuid,text,jsonb)','EXECUTE'),false,'anonymous role cannot execute statement import');
select is(has_function_privilege('authenticated','public.import_bank_statement(uuid,uuid,text,jsonb)','EXECUTE'),true,'authenticated role has explicit statement import execution grant');

select * from finish();
rollback;
