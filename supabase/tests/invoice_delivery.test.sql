begin;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000000971','document-owner@test.local'),
('00000000-0000-0000-0000-000000000972','document-driver@test.local');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000971','Documents LLC','Documents','00000000-0000-0000-0000-000000000971');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000971','00000000-0000-0000-0000-000000000971','owner'),
('10000000-0000-0000-0000-000000000971','00000000-0000-0000-0000-000000000972','driver');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000971';
select public.save_invoice('10000000-0000-0000-0000-000000000971',null,'Customer',current_date,current_date+30,'sent','Thanks','[{"description":"Freight","quantity":2,"unitPrice":100,"taxRate":0.05}]','90000000-0000-0000-0000-000000000971');
select is((public.invoice_document('10000000-0000-0000-0000-000000000971',(select id from public.invoices where company_id='10000000-0000-0000-0000-000000000971'))->>'total')::numeric,210::numeric,'document uses authoritative totals');
select is(jsonb_array_length(public.invoice_document('10000000-0000-0000-0000-000000000971',(select id from public.invoices where company_id='10000000-0000-0000-0000-000000000971'))->'items'),1,'document includes line items');
select ok(not has_table_privilege('authenticated','public.company_email_settings','select'),'clients cannot read sender credentials');
select ok(not has_table_privilege('authenticated','public.invoice_email_payloads','select'),'clients cannot read snapshots');
select ok(not has_table_privilege('authenticated','public.invoice_email_deliveries','insert'),'clients cannot forge delivery history');
select ok(not has_function_privilege('authenticated','public.claim_invoice_email(uuid)','execute'),'clients cannot claim email jobs');
select ok(not has_function_privilege('anon','public.invoice_document(uuid,uuid)','execute'),'anonymous cannot read documents');
select ok(not has_function_privilege('authenticated','public.prepare_invoice_email(uuid,uuid,uuid,text,text,text,uuid,jsonb)','execute'),'clients cannot prepare arbitrary messages');
reset role;
select public.prepare_invoice_email('90000000-0000-0000-0000-000000000972','10000000-0000-0000-0000-000000000971',(select id from public.invoices where company_id='10000000-0000-0000-0000-000000000971'),'customer@example.com','sender@example.com','Invoice','00000000-0000-0000-0000-000000000971','{"snapshot":"first"}');
select public.prepare_invoice_email('90000000-0000-0000-0000-000000000972','10000000-0000-0000-0000-000000000971',(select id from public.invoices where company_id='10000000-0000-0000-0000-000000000971'),'customer@example.com','sender@example.com','Invoice','00000000-0000-0000-0000-000000000971','{"snapshot":"changed"}');
select is((select payload->>'snapshot' from public.invoice_email_payloads where delivery_id='90000000-0000-0000-0000-000000000972'),'first','retry preserves original payload');
select throws_ok($$select public.prepare_invoice_email('90000000-0000-0000-0000-000000000972','10000000-0000-0000-0000-000000000971',(select id from public.invoices where company_id='10000000-0000-0000-0000-000000000971'),'different@example.com','sender@example.com','Invoice','00000000-0000-0000-0000-000000000971','{}')$$,'P0001','Delivery reference was already used with different details','retry cannot change recipient');
select ok(public.claim_invoice_email('90000000-0000-0000-0000-000000000972'),'first worker claims attempt');
select ok(not public.claim_invoice_email('90000000-0000-0000-0000-000000000972'),'second worker cannot claim leased attempt');
update public.invoice_email_deliveries set lease_until=now()-interval '1 minute' where id='90000000-0000-0000-0000-000000000972';
select ok(public.claim_invoice_email('90000000-0000-0000-0000-000000000972'),'expired worker lease can be retried');
update public.invoice_email_deliveries set status='accepted',lease_until=null where id='90000000-0000-0000-0000-000000000972';
select ok(not public.claim_invoice_email('90000000-0000-0000-0000-000000000972'),'accepted attempt cannot send again');
update public.invoice_email_deliveries set status='unknown',first_attempt_at=now()-interval '24 hours' where id='90000000-0000-0000-0000-000000000972';
select ok(not public.claim_invoice_email('90000000-0000-0000-0000-000000000972'),'old unknown attempt cannot escape provider idempotency window');
set local role authenticated;
select is((select count(*) from public.invoice_email_deliveries where company_id='10000000-0000-0000-0000-000000000971'),1::bigint,'finance owner can read delivery history');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000972';
select is((select count(*) from public.invoice_email_deliveries where company_id='10000000-0000-0000-0000-000000000971'),0::bigint,'driver cannot read delivery history');
select throws_ok($$select public.invoice_document('10000000-0000-0000-0000-000000000971','90000000-0000-0000-0000-000000000971')$$,'P0001','Finance access required','driver cannot obtain a document');
reset role;
update public.company_memberships set is_active=false where user_id='00000000-0000-0000-0000-000000000971' and company_id='10000000-0000-0000-0000-000000000971';
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000971';
select is((select count(*) from public.invoice_email_deliveries where company_id='10000000-0000-0000-0000-000000000971'),0::bigint,'inactive member loses history access');
select * from finish();
rollback;
