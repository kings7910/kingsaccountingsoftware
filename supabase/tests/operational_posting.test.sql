begin;
select no_plan();
insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000000951','operations-owner@test.local'),
('00000000-0000-0000-0000-000000000952','operations-fleet@test.local'),
('00000000-0000-0000-0000-000000000953','operations-outsider@test.local');
insert into public.companies(id,legal_name,display_name,created_by) values('10000000-0000-0000-0000-000000000951','Operations','Operations','00000000-0000-0000-0000-000000000951');
insert into public.company_memberships(company_id,user_id,role) values
('10000000-0000-0000-0000-000000000951','00000000-0000-0000-0000-000000000951','owner'),
('10000000-0000-0000-0000-000000000951','00000000-0000-0000-0000-000000000952','fleet_manager');
insert into public.trucks(id,company_id,unit_number) values('20000000-0000-0000-0000-000000000951','10000000-0000-0000-0000-000000000951','OP-1');
insert into public.customers(id,company_id,name) values('30000000-0000-0000-0000-000000000951','10000000-0000-0000-0000-000000000951','Freight customer');
insert into public.loads(id,company_id,load_number,customer_id,status,customer_rate,fuel_surcharge) values
('40000000-0000-0000-0000-000000000951','10000000-0000-0000-0000-000000000951','OP-L1','30000000-0000-0000-0000-000000000951','delivered',1000,125),
('40000000-0000-0000-0000-000000000952','10000000-0000-0000-0000-000000000951','OP-L2','30000000-0000-0000-0000-000000000951','planned',2000,0);
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000951';
select public.manage_ledger_account('10000000-0000-0000-0000-000000000951',null,'1000','Cash','asset',true);
select public.save_fuel_entry('10000000-0000-0000-0000-000000000951',null,current_date,'OP-1','Test fuel','Dallas','TX',20,75,1000,'OP-F1');
select public.save_work_order('10000000-0000-0000-0000-000000000951',null,'OP-W1','OP-1','Repair','New tire','Tire vendor',current_date,1000,200,225,'completed',current_date);
select lives_ok($$select public.post_operational_cost('10000000-0000-0000-0000-000000000951','fuel',(select id from public.fuel_entries where provider_transaction_id='OP-F1'),'expense',current_date,null,(select id from public.chart_of_accounts where company_id='10000000-0000-0000-0000-000000000951' and account_number='1000'))$$,'fuel posts paid expense');
select lives_ok($$select public.post_operational_cost('10000000-0000-0000-0000-000000000951','fuel',(select id from public.fuel_entries where provider_transaction_id='OP-F1'),'expense',current_date,null,(select id from public.chart_of_accounts where company_id='10000000-0000-0000-0000-000000000951' and account_number='1000'))$$,'fuel retry succeeds');
select is((select count(*) from public.expenses where company_id='10000000-0000-0000-0000-000000000951'),1::bigint,'fuel retry creates one expense');
select throws_ok($$select public.post_operational_cost('10000000-0000-0000-0000-000000000951','fuel',(select id from public.fuel_entries where provider_transaction_id='OP-F1'),'bill',current_date,current_date,null)$$,'P0001','Source already posted with different accounting details','fuel cannot also become a bill');
select lives_ok($$select public.post_operational_cost('10000000-0000-0000-0000-000000000951','maintenance',(select id from public.work_orders where details->>'reference'='OP-W1'),'bill',current_date,current_date+30,null)$$,'completed maintenance posts unpaid bill');
select lives_ok($$select public.post_operational_cost('10000000-0000-0000-0000-000000000951','maintenance',(select id from public.work_orders where details->>'reference'='OP-W1'),'bill',current_date,current_date+30,null)$$,'maintenance retry succeeds');
select is((select count(*) from public.vendor_bills where company_id='10000000-0000-0000-0000-000000000951'),1::bigint,'one maintenance bill');
select is((select sum(debit-credit) from public.journal_lines where company_id='10000000-0000-0000-0000-000000000951'),0::numeric,'operational cost journals balance');
select is((select sum(credit-debit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where l.company_id='10000000-0000-0000-0000-000000000951' and a.account_number='2000'),225::numeric,'unpaid maintenance credits payable');
select is((select count(*) from public.audit_logs where company_id='10000000-0000-0000-0000-000000000951' and record_type='operational_cost_links'),2::bigint,'source links audited');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000952';
select throws_ok($$update public.fuel_entries set total_cost=90 where provider_transaction_id='OP-F1'$$,'P0001','Posted operational costs cannot be edited or deleted; use an accounting correction','fleet cannot edit posted fuel');
select throws_ok($$update public.work_orders set details='{}' where details->>'reference'='OP-W1'$$,'P0001','Posted operational costs cannot be edited or deleted; use an accounting correction','fleet cannot edit posted maintenance');
select throws_ok($$select public.issue_load_invoice('10000000-0000-0000-0000-000000000951','40000000-0000-0000-0000-000000000951',current_date,current_date+30)$$,'P0001','Finance access required','fleet cannot issue invoices');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000951';
select throws_ok($$delete from public.fuel_entries where provider_transaction_id='OP-F1'$$,'P0001','Posted operational costs cannot be edited or deleted; use an accounting correction','owner cannot delete posted fuel');
select lives_ok($$select public.issue_load_invoice('10000000-0000-0000-0000-000000000951','40000000-0000-0000-0000-000000000951',current_date,current_date+30)$$,'delivered load invoice issues');
select lives_ok($$select public.issue_load_invoice('10000000-0000-0000-0000-000000000951','40000000-0000-0000-0000-000000000951',current_date,current_date+30)$$,'invoice retry succeeds');
select is((select count(*) from public.invoices where load_id='40000000-0000-0000-0000-000000000951'),1::bigint,'one invoice per load');
select is((select total from public.invoices where load_id='40000000-0000-0000-0000-000000000951'),1125::numeric,'invoice includes fuel surcharge');
select is((select sum(debit-credit) from public.journal_lines l join public.chart_of_accounts a on a.id=l.account_id where l.company_id='10000000-0000-0000-0000-000000000951' and a.account_number='1100'),1125::numeric,'load invoice debits receivables');
select throws_ok($$update public.loads set customer_rate=2000 where id='40000000-0000-0000-0000-000000000951'$$,'P0001','Invoiced load billing details cannot be changed','invoiced freight charges immutable');
select throws_ok($$select public.issue_load_invoice('10000000-0000-0000-0000-000000000951','40000000-0000-0000-0000-000000000952',current_date,current_date+30)$$,'P0001','A delivered load with a customer is required','undelivered load rejected');
select throws_ok($$select public.issue_load_invoice('10000000-0000-0000-0000-000000000951','40000000-0000-0000-0000-000000000951',current_date,current_date+31)$$,'P0001','Load already has an invoice; open it in Invoices','changed invoice retry rejected');
select public.save_fuel_entry('10000000-0000-0000-0000-000000000951',null,current_date-2,'OP-1','Test fuel','Dallas','TX',20,80,1000,'OP-F2');
select public.set_accounting_period_closed('10000000-0000-0000-0000-000000000951',current_date-5,current_date-1,true);
select throws_ok($$select public.post_operational_cost('10000000-0000-0000-0000-000000000951','fuel',(select id from public.fuel_entries where provider_transaction_id='OP-F2'),'bill',current_date-2,current_date,null)$$,'P0001','Accounting period is closed','closed period rejects cost');
select is((select count(*) from public.vendor_bills where company_id='10000000-0000-0000-0000-000000000951'),1::bigint,'closed period failure rolls back bill');
select is((select count(*) from public.operational_cost_links where company_id='10000000-0000-0000-0000-000000000951'),2::bigint,'closed period failure leaves no source link');
select throws_ok($$delete from public.operational_cost_links where company_id='10000000-0000-0000-0000-000000000951'$$,'42501','permission denied for table operational_cost_links','source links cannot be deleted');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000953';
select is((select count(*) from public.operational_cost_links),0::bigint,'outsider cannot read links');
select throws_ok($$select public.post_operational_cost('10000000-0000-0000-0000-000000000951','fuel','20000000-0000-0000-0000-000000000951','expense',current_date,null,null)$$,'P0001','Finance access required','outsider cannot post costs');
select ok(not has_function_privilege('anon','public.issue_load_invoice(uuid,uuid,date,date)','execute'),'anonymous invoice RPC denied');
select ok(not has_function_privilege('anon','public.post_operational_cost(uuid,text,uuid,text,date,date,uuid)','execute'),'anonymous cost RPC denied');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000951';
select throws_ok($$select public.post_operational_cost('10000000-0000-0000-0000-000000000951','fuel',(select id from public.fuel_entries where provider_transaction_id='OP-F2'),'expense',current_date,null,(select id from public.chart_of_accounts where company_id='10000000-0000-0000-0000-000000000951' and account_number='1100'))$$,'P0001','Choose an active cash or bank asset account','receivable control is not a cash account');
update public.loads set status='delivered' where id='40000000-0000-0000-0000-000000000952';
select throws_ok($$select public.issue_load_invoice('10000000-0000-0000-0000-000000000951','40000000-0000-0000-0000-000000000952',current_date-2,current_date)$$,'P0001','Accounting period is closed','closed period rejects load invoice atomically');
select is((select count(*) from public.invoices where load_id='40000000-0000-0000-0000-000000000952'),0::bigint,'failed issue leaves no draft or invoice items');
select throws_ok($$insert into public.invoices(company_id,customer_id,load_id,issued_on,due_on,subtotal,created_by) values('10000000-0000-0000-0000-000000000951','30000000-0000-0000-0000-000000000951','40000000-0000-0000-0000-000000000952',current_date,current_date,1999,auth.uid())$$,'P0001','Invoice must match the load customer and freight charges','direct mismatched load invoice rejected');
insert into public.invoices(company_id,customer_id,load_id,issued_on,due_on,subtotal,created_by) values('10000000-0000-0000-0000-000000000951','30000000-0000-0000-0000-000000000951','40000000-0000-0000-0000-000000000952',current_date,current_date,2000,auth.uid());
select throws_ok($$insert into public.invoices(company_id,customer_id,load_id,issued_on,due_on,subtotal,created_by) values('10000000-0000-0000-0000-000000000951','30000000-0000-0000-0000-000000000951','40000000-0000-0000-0000-000000000952',current_date,current_date,2000,auth.uid())$$,'P0001','Load already has an invoice','direct duplicate load invoice rejected');
select throws_ok($$update public.invoices set subtotal=1999 where load_id='40000000-0000-0000-0000-000000000952'$$,'P0001','Invoice must match the load customer and freight charges','draft cannot be changed to evade load amount check');
select throws_ok($$update public.invoices set load_id=null where load_id='40000000-0000-0000-0000-000000000952'$$,'P0001','Invoice load links cannot be changed','draft cannot detach source link');
select * from finish();
rollback;
