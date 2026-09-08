import {test,expect,Page} from "@playwright/test";
import {createClient} from "@supabase/supabase-js";
import {readFileSync} from "node:fs";
const local=JSON.parse(readFileSync(process.env.KINGS_TEST_CONFIG!,"utf8"));
const admin=createClient(local.API_URL,local.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const password="Local-test-only-48!";
async function login(page:Page,email:string){
 await page.goto("/login");
 await page.getByLabel("Email address").fill(email);
 await page.getByLabel("Password",{exact:true}).fill(password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();
}
async function createUser(name:string){
 const email=`${name.toLowerCase().replaceAll(" ","-")}-${crypto.randomUUID()}@test.local`;
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
 if(error)throw error;return{id:data.user!.id,email};
}
async function insert(table:string,values:Record<string,unknown>){const {data,error}=await admin.from(table).insert(values).select("*").single();if(error)throw error;return data;}
async function expectNamedButtons(page:Page){
 const unnamed=await page.locator("button:visible").evaluateAll(buttons=>buttons.filter(button=>!button.getAttribute("aria-label")&&!button.getAttribute("title")&&!button.textContent?.trim()).map(button=>button.outerHTML.slice(0,180)));
 expect(unnamed).toEqual([]);
}

test("protected workspace redirects unsigned users",async({page})=>{
 await page.goto("/workspace");await expect(page).toHaveURL(/\/login/);
});

test("demo navigation, quick actions, forms, and links are operable",async({page})=>{
 await page.goto("/");
 const nav=page.getByRole("navigation",{name:"Primary navigation"});
 await expectNamedButtons(page);
 await page.getByLabel("Search modules").fill("maint");
 await page.getByLabel("Search modules").press("Enter");
 await expect(page.getByRole("heading",{name:"Maintenance"})).toBeVisible();
 await page.getByRole("button",{name:"Notifications"}).click();
 await expect(page.getByRole("heading",{name:"Notifications"})).toBeVisible();
 await page.getByRole("button",{name:"Quick add"}).click();
 await page.getByRole("button",{name:"Transaction",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Add transaction"})).toBeVisible();
 await page.getByRole("button",{name:"Cancel",exact:true}).click();

 const forms:[string,string,string][]=[
  ["Transactions","Add transaction","Cancel"],["Invoices","New invoice","Cancel"],
  ["Bills & payables","New vendor bill","Cancel"],["Loads & routes","Create load","Cancel"],
  ["Fleet","Add vehicle","Cancel"],["Fuel & mileage","Record fuel","Cancel"],
  ["Maintenance","New work order","Cancel"],["Payroll","Start pay run","Cancel"],
  ["Accounting","Journal entry","Close journal form"],["Team & roles","Invite person","Cancel"],
 ];
 for(const [moduleName,action,close] of forms){
  await nav.getByRole("button",{name:moduleName,exact:true}).click();
  await page.getByRole("button",{name:action,exact:true}).click();
  await expect(page.locator("form").last()).toBeVisible();
  await expectNamedButtons(page);
  await page.getByRole("button",{name:close,exact:true}).click();
 }
 await nav.getByRole("button",{name:"Approvals",exact:true}).click();
 await page.getByRole("button",{name:"Review next",exact:true}).click();
 await expect(page.getByRole("button",{name:"Close approval review"})).toBeVisible();
 await page.getByRole("button",{name:"Close approval review"}).click();
 await nav.getByRole("button",{name:"Reports",exact:true}).click();
 await page.getByRole("button",{name:"View reports",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Profit & loss"})).toBeVisible();
 await nav.getByRole("button",{name:"Settings",exact:true}).click();
 await page.getByRole("button",{name:"Save changes",exact:true}).first().click();
 await expect(page.getByText("Settings saved successfully.")).toBeVisible();
 await page.getByText("Kendra Williams",{exact:true}).click();
 await expect(page.getByRole("link",{name:"Sign in to workspace"})).toHaveAttribute("href","/login");
 await expectNamedButtons(page);
});

test("dispatcher and fleet manager controls match their server permissions",async({browser})=>{
 const dispatcher=await createUser("Role Dispatcher"),fleetManager=await createUser("Role Fleet Manager");
 const company=await insert("companies",{legal_name:"Role Matrix Test",display_name:"Role Matrix Test",created_by:dispatcher.id});
 await insert("company_memberships",{company_id:company.id,user_id:dispatcher.id,role:"dispatcher"});
 await insert("company_memberships",{company_id:company.id,user_id:fleetManager.id,role:"fleet_manager"});

 const dispatchContext=await browser.newContext(),dispatchPage=await dispatchContext.newPage();
 await login(dispatchPage,dispatcher.email);await expect(dispatchPage).toHaveURL(/\/workspace/);
 const dispatchNav=dispatchPage.getByRole("navigation",{name:"Primary navigation"});
 await expect(dispatchNav.getByRole("button")).toHaveText(["Overview","Loads & routes","Approvals","AI assistant"]);
 await dispatchNav.getByRole("button",{name:"Loads & routes",exact:true}).click();
 await expect(dispatchPage.getByRole("heading",{name:"Loads & routes"})).toBeVisible();
 await expect(dispatchPage.getByRole("main").getByRole("alert")).toHaveCount(0);
 await dispatchContext.close();

 const fleetContext=await browser.newContext(),fleetPage=await fleetContext.newPage();
 await login(fleetPage,fleetManager.email);await expect(fleetPage).toHaveURL(/\/workspace/);
 const fleetNav=fleetPage.getByRole("navigation",{name:"Primary navigation"});
 await expect(fleetNav.getByRole("button")).toHaveText(["Overview","Fleet","Fuel & mileage","Maintenance","Approvals","AI assistant"]);
 await fleetNav.getByRole("button",{name:"Fleet",exact:true}).click();
 await fleetPage.getByRole("button",{name:"Add vehicle",exact:true}).click();
 await fleetPage.getByLabel("Unit number").fill("FM-101");
 await fleetPage.getByLabel("Make",{exact:true}).fill("Freightliner");
 await fleetPage.getByLabel("Model",{exact:true}).fill("Cascadia");
 await fleetPage.getByRole("button",{name:"Save vehicle",exact:true}).click();
 await expect(fleetPage.getByRole("heading",{name:"Truck FM-101"})).toBeVisible();
 await expect(fleetPage.getByRole("button",{name:"Edit Truck FM-101"})).toBeVisible();
 await expect(fleetPage.getByRole("button",{name:"Delete Truck FM-101"})).toHaveCount(0);
 await expect(fleetPage.getByRole("main").getByRole("alert")).toHaveCount(0);
 await fleetContext.close();
});

test("owner onboarding, live modules, journal posting and ledger reports",async({page})=>{
 const owner=await createUser("Release Owner");
 await login(page,owner.email);
 await expect(page).toHaveURL(/\/onboarding/);
 await page.getByLabel("Company display name").fill("Release Verification Transport");
 await page.getByRole("button",{name:"Create workspace"}).click();
 await expect(page).toHaveURL(/\/workspace/);
 const nav=page.getByRole("navigation",{name:"Primary navigation"});
 for(const moduleName of ["Transactions","Invoices","Bills & payables","Loads & routes","Fleet","Fuel & mileage","Maintenance","Payroll","Accounting","Reports","Approvals","Team & roles","Audit log","Settings"]){
  const loaded=page.waitForResponse(response=>response.request().method()==="POST"&&response.url().endsWith("/workspace"));
  await nav.getByRole("button",{name:moduleName,exact:true}).click();
  await loaded;
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
 }
 await nav.getByRole("button",{name:"Accounting",exact:true}).click();
 await page.getByRole("button",{name:"Journal entry",exact:true}).click();
 await page.getByLabel("Number",{exact:true}).fill("JE-9001");
 await page.getByLabel("Memo",{exact:true}).fill("Release test capital");
 const form=page.locator("form").last();
 await form.locator("select").nth(0).selectOption({label:"1000 · Cash"});
 await form.locator("select").nth(1).selectOption({label:"3000 · Owner’s equity"});
 await form.getByPlaceholder("Debit",{exact:true}).nth(0).fill("250");
 await form.getByPlaceholder("Credit",{exact:true}).nth(1).fill("250");
 await form.getByRole("button",{name:"Post entry",exact:true}).click();
 await expect(page.getByText("Release test capital",{exact:true})).toBeVisible();
 await page.reload();
 await nav.getByRole("button",{name:"Accounting",exact:true}).click();
 await expect(page.getByText("Release test capital",{exact:true})).toBeVisible();
 await nav.getByRole("button",{name:"Bills & payables",exact:true}).click();
 await page.getByRole("button",{name:"New vendor bill",exact:true}).click();
 await page.getByLabel("Vendor",{exact:true}).fill("Release Repair Shop");
 await page.getByLabel("Bill number",{exact:true}).fill("RRS-9001");
 await page.getByLabel("Amount",{exact:true}).fill("640");
 await page.getByLabel("Issue date",{exact:true}).fill("2026-07-01");
 await page.getByLabel("Due date",{exact:true}).fill("2026-07-31");
 await page.getByLabel("Description",{exact:true}).fill("Release verification bill");
 await page.getByRole("button",{name:"Save bill",exact:true}).click();
 await expect(page.getByText("RRS-9001",{exact:false})).toBeVisible();
 await expect(page.getByText(/Posted JE-/)).toBeVisible();
 await nav.getByRole("button",{name:"Accounting",exact:true}).click();
 await expect(page.getByText(/Vendor bill RRS-9001/)).toBeVisible();
 await nav.getByRole("button",{name:"Reports",exact:true}).click();
 await page.getByRole("button",{name:/A\/P aging/}).click();
 await expect(page.getByRole("row").filter({hasText:"61+ days"})).toContainText("$640.00");
 await expect(page.getByRole("row").filter({hasText:"Reconciliation difference"})).toContainText("$0.00");
 await page.getByRole("button",{name:"All reports",exact:true}).click();
 await page.getByRole("button",{name:/Balance sheet/}).click();
 await expect(page.getByRole("row").filter({hasText:"Total assets"})).toContainText("$250.00");
 await expect(page.getByRole("row").filter({hasText:"Liabilities and equity"})).toContainText("$250.00");
 const download=page.waitForEvent("download");
 await page.getByRole("button",{name:"Export CSV"}).click();
 expect((await download).suggestedFilename()).toMatch(/^balance-sheet-/);
 await page.route("**/workspace",route=>route.request().method()==="POST"?route.abort():route.continue());
 await page.getByLabel("Report period").selectOption({index:1});
 await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
 await expect(page.getByRole("button",{name:"Export CSV"})).toHaveCount(0);
 await page.unroute("**/workspace");
 await page.getByRole("button",{name:"Retry",exact:true}).click();
 await expect(page.getByRole("button",{name:"Export CSV"})).toBeVisible();
 await nav.getByRole("button",{name:"Bills & payables",exact:true}).click();
 page.once("dialog",dialog=>dialog.accept());
 await page.getByRole("button",{name:"Void RRS-9001",exact:true}).click();
 await expect(page.locator(".card").filter({hasText:"RRS-9001"}).getByText("Void",{exact:true})).toBeVisible();
 await nav.getByRole("button",{name:"Accounting",exact:true}).click();
 await expect(page.getByText("Void vendor bill RRS-9001",{exact:true})).toBeVisible();
 await nav.getByRole("button",{name:"Bills & payables",exact:true}).click();
 await page.getByRole("button",{name:"New vendor bill",exact:true}).click();
 await page.getByLabel("Vendor",{exact:true}).fill("Adjustment Parts Vendor");
 await page.getByLabel("Bill number",{exact:true}).fill("APV-9002");
 await page.getByLabel("Amount",{exact:true}).fill("100");
 await page.getByLabel("Issue date",{exact:true}).fill("2026-09-01");
 await page.getByLabel("Due date",{exact:true}).fill("2026-09-30");
 await page.locator("form").last().getByRole("combobox",{name:"Status",exact:true}).selectOption("Paid");
 await page.getByLabel("Description",{exact:true}).fill("Adjustment verification bill");
 await page.getByRole("button",{name:"Save bill",exact:true}).click();
 await page.getByRole("button",{name:"Adjust APV-9002",exact:true}).click();
 await page.getByLabel("Amount",{exact:true}).fill("25");
 await page.getByLabel("Reason",{exact:true}).fill("Returned parts");
 await page.getByRole("button",{name:"Post adjustment",exact:true}).click();
 await expect(page.getByText("$25.00 credit",{exact:true})).toBeVisible();
 await nav.getByRole("button",{name:"Reports",exact:true}).click();
 await page.getByRole("button",{name:/A\/P aging/}).click();
 await expect(page.getByRole("row").filter({hasText:"Vendor credits"})).toContainText("-$25.00");
 await expect(page.getByRole("row").filter({hasText:"Reconciliation difference"})).toContainText("$0.00");
 await nav.getByRole("button",{name:"Bills & payables",exact:true}).click();
 await page.getByRole("button",{name:"Adjust APV-9002",exact:true}).click();
 const debitForm=page.locator("form").last();
 await debitForm.locator("select").selectOption("Debit");
 await debitForm.getByLabel("Amount",{exact:true}).fill("40");
 await debitForm.getByLabel("Reason",{exact:true}).fill("Replacement surcharge");
 await debitForm.getByRole("button",{name:"Post adjustment",exact:true}).click();
 const adjustedBill=page.locator(".card").filter({hasText:"APV-9002"});
 await expect(adjustedBill.getByText("Open",{exact:true})).toBeVisible();
 await expect(adjustedBill.getByText("$15.00",{exact:true})).toBeVisible();
 await nav.getByRole("button",{name:"Reports",exact:true}).click();
 await page.getByRole("button",{name:/A\/P aging/}).click();
 await expect(page.getByRole("row",{name:/^Current /})).toContainText("$15.00");
 await expect(page.getByRole("row").filter({hasText:"Reconciliation difference"})).toContainText("$0.00");
});

test("driver offline fuel synchronizes once and owner approval updates the source",async({page,context,browser})=>{
 const owner=await createUser("Queue Owner"),driverUser=await createUser("Queue Driver");
 const company=await insert("companies",{legal_name:"Queue Test",display_name:"Queue Test",created_by:owner.id});
 await insert("company_memberships",{company_id:company.id,user_id:owner.id,role:"owner"});
 await insert("company_memberships",{company_id:company.id,user_id:driverUser.id,role:"driver"});
 const driver=await insert("drivers",{company_id:company.id,profile_id:driverUser.id});
 const truck=await insert("trucks",{company_id:company.id,unit_number:"E2E-01"});
 const load=await insert("loads",{company_id:company.id,load_number:"E2E-LOAD",driver_id:driver.id,truck_id:truck.id,status:"dispatched"});
 await page.setViewportSize({width:390,height:844});
 await login(page,driverUser.email);await expect(page).toHaveURL(/\/driver/);
 await expect(page.getByText(/ACTIVE LOAD · E2E-LOAD/)).toBeVisible();
 await page.getByRole("button",{name:"Fuel",exact:true}).click();
 await context.setOffline(true);
 await page.getByLabel("Vendor",{exact:true}).fill("Queue Fuel Stop");
 await page.getByLabel("Gallons",{exact:true}).fill("20");
 await page.getByLabel("Total cost",{exact:true}).fill("80");
 await page.getByLabel("Odometer",{exact:true}).fill("500");
 await page.getByRole("button",{name:"Submit fuel entry"}).click();
 await expect(page.getByRole("heading",{name:"Saved submissions"})).toBeVisible();
 await context.setOffline(false);
 await expect(page.getByRole("heading",{name:"Saved submissions"})).toHaveCount(0);
 await expect.poll(async()=>{const {count,error}=await admin.from("fuel_entries").select("id",{count:"exact",head:true}).eq("load_id",load.id);if(error)throw error;return count}).toBe(1);
 const office=await browser.newContext({viewport:{width:1440,height:1000}}),officePage=await office.newPage();
 await login(officePage,owner.email);await expect(officePage).toHaveURL(/\/workspace/);
 await officePage.getByRole("navigation",{name:"Primary navigation"}).getByRole("button",{name:"Approvals",exact:true}).click();
 await officePage.getByRole("button",{name:/Fuel entry awaiting review/}).click();
 await officePage.getByLabel("Reviewer note").fill("Browser workflow verified");
 await officePage.getByRole("button",{name:"Approve",exact:true}).click();
 await expect(officePage.getByLabel("Reviewer note")).toHaveCount(0);
 await office.close();
 const {data:fuel}=await admin.from("fuel_entries").select("status").eq("load_id",load.id).single();
 expect(fuel?.status).toBe("approved");
});

test("owner imports, matches, and locks a bank statement reconciliation",async({page})=>{
 const owner=await createUser("Bank Reconciliation Owner");
 const company=await insert("companies",{legal_name:"Bank Browser Test",display_name:"Bank Browser Test",created_by:owner.id});
 await insert("company_memberships",{company_id:company.id,user_id:owner.id,role:"owner"});
 const cash=await insert("chart_of_accounts",{company_id:company.id,account_number:"1000",name:"Operating cash",account_type:"asset"});
 const equity=await insert("chart_of_accounts",{company_id:company.id,account_number:"3000",name:"Opening equity",account_type:"equity"});
 const fuel=await insert("chart_of_accounts",{company_id:company.id,account_number:"5000",name:"Fuel expense",account_type:"expense"});
 async function postedJournal(number:number,date:string,memo:string,lines:{account_id:string;debit:number;credit:number;description:string}[]){
  const journal=await insert("journal_entries",{company_id:company.id,entry_number:number,entry_date:date,memo,status:"draft",created_by:owner.id});
  const{error:lineError}=await admin.from("journal_lines").insert(lines.map(line=>({...line,company_id:company.id,journal_entry_id:journal.id})));if(lineError)throw lineError;
  const{error:postError}=await admin.from("journal_entries").update({status:"posted"}).eq("id",journal.id);if(postError)throw postError;
 }
 await postedJournal(9201,"2026-09-01","Browser opening balance",[{account_id:cash.id,debit:1000,credit:0,description:"Deposit"},{account_id:equity.id,debit:0,credit:1000,description:"Equity"}]);
 await postedJournal(9202,"2026-09-05","Browser fuel payment",[{account_id:fuel.id,debit:100,credit:0,description:"Fuel"},{account_id:cash.id,debit:0,credit:100,description:"Withdrawal"}]);
 await login(page,owner.email);await expect(page).toHaveURL(/\/workspace/);
 await page.getByRole("navigation",{name:"Primary navigation"}).getByRole("button",{name:"Transactions",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Statement reconciliation"})).toBeVisible();
 await page.getByLabel("Account name").fill("Operating checking");
 await page.getByLabel("Asset ledger account").selectOption({label:"1000 · Operating cash"});
 await page.getByRole("button",{name:"Link account"}).click();
 await expect(page.getByLabel("Bank account")).toContainText("Operating checking");
 await page.getByLabel("CSV statement").setInputFiles({name:"september.csv",mimeType:"text/csv",buffer:Buffer.from("Date,Description,Amount,Reference\n2026-09-01,Opening deposit,1000,OPEN-1\n2026-09-05,Fuel withdrawal,-100,FUEL-1")});
 await page.getByRole("button",{name:"Import and deduplicate"}).click();
 await expect(page.getByText("2 imported; 0 duplicates skipped.")).toBeVisible();
 await page.getByLabel("Journal match for Opening deposit").selectOption({label:"JE-9201 · 2026-09-01 · Browser opening balance"});
 await page.getByRole("button",{name:"Match Opening deposit"}).click();
 await expect(page.getByText("Statement row matched.")).toBeVisible();
 await page.getByLabel("Journal match for Fuel withdrawal").selectOption({label:"JE-9202 · 2026-09-05 · Browser fuel payment"});
 await page.getByRole("button",{name:"Match Fuel withdrawal"}).click();
 await page.getByLabel("Starts").fill("2026-09-01");await page.getByLabel("Ends").fill("2026-09-30");await page.getByLabel("Closing balance").fill("900");
 await page.getByRole("button",{name:"Calculate difference"}).click();
 await expect(page.getByText("$0.00",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Complete and lock"}).click();
 await expect(page.getByText("completed",{exact:true})).toBeVisible();
 const{data:reconciliation,error}=await admin.from("reconciliations").select("status,locked_at,rows:imported_transactions(count)").eq("company_id",company.id).single();if(error)throw error;
 expect(reconciliation.status).toBe("completed");expect(reconciliation.locked_at).toBeTruthy();expect(reconciliation.rows[0].count).toBe(2);
});

test("audit history pages through tied timestamps and exports filtered older events",async({page})=>{
 const owner=await createUser("Audit Paging Owner");
 const company=await insert("companies",{legal_name:"Audit Paging Test",display_name:"Audit Paging Test",created_by:owner.id});
 await insert("company_memberships",{company_id:company.id,user_id:owner.id,role:"owner"});
 const createdAt="2026-01-01T12:00:00.123456Z";
 const rows=Array.from({length:510},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,company_id:company.id,actor_id:owner.id,action:"journal.posted",record_type:"journal_entry",record_id:crypto.randomUUID(),after_data:{reference:`PAGING-${String(i+1).padStart(4,"0")}`},created_at:createdAt}));
 // Use a random UUID prefix to keep repeated local test runs independent.
 const prefix=crypto.randomUUID().slice(0,8);rows.forEach(row=>{row.id=prefix+row.id.slice(8)});
 const {error}=await admin.from("audit_logs").insert(rows);if(error)throw error;
 await login(page,owner.email);await expect(page).toHaveURL(/\/workspace/);
 await page.getByRole("navigation",{name:"Primary navigation"}).getByRole("button",{name:"Audit log",exact:true}).click();
 await expect(page.getByText(/250 loaded/)).toBeVisible();
 await expect(page.getByText(/Search and export include only loaded events/)).toBeVisible();
 await page.getByRole("button",{name:"Load older events",exact:true}).click();
 await expect(page.getByText(/500 loaded/)).toBeVisible();
 await page.getByRole("button",{name:"Load older events",exact:true}).click();
 await expect(page.getByText(/All available events are loaded/)).toBeVisible();
 await page.getByLabel("Search loaded audit events").fill("PAGING-");
 await expect(page.getByText(/510 matching events/)).toBeVisible();
 await page.getByLabel("Search loaded audit events").fill("PAGING-0001");
 await expect(page.getByText(/1 matching events/)).toBeVisible();
 const downloading=page.waitForEvent("download");await page.getByRole("button",{name:"Export CSV",exact:true}).click();
 const download=await downloading,path=await download.path();expect(path).toBeTruthy();
 const csv=readFileSync(path!,"utf8");expect(csv).toContain("PAGING-0001");expect(csv).not.toContain("PAGING-0002");
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
