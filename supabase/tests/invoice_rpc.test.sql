begin;
select plan(10);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000011','authenticated','authenticated','invoice-owner@test.local','','{}','{}'),
 ('00000000-0000-0000-0000-000000000012','authenticated','authenticated','invoice-driver@test.local','','{}','{}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000011','Invoice Test LLC','Invoice Test','00000000-0000-0000-0000-000000000011');
insert into public.company_memberships(company_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000011','owner'),
 ('10000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012','driver');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000011';
select lives_ok($$select * from public.save_invoice('10000000-0000-0000-0000-000000000011',null,'BlueLine','2026-09-01','2026-10-01','sent','POD attached','[{"description":"Freight","quantity":2,"unitPrice":1000,"taxRate":0.05}]')$$,'owner creates an invoice atomically');
select is((select count(*) from public.invoices where company_id='10000000-0000-0000-0000-000000000011'),1::bigint,'invoice header created');
select is((select total from public.invoices where company_id='10000000-0000-0000-0000-000000000011'),2100.00::numeric,'invoice total includes tax');
select is((select count(*) from public.invoice_items where company_id='10000000-0000-0000-0000-000000000011'),1::bigint,'invoice lines created');
select lives_ok($$select * from public.save_invoice('10000000-0000-0000-0000-000000000011',(select id from public.invoices where company_id='10000000-0000-0000-0000-000000000011'),'BlueLine','2026-09-01','2026-10-01','paid','Received today','[{"description":"Freight","quantity":2,"unitPrice":1000,"taxRate":0.05}]')$$,'marking invoice paid completes with its lines');
select is((select amount from public.payments where company_id='10000000-0000-0000-0000-000000000011' and received_on=current_date),2100.00::numeric,'dated payment recorded for full balance');
select throws_ok($$update public.invoice_items set quantity=3 where company_id='10000000-0000-0000-0000-000000000011'$$,'P0001','Paid invoice lines require a credit note or adjustment','paid invoice lines are immutable');
select throws_ok($$delete from public.invoices where company_id='10000000-0000-0000-0000-000000000011'$$,'P0001','Paid invoices require a credit note or adjustment','paid invoice cannot be deleted directly');
select throws_ok($$select * from public.save_invoice('10000000-0000-0000-0000-000000000011',(select id from public.invoices where company_id='10000000-0000-0000-0000-000000000011'),'BlueLine','2026-09-01','2026-10-01','draft','','[{"description":"Changed","quantity":1,"unitPrice":1,"taxRate":0}]')$$,'P0001','Paid invoices require a credit note or adjustment','save RPC cannot reopen or edit a paid invoice');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000012';
select throws_ok($$select * from public.save_invoice('10000000-0000-0000-0000-000000000011',null,'Denied','2026-09-01','2026-10-01','draft','','[{"description":"Freight","quantity":1,"unitPrice":1,"taxRate":0}]')$$,'P0001','Finance access required','driver cannot create invoices');
select * from finish();
rollback;
