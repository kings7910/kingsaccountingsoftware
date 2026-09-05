"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Building2, ChevronDown, LogOut, Menu, Plus, Search, X } from "lucide-react";
import { navigation } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { Dashboard } from "./dashboard/dashboard";
import { ModuleView } from "./modules/module-view";
import {listNotifications,markNotificationsRead,WorkspaceNotification} from "@/app/actions/notifications";
import {canViewModule} from "@/lib/permissions";

export function AppShell({authenticated=false,assistantEnabled=false,userId,companyId,userName="Kendra Williams",role="owner",companyName="King’s Transport LLC"}:{authenticated?:boolean;assistantEnabled?:boolean;userId?:string;companyId?:string;userName?:string;role?:string;companyName?:string}) {
  const router = useRouter();
  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifications,setNotifications]=useState<WorkspaceNotification[]>([]);
  const [notificationError,setNotificationError]=useState("");
  const [quickAddRequest, setQuickAddRequest] = useState<{ module: string; id: number } | null>(null);
  const quickAddId = useRef(0);

  const allowedNavigation=useMemo(()=>navigation.filter(item=>canViewModule(role,item.label)),[role]);
  const unread=notifications.filter(item=>!item.read).length;
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return allowedNavigation.filter(({ label }) => label.toLowerCase().includes(query)).slice(0, 6);
  }, [search,allowedNavigation]);

  useEffect(()=>{if(!authenticated||!companyId)return;listNotifications(companyId).then(setNotifications).catch(()=>setNotificationError("Notifications could not be loaded. Reload to try again."))},[authenticated,companyId]);

  function navigate(label: string) {
    if(!canViewModule(role,label))return;
    setActive(label);
    setQuickAddRequest(null);
    setMenuOpen(false);
    setSearch("");
    setQuickAddOpen(false);
    setNotificationsOpen(false);
  }

  async function readNotifications(ids?:string[]){if(!companyId)return;const targetIds=ids??notifications.filter(item=>!item.read).map(item=>item.id);if(!targetIds.length)return;setNotifications(items=>items.map(item=>targetIds.includes(item.id)?{...item,read:true}:item));try{await markNotificationsRead(companyId,targetIds)}catch{setNotificationError("Could not mark notifications as read.");setNotifications(items=>items.map(item=>targetIds.includes(item.id)?{...item,read:false}:item))}}

  function notificationTarget(kind:string){const value=kind.toLowerCase();if(value.includes("invoice"))return"Invoices";if(value.includes("maintenance")||value.includes("service"))return"Maintenance";if(value.includes("approval")||value.includes("receipt"))return"Approvals";if(value.includes("payroll"))return"Payroll";if(value.includes("load"))return"Loads & routes";return"Overview"}

  function quickAdd(module: string) {
    setActive(module);
    quickAddId.current += 1;
    setQuickAddRequest({ module, id: quickAddId.current });
    setQuickAddOpen(false);
  }

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = userName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "U";

  return <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[var(--navy)] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-auto ${menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <div className="grid size-10 place-items-center rounded-xl bg-[var(--gold)] font-black text-[var(--navy)]">K</div>
        <div><div className="display text-lg font-extrabold leading-tight">King’s</div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-white/55">Accounting software</div></div>
        <button aria-label="Close menu" className="ml-auto lg:hidden" onClick={()=>setMenuOpen(false)}><X/></button>
      </div>
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl bg-white/8 p-3">
        <div className="grid size-9 place-items-center rounded-lg bg-[var(--teal)]"><Building2 size={18}/></div>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{companyName}</div><div className="text-xs text-white/55">Primary company</div></div><ChevronDown size={15}/>
      </div>
      <nav className="hide-scrollbar flex-1 overflow-y-auto px-3 py-5" aria-label="Primary navigation">
        {allowedNavigation.map(({label,icon:Icon})=><button key={label} onClick={()=>navigate(label)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition ${active===label?"bg-[var(--teal)] text-white shadow-lg shadow-black/10":"text-white/65 hover:bg-white/7 hover:text-white"}`}><Icon size={18}/>{label}</button>)}
      </nav>
      <div className="relative border-t border-white/10 p-4"><button onClick={()=>setAccountOpen(value=>!value)} aria-expanded={accountOpen} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/7"><div className="grid size-9 place-items-center rounded-full bg-[#e8c8a6] text-xs font-black text-[#58351f]">{initials}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{userName}</div><div className="capitalize text-xs text-white/50">{role.replaceAll("_"," ")}</div></div><ChevronDown size={15}/></button>{accountOpen&&<div className="absolute bottom-[calc(100%-4px)] left-4 right-4 rounded-xl border border-white/10 bg-[#0f3a49] p-2 shadow-xl">{authenticated?<button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold hover:bg-white/10"><LogOut size={16}/>Sign out</button>:<a href="/login" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold hover:bg-white/10">Sign in to workspace</a>}</div>}</div>
    </aside>
    {menuOpen&&<button className="fixed inset-0 z-40 bg-black/40 lg:hidden" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}/>} 
    <main className="min-w-0">
      <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-[var(--line)] bg-white/92 px-4 backdrop-blur md:px-7">
        <button aria-label="Open menu" onClick={()=>setMenuOpen(true)} className="rounded-lg p-2 text-[var(--navy)] lg:hidden"><Menu/></button>
        <div className="relative hidden max-w-md flex-1 sm:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18}/><input aria-label="Search modules" value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&searchResults[0])navigate(searchResults[0].label);if(event.key==="Escape")setSearch("")}} className="w-full rounded-xl border border-[var(--line)] bg-[var(--canvas)] py-2.5 pl-10 pr-4 text-sm" placeholder="Search loads, invoices, drivers…"/>{search&&<div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xl">{searchResults.length?searchResults.map(({label,icon:Icon})=><button key={label} onClick={()=>navigate(label)} className="flex w-full items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-left text-sm font-bold last:border-0 hover:bg-[var(--canvas)]"><Icon size={17} className="text-[var(--teal)]"/>{label}</button>):<p className="p-4 text-sm text-[var(--muted)]">No matching workspace found.</p>}</div>}</div>
        <div className="relative ml-auto flex items-center gap-2">
          <button aria-label="Notifications" aria-expanded={notificationsOpen} onClick={()=>{setNotificationsOpen(value=>!value);setQuickAddOpen(false)}} className="relative rounded-xl border border-[var(--line)] p-2.5 text-[var(--navy)]"><Bell size={19}/>{unread>0&&<span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white"/>}</button>
          <button aria-expanded={quickAddOpen} onClick={()=>{setQuickAddOpen(value=>!value);setNotificationsOpen(false)}} className="flex items-center gap-2 rounded-xl bg-[var(--teal)] px-3.5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0f796b]"><Plus size={18}/> <span className="hidden sm:inline">Quick add</span></button>
          {notificationsOpen&&<div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xl"><div className="flex items-center justify-between border-b border-[var(--line)] p-4"><div><h2 className="font-extrabold text-[var(--navy)]">Notifications</h2><p className="text-xs text-[var(--muted)]">{unread} unread items</p></div><button disabled={!unread} onClick={()=>void readNotifications()} className="text-xs font-bold text-[var(--teal)] disabled:opacity-40">Mark all read</button></div>{notifications.map(item=>{const target=notificationTarget(item.kind),allowed=canViewModule(role,target);return <button key={item.id} onClick={()=>{void readNotifications([item.id]);if(allowed)navigate(target)}} className="flex w-full gap-3 border-b border-[var(--line)] p-4 text-left last:border-0 hover:bg-[var(--canvas)]"><span className={`mt-1 size-2 shrink-0 rounded-full ${item.read?"bg-transparent":"bg-[var(--teal)]"}`}/><span><b className="block text-sm">{item.title}</b><span className="text-xs text-[var(--muted)]">{item.body}</span></span></button>})}{notificationError&&<p role="alert" className="p-4 text-sm text-red-700">{notificationError}</p>}{!notificationError&&!notifications.length&&<p className="p-6 text-center text-sm text-[var(--muted)]">You’re all caught up.</p>}</div>}
          {quickAddOpen&&<div className="absolute right-0 top-[calc(100%+12px)] z-50 w-64 overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-2 shadow-xl"><p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Create a record</p>{[["Transaction","Transactions"],["Invoice","Invoices"],["Vendor bill","Bills & payables"],["Load","Loads & routes"],["Fuel entry","Fuel & mileage"],["Work order","Maintenance"]].filter(([,target])=>canViewModule(role,target)).map(([label,target])=><button key={label} onClick={()=>quickAdd(target)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-[var(--canvas)]"><span className="grid size-8 place-items-center rounded-lg bg-[var(--teal-light)] text-[var(--teal)]"><Plus size={15}/></span>{label}</button>)}</div>}
        </div>
      </header>
      {active === "Overview" ? <Dashboard userName={userName} onNavigate={navigate} companyId={companyId}/> : <ModuleView key={`${active}-${quickAddRequest?.id??"view"}`} module={active} openForm={quickAddRequest?.module===active} assistantEnabled={assistantEnabled} userId={userId} companyId={companyId} role={role}/>}
    </main>
  </div>;
}
