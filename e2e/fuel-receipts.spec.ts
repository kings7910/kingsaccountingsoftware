import {test,expect} from "@playwright/test";
import {createClient} from "@supabase/supabase-js";
import {readFileSync} from "node:fs";
const local=JSON.parse(readFileSync(process.env.KINGS_TEST_CONFIG!,"utf8"));
const admin=createClient(local.API_URL,local.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const password="Local-test-only-48!";
async function user(name:string){const email=`${name}-${crypto.randomUUID()}@test.local`;const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});if(error)throw error;return{id:data.user!.id,email}}
async function insert(table:string,values:Record<string,unknown>){const{data,error}=await admin.from(table).insert(values).select().single();if(error)throw error;return data}

test("sidebar mouse drag scrolls without navigation, while clicks and keyboard still navigate",async({page})=>{
 await page.setViewportSize({width:1280,height:600});await page.goto("/");
 const nav=page.getByRole("navigation",{name:"Primary navigation"});
 const before=await page.locator("main h1").textContent();
 const target=nav.getByRole("button",{name:"Transactions",exact:true});const box=(await target.boundingBox())!;
 await page.mouse.move(box.x+80,box.y+20);await page.mouse.down();await page.mouse.move(box.x+80,box.y-130,{steps:12});await page.mouse.up();
 expect(await nav.evaluate(el=>el.scrollTop)).toBeGreaterThan(80);await expect(page.locator("main h1")).toHaveText(before!);
 await nav.getByRole("button",{name:"Settings",exact:true}).click();await expect(page.getByRole("heading",{name:"Settings",exact:true})).toBeVisible();
 await nav.getByRole("button",{name:"Fuel & mileage",exact:true}).focus();await page.keyboard.press("Enter");await expect(page.getByRole("heading",{name:"Fuel & mileage",exact:true})).toBeVisible();
});

test("driver fuel receipt persists, appears in Receipts and opens from office Fuel",async({page,browser})=>{
 const owner=await user("FuelOwner"),driverUser=await user("FuelDriver");
 const company=await insert("companies",{legal_name:"Fuel Receipt Test",display_name:"Fuel Receipt Test",created_by:owner.id});
 await insert("company_memberships",{company_id:company.id,user_id:owner.id,role:"owner"});await insert("company_memberships",{company_id:company.id,user_id:driverUser.id,role:"driver"});
 const driver=await insert("drivers",{company_id:company.id,profile_id:driverUser.id});const truck=await insert("trucks",{company_id:company.id,unit_number:"GAS-1"});
 const load=await insert("loads",{company_id:company.id,load_number:"GAS-LOAD",driver_id:driver.id,truck_id:truck.id,status:"dispatched"});
 await page.setViewportSize({width:390,height:844});await page.goto("/login");await page.getByLabel("Email address").fill(driverUser.email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/driver/);
 await page.getByRole("button",{name:"Fuel",exact:true}).click();await page.getByLabel("Vendor",{exact:true}).fill("Gas station");await page.getByLabel("Gallons",{exact:true}).fill("10");await page.getByLabel("Total cost",{exact:true}).fill("40");await page.getByLabel("Odometer",{exact:true}).fill("100");
 await page.getByRole("button",{name:"Submit fuel entry",exact:true}).click();await expect(page.getByRole("combobox",{name:"Fuel entry",exact:true})).toContainText("Gas station");
 const attachments=page.getByRole("region",{name:"Fuel receipt attachments"});
 await expect(attachments.getByLabel("Take fuel receipt photo")).toHaveAttribute("capture","environment");await expect(attachments.getByLabel("Choose fuel receipt file")).not.toHaveAttribute("capture");
 await attachments.getByLabel("Choose fuel receipt file").setInputFiles({name:"gas-receipt.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4\nGas receipt test\n%%EOF")});
 await expect(page.getByText("Receipt saved and connected to this fuel entry.")).toBeVisible();await expect(attachments.getByRole("link",{name:"gas-receipt.pdf"})).toBeVisible();
 await page.getByRole("button",{name:"Receipts",exact:true}).click();await expect(page.getByText(/gas-receipt.pdf/)).toBeVisible();await page.reload();await page.getByRole("button",{name:"Fuel",exact:true}).click();await expect(page.getByRole("link",{name:"gas-receipt.pdf"})).toBeVisible();
 await page.screenshot({path:test.info().outputPath("fuel-driver.png"),fullPage:true});
 const {data:receipts,error}=await admin.from("receipts").select("fuel_entry_id").eq("load_id",load.id);expect(error).toBeNull();expect(receipts).toHaveLength(1);expect(receipts![0].fuel_entry_id).toBeTruthy();
 const office=await browser.newPage();await office.goto("/login");await office.getByLabel("Email address").fill(owner.email);await office.getByLabel("Password",{exact:true}).fill(password);await office.getByRole("button",{name:"Sign in",exact:true}).click();await expect(office).toHaveURL(/\/workspace/);
 await office.getByRole("navigation",{name:"Primary navigation"}).getByRole("button",{name:"Fuel & mileage",exact:true}).click();await expect(office.getByText(/1 receipt attached/)).toBeVisible();await office.getByRole("button",{name:"Receipts for fuel entry from Gas station"}).click();
 const link=office.getByRole("link",{name:"gas-receipt.pdf"});await expect(link).toBeVisible();const response=await office.request.get((await link.getAttribute("href"))!);expect(response.ok()).toBe(true);expect(await response.text()).toContain("Gas receipt test");
 await office.getByLabel("Take fuel receipt photo").setInputFiles({name:"office-gas.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==","base64")});await expect(office.getByRole("link",{name:"office-gas.png"})).toBeVisible();
 await office.screenshot({path:test.info().outputPath("fuel-office.png"),fullPage:true});
 await office.close();
});
