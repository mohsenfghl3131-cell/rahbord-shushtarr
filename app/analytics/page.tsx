"use client";

import AppShell from "@/app/components/AppShell";
import { useCallback, useEffect, useMemo, useState } from "react";

type AnalyticsData = {
  total?: number;
  byStatus?: { pending?: number; approved?: number; rejected?: number };
  byArea?: Record<string, number>;
  trend?: Record<string, number>;
};

const fmt = (value:number) => value.toLocaleString("fa-IR");
const dateKey = (date:Date) => {
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
};

export default function AnalyticsPage() {
  const [data,setData]=useState<AnalyticsData|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [range,setRange]=useState("30");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [updatedAt,setUpdatedAt]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const params=new URLSearchParams();
      if(range!=="custom"){
        const days=Number(range);
        if(days>0){const start=new Date();start.setDate(start.getDate()-days+1);params.set("from",dateKey(start));}
      }else{
        if(from)params.set("from",from);
        if(to)params.set("to",to);
      }
      const response=await fetch("/api/analytics?"+params.toString(),{cache:"no-store"});
      const value=await response.json();
      if(!response.ok)throw new Error(value.message||"دریافت آمار ناموفق بود.");
      setData(value);setUpdatedAt(new Date().toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit"}));
    }catch(e:any){setError(e.message||"خطا در دریافت آمار.");}
    finally{setLoading(false);}
  },[range,from,to]);

  useEffect(()=>{load();},[load]);

  const areas=useMemo(()=>Object.entries(data?.byArea??{}).map(([name,count])=>({name,count:Number(count)||0})).sort((a,b)=>b.count-a.count),[data]);
  const days=useMemo(()=>{
    const values=Object.entries(data?.trend??{}).sort(([a],[b])=>a.localeCompare(b));
    return values.map(([date,count])=>({date,label:new Date(date+"T12:00:00").toLocaleDateString("fa-IR",{day:"numeric",month:"short"}),count:Number(count)||0}));
  },[data]);
  const maxArea=Math.max(1,...areas.map(x=>x.count));
  const maxDay=Math.max(1,...days.map(x=>x.count));
  const pending=data?.byStatus?.pending??0,approved=data?.byStatus?.approved??0,rejected=data?.byStatus?.rejected??0;
  const reviewed=approved+rejected,reviewRate=data?.total?Math.round(reviewed/data.total*100):0;

  function exportCsv(){
    if(!data)return;
    const rows=[["حوزه","تعداد گزارش"],...areas.map(a=>[a.name,String(a.count)]),[],["وضعیت","تعداد"],["کل گزارش‌ها",String(data.total??0)],["در انتظار بررسی",String(pending)],["تأیید شده",String(approved)],["رد شده",String(rejected)]];
    const csv="\\uFEFF"+rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\\r\\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="rahbord-analytics.csv";a.click();URL.revokeObjectURL(url);
  }

  return <AppShell><main className="shell unified-page analytics-pro">
    <div className="topbar"><div><span className="eyebrow">مرکز پایش و تصمیم‌گیری</span><h1>گزارش‌های تحلیلی</h1><p>تحلیل روند گزارش‌ها، وضعیت رسیدگی و مقایسه حوزه‌ها</p></div><div className="analytics-actions"><span className="header-live">● داده‌های سامانه</span><button className="button" type="button" onClick={load} disabled={loading}>{loading?"در حال بروزرسانی…":"بروزرسانی"}</button></div></div>
    <section className="panel analytics-filter"><div className="filter-heading"><div><b>بازه زمانی تحلیل</b><small>{updatedAt?"آخرین بروزرسانی "+updatedAt:"برای مشاهده آمار، بازه را انتخاب کنید"}</small></div><div className="range-tabs">{[["7","۷ روز"],["30","۳۰ روز"],["90","۹۰ روز"],["all","همه"],["custom","دلخواه"]].map(([v,l])=><button key={v} type="button" className={range===v?"active":""} onClick={()=>setRange(v)}>{l}</button>)}</div></div>
    {range==="custom"&&<div className="custom-range"><label>از تاریخ<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>تا تاریخ<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="button" type="button" onClick={load} disabled={loading}>اعمال بازه</button></div>}</section>
    {error&&<div className="error" role="alert">{error}</div>}
    {!data&&!error?<section className="panel empty-state">در حال دریافت و محاسبه آمار…</section>:data&&<>
      <div className="analytics-kpis">
        <article className="analytics-kpi"><span>کل گزارش‌ها</span><strong>{fmt(data.total??0)}</strong><small>در بازه انتخاب‌شده</small></article>
        <article className="analytics-kpi pending"><span>در انتظار بررسی</span><strong>{fmt(pending)}</strong><small>نیازمند اقدام</small></article>
        <article className="analytics-kpi approved"><span>تأیید شده</span><strong>{fmt(approved)}</strong><small>گزارش‌های پذیرفته‌شده</small></article>
        <article className="analytics-kpi rejected"><span>رد شده</span><strong>{fmt(rejected)}</strong><small>گزارش‌های ردشده</small></article>
      </div>
      <div className="analytics-grid">
        <section className="panel analytics-trend"><div className="panel-title"><div><span className="panel-eyebrow">REPORT TREND</span><h2>روند ثبت گزارش‌ها</h2></div><span className="kpi-inline">{fmt(days.reduce((n,d)=>n+d.count,0))} گزارش</span></div>
          {days.length===0?<div className="empty-state">در این بازه گزارشی ثبت نشده است.</div>:<div className="analytics-bars">{days.map(d=><div className="analytics-bar-col" key={d.date} title={d.date+" · "+fmt(d.count)}><b>{d.count?fmt(d.count):""}</b><i style={{height:Math.max(5,d.count/maxDay*150)}}/><small>{d.label}</small></div>)}</div>}
        </section>
        <section className="panel analytics-review"><div className="panel-title"><div><span className="panel-eyebrow">REVIEW STATUS</span><h2>وضعیت رسیدگی</h2></div></div>
          <div className="review-ring" style={{background:`conic-gradient(#159d73 0% ${data.total?approved/data.total*100:0}%, #e6a23c ${data.total?approved/data.total*100:0}% ${data.total?(approved+pending)/data.total*100:0}%, #d66b78 ${data.total?(approved+pending)/data.total*100:0}% 100%)`}}><div><strong>{reviewRate}٪</strong><small>رسیدگی‌شده</small></div></div>
          <div className="review-legend"><span><i className="approved-dot"/>تأیید شده <b>{fmt(approved)}</b></span><span><i className="pending-dot"/>در انتظار <b>{fmt(pending)}</b></span><span><i className="rejected-dot"/>رد شده <b>{fmt(rejected)}</b></span></div>
        </section>
      </div>
      <section className="panel analytics-ranking"><div className="panel-title"><div><span className="panel-eyebrow">AREA PERFORMANCE</span><h2>مقایسه عملکرد حوزه‌ها</h2></div><button className="small-btn" type="button" onClick={exportCsv}>خروجی اکسل‌خوان (CSV) ↓</button></div>
        {areas.length===0?<div className="empty-state">در این بازه گزارشی برای مقایسه وجود ندارد.</div>:areas.map((area,index)=><div className="analytics-rank-row" key={area.name}><b className="rank-number">{fmt(index+1)}</b><span>{area.name}</span><div className="bar"><i style={{width:(area.count/maxArea*100)+"%"}}/></div><strong>{fmt(area.count)}</strong></div>)}
      </section>
    </>}
  </main></AppShell>;
}
