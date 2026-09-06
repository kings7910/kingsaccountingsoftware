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

test("protected workspace redirects unsigned users",async({page})=>{
 await page.goto("/workspace");await expect(page).toHaveURL(/\/login/);
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
