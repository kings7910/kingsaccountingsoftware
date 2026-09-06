"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TransactionWorkspace } from "@/components/transactions/transaction-workspace";
import { InvoiceWorkspace } from "@/components/invoices/invoice-workspace";
import { LoadWorkspace } from "@/components/operations/load-workspace";
import { FleetWorkspace } from "@/components/fleet/fleet-workspace";
import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";
import { ReportsWorkspace } from "@/components/reports/reports-workspace";
import { MaintenanceWorkspace } from "@/components/maintenance/maintenance-workspace";
import { FuelWorkspace } from "@/components/fuel/fuel-workspace";
import { PayrollWorkspace } from "@/components/payroll/payroll-workspace";
import { AccountingWorkspace } from "@/components/accounting/accounting-workspace";
import { ApprovalsWorkspace } from "@/components/approvals/approvals-workspace";
import { TeamWorkspace } from "@/components/team/team-workspace";
import { AuditWorkspace } from "@/components/audit/audit-workspace";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { PayablesWorkspace } from "@/components/payables/payables-workspace";

const moduleCopy:Record<string,{eyebrow:string;title:string;description:string;action:string}> = {
  Transactions:{eyebrow:"Money movement",title:"Income & expenses",description:"Review, categorize, split, match, and approve every transaction.",action:"Add transaction"},
  Invoices:{eyebrow:"Accounts receivable",title:"Invoices & payments",description:"Send polished invoices and keep every payment accounted for.",action:"New invoice"},
  "Bills & payables":{eyebrow:"Accounts payable",title:"Bills & payments",description:"Track vendor balances and post bills and payments to the ledger.",action:"New vendor bill"},
  "Loads & routes":{eyebrow:"Dispatch",title:"Loads & routes",description:"Coordinate each shipment from pickup appointment to proof of delivery.",action:"Create load"},
  Fleet:{eyebrow:"Equipment",title:"Fleet command",description:"Keep trucks, trailers, documents, and utilization in one place.",action:"Add vehicle"},
  "Fuel & mileage":{eyebrow:"Operating costs",title:"Fuel & mileage",description:"Understand MPG, cost per mile, and every mile driven.",action:"Record fuel"},
  Maintenance:{eyebrow:"Fleet health",title:"Maintenance",description:"Plan service, manage work orders, and reduce costly downtime.",action:"New work order"},
  Payroll:{eyebrow:"People",title:"Payroll & settlements",description:"Prepare accurate pay records without filing payroll taxes automatically.",action:"Start pay run"},
  Accounting:{eyebrow:"General ledger",title:"Accounting",description:"Double-entry books with locked posted entries and traceable corrections.",action:"Journal entry"},
  Reports:{eyebrow:"Business intelligence",title:"Reports",description:"Financial statements and operational insight, ready for your accountant.",action:"Export report"},
  Approvals:{eyebrow:"Review queue",title:"Approvals",description:"Resolve driver submissions, expenses, documents, and exceptions.",action:"Review next"},
  "Team & roles":{eyebrow:"Access control",title:"Team & roles",description:"Give each person exactly the access their work requires.",action:"Invite person"},
  "Audit log":{eyebrow:"Accountability",title:"Audit history",description:"A durable timeline of sensitive actions and financial changes.",action:"Export log"},
  Settings:{eyebrow:"Company administration",title:"Settings",description:"Manage companies, categories, yearly rates, integrations, and preferences.",action:"Save changes"},
  "AI assistant":{eyebrow:"OpenAI powered",title:"Accounting assistant",description:"Get practical help with bookkeeping workflows and trucking operations.",action:"Ask a question"},
};

export function ModuleView({module,openForm=false,assistantEnabled=false,userId,companyId,role="owner"}:{module:string;openForm?:boolean;assistantEnabled?:boolean;userId?:string;companyId?:string;role?:string}) {
  const copy=moduleCopy[module]??moduleCopy.Transactions;
  const [showForm,setShowForm]=useState(openForm);
  return <div className="mx-auto max-w-[1600px] p-4 md:p-7 xl:p-9">
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-sm font-bold text-[var(--teal)]">{copy.eyebrow}</p><h1 className="display text-3xl font-extrabold text-[var(--navy)] md:text-4xl">{copy.title}</h1><p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{copy.description}</p></div>{module!=="AI assistant"&&!(role==="auditor"&&!["Reports","Audit log"].includes(module))&&<button onClick={()=>setShowForm(true)} className="flex w-fit items-center gap-2 rounded-xl bg-[var(--teal)] px-4 py-3 text-sm font-bold text-white"><Plus size={18}/>{copy.action}</button>}</div>
    {module==="AI assistant"?<AssistantWorkspace enabled={assistantEnabled}/>:module==="Bills & payables"?<PayablesWorkspace openCreate={showForm} onCreateClosed={()=>setShowForm(false)} companyId={companyId} readOnly={role==="auditor"}/>:module==="Loads & routes"?<LoadWorkspace openCreate={showForm} onCreateClosed={()=>setShowForm(false)} companyId={companyId}/>:module==="Fleet"?<FleetWorkspace openCreate={showForm} onCreateClosed={()=>setShowForm(false)} companyId={companyId}/>:module==="Fuel & mileage"?<FuelWorkspace openCreate={showForm} onCreateClosed={()=>setShowForm(false)} companyId={companyId}/>:module==="Settings"?<SettingsWorkspace saveRequested={showForm} onSaveHandled={()=>setShowForm(false)} companyId={companyId}/>:module==="Audit log"?<AuditWorkspace exportRequested={showForm} onExportHandled={()=>setShowForm(false)} companyId={companyId}/>:module==="Approvals"?<ApprovalsWorkspace openNext={showForm} onOpenHandled={()=>setShowForm(false)} companyId={companyId}/>:module==="Accounting"?<AccountingWorkspace openCreate={showForm} onCreateClosed={()=>setShowForm(false)} companyId={companyId}/>:module==="Payroll"?<PayrollWorkspace openCreate={showForm} onCreateClosed={()=>setShowForm(false)} companyId={companyId}/>:module==="Maintenance"?<MaintenanceWorkspace openCreate={showForm} onCreateClosed={()=>setShowForm(false)} companyId={companyId}/>:module==="Reports"?<ReportsWorkspace openFirst={showForm} onOpenHandled={()=>setShowForm(false)} companyId={companyId}/>:module==="Team & roles"?<TeamWorkspace openCreate={showForm} onCreateClosed={()=>setShowForm(false)} companyId={companyId}/>:module==="Transactions"?<TransactionWorkspace openCreate={showForm} onCreateClosed={()=>setShowForm(false)} userId={userId} companyId={companyId}/>:module==="Invoices"?<InvoiceWorkspace openCreate={showForm} onCreateClosed={()=>setShowForm(false)} companyId={companyId}/>:<div className="card p-8 text-center text-sm text-[var(--muted)]">This workspace is unavailable.</div>}
  </div>;
}
