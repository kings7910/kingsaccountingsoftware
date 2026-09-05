begin;select plan(6);
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000101','authenticated','authenticated','settings-owner@test.local','','{}','{"full_name":"Settings Owner"}'),
('00000000-0000-0000-0000-000000000102','authenticated','authenticated','settings-driver@test.local','','{}','{"full_name":"Settings Driver"}');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000101','Old LLC','Old','00000000-0000-0000-0000-000000000101');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101','owner'),
('10000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000102','driver');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000101';
select lives_ok($$select public.save_company_settings('10000000-0000-0000-0000-000000000101','Kings Transport LLC','Kings Transport','America/New_York','USD','{"fiscalYearStart":1,"defaultPaymentTerms":30,"mileageRate":0.67,"receiptApprovalThreshold":250,"invoicePrefix":"INV","loadPrefix":"LD","emailOverdueInvoices":true}')$$,'owner saves company settings');
select is((select legal_name from public.companies where id='10000000-0000-0000-0000-000000000101'),'Kings Transport LLC','legal name persisted');
select is((select settings->>'invoicePrefix' from public.companies where id='10000000-0000-0000-0000-000000000101'),'INV','settings document persisted');
select throws_ok($$select public.save_company_settings('10000000-0000-0000-0000-000000000101','Kings','Kings','America/New_York','USD','{"fiscalYearStart":13,"defaultPaymentTerms":30,"mileageRate":0.67,"receiptApprovalThreshold":250,"invoicePrefix":"INV","loadPrefix":"LD"}')$$,'P0001','Invalid company settings','invalid fiscal month rejected');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000102';
select throws_ok($$select public.save_company_settings('10000000-0000-0000-0000-000000000101','Hacked','Hacked','UTC','USD','{"fiscalYearStart":1,"defaultPaymentTerms":30,"mileageRate":0.67,"receiptApprovalThreshold":250,"invoicePrefix":"INV","loadPrefix":"LD"}')$$,'P0001','Settings administration access required','driver cannot change settings');
select is((select legal_name from public.companies where id='10000000-0000-0000-0000-000000000101'),'Kings Transport LLC','unauthorized attempt made no change');
select * from finish();rollback;
