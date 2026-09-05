"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ChevronDown, CircleAlert, Clock3, FileWarning, Fuel, Gauge, MoreHorizontal, Receipt, TrendingDown, TrendingUp, Truck, Wrench } from "lucide-react";
import { alerts as demoAlerts, cashFlow as demoCashFlow, loads as demoLoads, recent as demoRecent, stats as demoStats } from "@/lib/demo-data";
import {DashboardData,loadDashboard} from "@/app/actions/dashboard";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const money = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 });

const fallback:DashboardData={stats:demoStats,cashFlow:demoCashFlow,fleet:{totalMileage:42816,loadedMileage:35740,revenuePerMile:4.32,costPerMile:2.79,fuelCost:31284,fuelPerMile:.73},loads:demoLoads,alerts:demoAlerts.map((item,index)=>({...item,target:["Approvals","Maintenance","Fleet"][index],kind:["approval","maintenance","fleet"][index] as DashboardData["alerts"][number]["kind"]})),recent:demoRecent as DashboardData["recent"]};
export function Dashboard({userName,onNavigate,companyId}:{userName:string;onNavigate:(value:string)=>void;companyId?:string}) {
  const [period,setPeriod]=useState("6");
  const [dashboard,setDashboard]=useState<DashboardData|null>(companyId?null:fallback),[error,setError]=useState(""),[reload,setReload]=useState(0);
  useEffect(()=>{let active=true;setError("");if(!companyId){setDashboard(fallback);return}setDashboard(null);loadDashboard(companyId).then(value=>{if(active)setDashboard(value)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Unable to load dashboard.")});return()=>{active=false}},[companyId,reload]);
  const chartData=useMemo(()=>(dashboard?.cashFlow??[]).slice(-Number(period)),[period,dashboard?.cashFlow]);
  const firstName=userName.trim().split(/\s+/)[0]||"there";
  const [today,setToday]=useState(""),[greeting,setGreeting]=useState("Welcome");
  useEffect(()=>{const now=new Date();setToday(new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric"}).format(now));const hour=now.getHours();setGreeting(hour<12?"Good morning":hour<18?"Good afternoon":"Good evening")},[]);
  if(!dashboard||error)return <div className="card m-5 p-5" role={error?"alert":"status"}>{error||"Loading your dashboard…"}{error&&<button onClick={()=>setReload(x=>x+1)} className="ml-3 rounded-xl border px-3 py-2 font-bold">Retry</button>}</div>;
  return <div className="mx-auto max-w-[1600px] p-4 md:p-7 xl:p-9">{error&&<div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
    <section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="mb-1 text-sm font-semibold text-[var(--teal)]">{today}</p><h1 className="display text-3xl font-extrabold text-[var(--navy)] md:text-4xl">{greeting}, {firstName}.</h1><p className="mt-2 text-sm text-[var(--muted)]">Here’s what’s happening across your business.</p></div>
      <label className="relative flex w-fit items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--navy)]"><CalendarDays size={17}/><select aria-label="Dashboard cash-flow period" value={period} onChange={event=>setPeriod(event.target.value)} className="appearance-none bg-transparent pr-5 font-bold"><option value="1">This month</option><option value="3">Last 3 months</option><option value="6">Last 6 months</option></select><ChevronDown className="pointer-events-none absolute right-3" size={15}/></label>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {dashboard.stats.map((stat,index)=><article className="card relative overflow-hidden p-5" key={stat.label}>
        <div className={`absolute inset-x-0 top-0 h-1 ${["bg-[var(--teal)]","bg-[var(--navy)]","bg-[var(--gold)]","bg-[#df7b45]"][index]}`}/>
        <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-[var(--muted)]">{stat.label}</p><MoreHorizontal size={18} className="text-[#9aa8ae]"/></div>
        <p className="display text-2xl font-extrabold text-[var(--navy)] md:text-3xl">{stat.value}</p>
        <p className={`mt-2 flex items-center gap-1 text-xs font-bold ${index===1?"text-[#bd6b43]":"text-[var(--teal)]"}`}>{index===1?<TrendingUp size={13}/>:<TrendingUp size={13}/>} {stat.change} <span className="font-medium text-[var(--muted)]">vs last month</span></p>
      </article>)}
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <article className="card min-h-[370px] p-5 md:p-6">
        <div className="mb-4 flex items-start justify-between"><div><h2 className="display text-xl font-extrabold text-[var(--navy)]">Cash flow</h2><p className="mt-1 text-sm text-[var(--muted)]">Income and expenses over six months</p></div><div className="flex gap-4 text-xs font-semibold"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[var(--teal)]"/>Income</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#c9d5d9]"/>Expenses</span></div></div>
        <div className="h-[270px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} barGap={5}><CartesianGrid vertical={false} stroke="#e8edef"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill:"#718087",fontSize:12}}/><YAxis axisLine={false} tickLine={false} tick={{fill:"#718087",fontSize:11}} tickFormatter={v=>`$${v}k`}/><Tooltip cursor={{fill:"#f4f7f8"}} formatter={(v)=>money.format(Number(v)*1000)}/><Bar dataKey="income" fill="#138979" radius={[5,5,0,0]} maxBarSize={28}/><Bar dataKey="expenses" fill="#cfdbde" radius={[5,5,0,0]} maxBarSize={28}/></BarChart></ResponsiveContainer></div>
      </article>
      <article className="card p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="display text-xl font-extrabold text-[var(--navy)]">Fleet performance</h2><p className="mt-1 text-sm text-[var(--muted)]">This month</p></div><Truck className="text-[var(--teal)]"/></div>
        <div className="grid grid-cols-2 gap-3">
          {[{l:"Total mileage",v:dashboard.fleet.totalMileage.toLocaleString(),s:"miles",i:Gauge},{l:"Loaded mileage",v:dashboard.fleet.loadedMileage.toLocaleString(),s:dashboard.fleet.totalMileage?`${(dashboard.fleet.loadedMileage/dashboard.fleet.totalMileage*100).toFixed(1)}%`:"0%",i:Truck},{l:"Revenue / mile",v:money.format(dashboard.fleet.revenuePerMile),s:"+$0.28",i:TrendingUp},{l:"Cost / mile",v:money.format(dashboard.fleet.costPerMile),s:"−$0.11",i:TrendingDown}].map(({l,v,s,i:Icon})=><div key={l} className="rounded-2xl bg-[var(--canvas)] p-4"><Icon size={18} className="mb-4 text-[var(--teal)]"/><p className="text-xs font-semibold text-[var(--muted)]">{l}</p><p className="display mt-1 text-xl font-extrabold text-[var(--navy)]">{v}</p><p className="mt-1 text-xs font-bold text-[var(--teal)]">{s}</p></div>)}
        </div>
        <div className="mt-4 rounded-2xl border border-[#f0dfb6] bg-[#fffaf0] p-4"><div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-bold text-[var(--navy)]"><Fuel size={17} className="text-[var(--gold)]"/>Fuel cost</span><strong>{money.format(dashboard.fleet.fuelCost)}</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eee4ce]"><div className="h-full w-[68%] rounded-full bg-[var(--gold)]"/></div><p className="mt-2 text-xs text-[var(--muted)]">{money.format(dashboard.fleet.fuelPerMile)} per mile</p></div>
      </article>
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
      <article className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3 md:px-6"><div><h2 className="display text-xl font-extrabold text-[var(--navy)]">Active loads</h2><p className="mt-1 text-sm text-[var(--muted)]">Live dispatch snapshot</p></div><button onClick={()=>onNavigate("Loads & routes")} className="flex items-center gap-1 text-sm font-bold text-[var(--teal)]">View all <ArrowRight size={16}/></button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-y border-[var(--line)] bg-[var(--canvas)] text-[11px] uppercase tracking-wider text-[var(--muted)]"><th className="px-6 py-3">Load</th><th>Lane</th><th>Driver / unit</th><th>Revenue</th><th className="pr-6">Status</th></tr></thead><tbody>{dashboard.loads.map(load=><tr key={load.number} className="border-b border-[var(--line)] last:border-0"><td className="px-6 py-4 text-sm font-extrabold text-[var(--navy)]">{load.number}</td><td className="py-4 text-sm font-semibold">{load.lane}</td><td className="py-4"><p className="text-sm font-semibold">{load.driver}</p><p className="text-xs text-[var(--muted)]">Unit {load.unit}</p></td><td className="py-4 text-sm font-bold">{load.value}</td><td className="pr-6"><span className={`pill ${load.status==="Delivered"?"bg-[#e8f5ee] text-[#287250]":"bg-[#e5f2f5] text-[#23657a]"}`}>{load.status}</span></td></tr>)}</tbody></table></div>
      </article>
      <article className="card p-5 md:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="display text-xl font-extrabold text-[var(--navy)]">Needs attention</h2><p className="mt-1 text-sm text-[var(--muted)]">Items that could use a look</p></div><CircleAlert className="text-[#d97b47]"/></div><div className="space-y-2">{dashboard.alerts.map((alert,index)=><button key={alert.title} onClick={()=>onNavigate(alert.target)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[var(--canvas)]"><div className={`grid size-10 shrink-0 place-items-center rounded-xl ${index===0?"bg-[#fff0e8] text-[#c96535]":index===1?"bg-[var(--teal-light)] text-[var(--teal)]":"bg-[#fff8e4] text-[#aa7720]"}`}>{index===0?<FileWarning size={18}/>:index===1?<Wrench size={18}/>:<Clock3 size={18}/>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{alert.title}</p><p className="text-xs text-[var(--muted)]">{alert.detail}</p></div><span className="text-[11px] font-bold text-[var(--muted)]">{alert.urgency}</span></button>)}</div></article>
    </section>

    <article className="card mt-4 overflow-hidden"><div className="flex items-center justify-between p-5 pb-3 md:px-6"><div><h2 className="display text-xl font-extrabold text-[var(--navy)]">Recent activity</h2><p className="mt-1 text-sm text-[var(--muted)]">Latest money movement</p></div><button onClick={()=>onNavigate("Transactions")} className="flex items-center gap-1 text-sm font-bold text-[var(--teal)]">All transactions <ArrowRight size={16}/></button></div><div className="grid divide-y divide-[var(--line)] border-t border-[var(--line)] md:grid-cols-2 md:divide-x md:divide-y-0">{dashboard.recent.map((item,index)=><div key={item.detail} className={`flex items-center gap-3 p-4 md:px-6 ${index>1?"md:hidden xl:flex":""}`}><div className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.kind==="income"?"bg-[var(--teal-light)] text-[var(--teal)]":"bg-[var(--canvas)] text-[var(--navy)]"}`}><Receipt size={17}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.title}</p><p className="text-xs text-[var(--muted)]">{item.detail}</p></div><div className="text-right"><p className={`text-sm font-extrabold ${item.kind==="income"?"text-[var(--teal)]":"text-[var(--navy)]"}`}>{item.amount}</p><p className="text-[11px] font-semibold text-[var(--muted)]">{item.status}</p></div></div>)}</div></article>
  </div>;
}
