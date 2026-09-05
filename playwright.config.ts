import {defineConfig} from "@playwright/test";
import {readFileSync} from "node:fs";
const configPath=process.env.KINGS_TEST_CONFIG;
if(!configPath)throw new Error("Set KINGS_TEST_CONFIG to a local Supabase status JSON file.");
const local=JSON.parse(readFileSync(configPath,"utf8"));
if(!["127.0.0.1","localhost"].includes(new URL(local.API_URL).hostname))throw new Error("Browser tests require an isolated local Supabase instance.");
export default defineConfig({
 testDir:"./e2e",workers:1,timeout:180_000,expect:{timeout:40_000},
 use:{baseURL:"http://127.0.0.1:3100",viewport:{width:1440,height:1000},trace:"retain-on-failure"},
 webServer:{command:"npm run build && npm run start -- --hostname 127.0.0.1 --port 3100",url:"http://127.0.0.1:3100/login",timeout:300_000,reuseExistingServer:false,
 env:{NEXT_PUBLIC_SUPABASE_URL:local.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,NEXT_PUBLIC_APP_URL:"http://127.0.0.1:3100",OPENAI_API_KEY:""}},
});
