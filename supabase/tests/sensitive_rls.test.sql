begin;
select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@test.local', '', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'driver1@test.local', '', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'driver2@test.local', '', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'accountant@test.local', '', '{}', '{}');

insert into public.companies (id, legal_name, display_name, created_by)
values ('10000000-0000-0000-0000-000000000001', 'Security Test LLC', 'Security Test', '00000000-0000-0000-0000-000000000001');

insert into public.company_memberships (company_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'driver'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'driver'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'accountant');

insert into public.drivers (id, company_id, profile_id, employee_number)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'D1'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'D2');

insert into public.bank_connections (company_id, provider, provider_item_id, access_token_ciphertext)
values ('10000000-0000-0000-0000-000000000001', 'test', 'test-item', 'secret');

insert into public.loads (company_id, load_number, driver_id)
values
  ('10000000-0000-0000-0000-000000000001', 'OWN-LOAD', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', 'OTHER-LOAD', '20000000-0000-0000-0000-000000000002');

insert into public.driver_settlements (company_id, driver_id, gross_pay)
values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1000),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 1200);

insert into public.audit_logs (company_id, actor_id, action, record_type)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'test', 'test');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

select is((select count(*) from public.bank_connections), 0::bigint,
  'drivers cannot read bank connections');
select is((select count(*) from public.loads), 1::bigint,
  'drivers see only their assigned loads');
select is((select load_number from public.loads), 'OWN-LOAD',
  'the visible load belongs to the current driver');
select is((select count(*) from public.drivers), 1::bigint,
  'drivers cannot read other driver identity records');
select is((select count(*) from public.driver_settlements), 1::bigint,
  'drivers see only their own settlement');
select is((select count(*) from public.audit_logs), 0::bigint,
  'drivers cannot read audit history');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select is((select count(*) from public.bank_connections), 1::bigint,
  'accountants can read company bank connections');
select is((select count(*) from public.audit_logs), 0::bigint,
  'accountants cannot read audit history');

select * from finish();
rollback;
