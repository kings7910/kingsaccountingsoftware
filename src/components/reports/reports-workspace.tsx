"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, TrendingDown, TrendingUp } from "lucide-react";
import { reportFileName, reports, reportToCsv, type ReportRow } from "@/lib/reports";
import { loadReports } from "@/app/actions/reports";

const currency=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2});
const number=new Intl.NumberFormat("en-US",{maximumFractionDigits:2});

function formatValue(row:ReportRow,value:number){
  if(row.format==="number") return number.format(value);
  if(row.format==="percent") return `${number.format(value)}%`;
  return currency.format(value);
}

export function ReportsWorkspace({openFirst=false,onOpenHandled,companyId}:{openFirst?:boolean;onOpenHandled?:()=>void;companyId?:string}){
  const [selectedId,setSelectedId]=useState(openFirst?reports[0].id:"");
  const [period,setPeriod]=useState(()=>new Date().toLocaleDateString("en-US",{month:"long",year:"numeric",timeZone:"UTC"}));
  const [reportData,setReportData]=useState(companyId?[]:reports),[error,setError]=useState(""),[loading,setLoading]=useState(Boolean(companyId)),[reload,setReload]=useState(0),[loadedKey,setLoadedKey]=useState(companyId?"":"demo");
  useEffect(()=>{
    let active=true;
    if(!companyId){setReportData(reports);setLoadedKey("demo");setLoading(false);setError("");return}
    setLoading(true);setError("");
    loadReports(companyId,period).then(data=>{if(active){setReportData(data);setLoadedKey(`${companyId}:${period}`)}})
      .catch(cause=>{if(active){setReportData([]);setError(cause instanceof Error?cause.message:"Unable to load reports.")}})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[companyId,period,reload]);
  const periods=useMemo(()=>{
    const now=new Date(),year=now.getUTCFullYear(),month=now.getUTCMonth();
    return [...Array.from({length:12},(_,i)=>new Date(Date.UTC(year,month-i,1)).toLocaleDateString("en-US",{month:"long",year:"numeric",timeZone:"UTC"})),`Quarter ${Math.floor(month/3)+1}, ${year}`,`Year to date ${year}`,`Year ${year-1}`];
  },[]);

  const selected=useMemo(()=>reportData.find(report=>report.id===selectedId),[reportData,selectedId]);
  useEffect(()=>{if(openFirst){setSelectedId(reportData[0]?.id??"");onOpenHandled?.()}},[openFirst,onOpenHandled,reportData]);

  function select(id:string){setSelectedId(id);onOpenHandled?.()}
  function download(){
    if(!selected||selected.unavailableReason||loading||error||(companyId&&loadedKey!==`${companyId}:${period}`)) return;
    const blob=new Blob([reportToCsv(selected,period)],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;anchor.download=reportFileName(selected,period);anchor.click();
    URL.revokeObjectURL(url);
  }

  if(companyId&&(loading||error||loadedKey!==`${companyId}:${period}`))return <div className="card p-6" role={error?"alert":"status"}>{error||"Loading company reports…"}{error&&<button onClick={()=>setReload(x=>x+1)} className="ml-3 rounded-xl border px-3 py-2 font-bold">Retry</button>}</div>;
  if(!selected) return <>{error&&<div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{reportData.map(report=><button onClick={()=>select(report.id)} className="card group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--teal)] hover:shadow-md" key={report.id}><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--teal-light)] text-[var(--teal)]"><FileSpreadsheet size={20}/></div><span className="min-w-0 flex-1"><b className="block font-extrabold text-[var(--navy)]">{report.name}</b><span className="mt-1 block text-xs text-[var(--muted)]">{report.description}</span></span><ArrowRight className="shrink-0 text-[var(--muted)] group-hover:text-[var(--teal)]" size={18}/></button>)}</div></>;

  return <div>{error&&<div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}{loading&&<div className="mb-4 rounded-xl bg-[var(--teal-light)] p-3 text-sm font-bold text-[var(--teal)]">Refreshing report data…</div>}
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <button onClick={()=>setSelectedId("")} className="flex w-fit items-center gap-2 text-sm font-bold text-[var(--teal)]"><ArrowLeft size={17}/>All reports</button>
      <div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="report-period">Report period</label><select id="report-period" value={period} onChange={event=>setPeriod(event.target.value)} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-bold">{periods.map(value=><option key={value}>{value}</option>)}</select><button disabled={Boolean(selected.unavailableReason)} onClick={download} className="flex items-center gap-2 rounded-xl bg-[var(--teal)] px-4 py-2.5 text-sm font-bold text-white"><Download size={17}/>Export CSV</button></div>
    </div>
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--line)] p-5 md:p-7"><p className="text-xs font-bold uppercase tracking-wider text-[var(--teal)]">{period}</p><h2 className="display mt-1 text-2xl font-extrabold text-[var(--navy)]">{selected.name}</h2><p className="mt-1 text-sm text-[var(--muted)]">{selected.description} {companyId?"Company data":"Demo data"} · management basis</p></div>
      {selected.unavailableReason&&<p role="status" className="p-5">{selected.unavailableReason}</p>}<div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead><tr className="bg-[var(--canvas)] text-xs uppercase tracking-wider text-[var(--muted)]"><th className="px-5 py-3 md:px-7">Account / metric</th><th className="py-3 text-right">Current period</th><th className="py-3 text-right">Previous period</th><th className="px-5 py-3 text-right md:px-7">Change</th></tr></thead><tbody>{selected.rows.map(row=>{const previous=row.previous??0;const change=previous===0?null:(row.current-previous)/Math.abs(previous)*100;return <tr key={row.label} className={`border-t border-[var(--line)] ${row.emphasis==="total"?"bg-[var(--navy)] font-extrabold text-white":row.emphasis==="subtotal"?"bg-[var(--canvas)] font-bold":""}`}><td className="px-5 py-4 md:px-7">{row.label}</td><td className="py-4 text-right tabular-nums">{formatValue(row,row.current)}</td><td className={`py-4 text-right tabular-nums ${row.emphasis==="total"?"text-white/65":"text-[var(--muted)]"}`}>{row.previous===undefined?"—":formatValue(row,row.previous)}</td><td className="px-5 py-4 text-right md:px-7">{change===null?"—":<span className={`inline-flex items-center justify-end gap-1 text-xs ${row.emphasis==="total"?"text-white":change>=0?"text-[var(--teal)]":"text-[#bd6b43]"}`}>{change>=0?<TrendingUp size={14}/>:<TrendingDown size={14}/>} {Math.abs(change).toFixed(1)}%</span>}</td></tr>})}</tbody></table></div>
    </section>
    <p className="mt-3 text-xs text-[var(--muted)]">Reports are management views and should be reviewed before tax filing or lender submission.</p>
  </div>;
}
