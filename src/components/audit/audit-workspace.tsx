"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {ChevronRight,Download,History,Search,ShieldCheck,X} from "lucide-react";
import {auditToCsv,type AuditEvent,type AuditCursor,demoAuditEvents,filterAuditEvents} from "@/lib/audit";
import {listAuditEvents} from "@/app/actions/audit";

type Props={exportRequested:boolean;onExportHandled:()=>void;companyId?:string};
export function AuditWorkspace(props:Props){return <AuditHistory key={props.companyId??"demo"} {...props}/>}

function AuditHistory({exportRequested,onExportHandled,companyId}:Props){
  const [events,setEvents]=useState<AuditEvent[]>(companyId?[]:demoAuditEvents);
  const [error,setError]=useState(""),[loading,setLoading]=useState(Boolean(companyId)),[loadingMore,setLoadingMore]=useState(false),[reload,setReload]=useState(0);
  const [cursor,setCursor]=useState<AuditCursor|null>(null);
  const [query,setQuery]=useState(""),[action,setAction]=useState("All"),[selected,setSelected]=useState<AuditEvent|null>(null);
  useEffect(()=>{
    if(!companyId)return;
    let active=true;
    setLoading(true);setError("");setEvents([]);setCursor(null);setSelected(null);
    listAuditEvents(companyId).then(page=>{if(active){setEvents(page.events);setCursor(page.nextCursor)}})
      .catch(()=>{if(active)setError("Unable to load audit history. Try again.")})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[companyId,reload]);
  const visible=useMemo(()=>filterAuditEvents(events,query,action),[events,query,action]);
  const canExport=!loading&&!loadingMore&&!error&&visible.length>0;
  const download=useCallback(()=>{
    if(!canExport)return;
    const url=URL.createObjectURL(new Blob([auditToCsv(visible)],{type:"text/csv;charset=utf-8"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`audit-log-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();URL.revokeObjectURL(url);
  },[visible,canExport]);
  useEffect(()=>{if(exportRequested&&!loading&&!loadingMore){download();onExportHandled()}},[exportRequested,onExportHandled,download,loading,loadingMore]);
  async function loadOlder(){
    if(!companyId||!cursor||loadingMore)return;
    setLoadingMore(true);setError("");
    try{
      const page=await listAuditEvents(companyId,cursor);
      setEvents(current=>{const ids=new Set(current.map(event=>event.id));return [...current,...page.events.filter(event=>!ids.has(event.id))]});
      setCursor(page.nextCursor);
    }catch{setError("Unable to load older events. Your loaded history is preserved; retry to continue.")}
    finally{setLoadingMore(false)}
  }
  if(loading)return <div role="status" className="card p-6">Loading audit history…</div>;
  if(error&&!events.length)return <div role="alert" className="card p-6">{error}<button onClick={()=>setReload(value=>value+1)} className="ml-3 rounded-xl border px-3 py-2 font-bold">Retry</button></div>;
  return <>
    {error&&<div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/><input aria-label="Search loaded audit events" value={query} onChange={event=>setQuery(event.target.value)} className="w-full rounded-xl border border-[var(--line)] bg-white py-2.5 pl-10" placeholder="Search actor, action, or reference…"/></div>
      <select aria-label="Filter event area" value={action} onChange={event=>setAction(event.target.value)} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2"><option>All</option>{[...new Set(events.map(event=>event.action.split(".")[0]))].map(area=><option key={area}>{area}</option>)}</select>
      <button disabled={!canExport} onClick={download} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 font-bold disabled:opacity-50"><Download size={17}/>Export CSV</button>
    </div>
    <div className="mt-4 rounded-xl border border-[#cfe6e1] bg-[var(--teal-light)] p-4 text-sm text-[var(--navy)]"><ShieldCheck className="mr-2 inline text-[var(--teal)]" size={18}/><b>Immutable history:</b> audit events can be viewed and exported, but never edited or deleted.</div>
    <p className="mt-3 text-sm text-[var(--muted)]" role="status">{visible.length} matching events · {events.length} loaded. {cursor?"Older events are available below. Search and export include only loaded events.":"All available events are loaded. Export includes the events matching your filters."}</p>
    <div className="card mt-4 overflow-hidden">
      {visible.map(event=><button onClick={()=>setSelected(event)} key={event.id} className="flex w-full items-center gap-4 border-b border-[var(--line)] p-4 text-left last:border-0 hover:bg-[var(--canvas)] md:px-6"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--teal-light)] text-[var(--teal)]"><History size={18}/></div><div className="min-w-0 flex-1"><b>{event.summary}</b><p className="truncate text-xs text-[var(--muted)]">{event.actor} · {event.entityType} {event.entityReference}</p></div><div className="hidden text-right sm:block"><p className="text-sm">{new Date(event.occurredAt).toLocaleDateString()}</p><p className="text-xs text-[var(--muted)]">{new Date(event.occurredAt).toLocaleTimeString()}</p></div><ChevronRight size={17}/></button>)}
      {!visible.length&&<p className="p-10 text-center text-sm text-[var(--muted)]">No audit events match this view.{cursor?" Load older events to search more history.":""}</p>}
    </div>
    {cursor&&<button onClick={()=>void loadOlder()} disabled={loadingMore} className="mt-4 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50">{loadingMore?"Loading older events…":error?"Retry older events":"Load older events"}</button>}
    {selected&&<Detail event={selected} onClose={()=>setSelected(null)}/>}
  </>;
}
function Detail({event,onClose}:{event:AuditEvent;onClose:()=>void}){return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onMouseDown={onClose}><section onMouseDown={e=>e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6"><div className="flex justify-between"><div><p className="text-xs font-bold text-[var(--teal)]">{event.action}</p><h2 className="display text-2xl font-extrabold">{event.entityReference}</h2></div><button aria-label="Close audit details" onClick={onClose}><X/></button></div><p className="mt-3">{event.summary}</p><div className="mt-4 grid gap-3 rounded-2xl bg-[var(--canvas)] p-4 text-sm sm:grid-cols-2"><span><small className="block text-[var(--muted)]">Actor</small>{event.actor}</span><span><small className="block text-[var(--muted)]">Occurred</small>{new Date(event.occurredAt).toLocaleString()}</span><span><small className="block text-[var(--muted)]">Entity</small>{event.entityType}</span><span><small className="block text-[var(--muted)]">IP address</small>{event.ipAddress}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><h3 className="mb-2 text-xs font-bold uppercase text-[var(--muted)]">Before</h3><pre className="overflow-x-auto rounded-xl bg-[var(--navy)] p-4 text-xs text-white">{JSON.stringify(event.before,null,2)}</pre></div><div><h3 className="mb-2 text-xs font-bold uppercase text-[var(--muted)]">After</h3><pre className="overflow-x-auto rounded-xl bg-[var(--navy)] p-4 text-xs text-white">{JSON.stringify(event.after,null,2)}</pre></div></div></section></div>}
