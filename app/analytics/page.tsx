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


  const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char] || char));

  function exportPdf(){
    if(!data)return;
    const popup=window.open("","_blank","width=1100,height=850");
    if(!popup){setError("مرورگر اجازه باز شدن پنجره PDF را نداد؛ پنجره‌های بازشو را فعال کنید.");return;}
    const maxValue=Math.max(1,...days.map((day)=>day.count));
    const chartWidth=760, chartHeight=220, left=42, bottom=34, top=16;
    const slot=days.length?((chartWidth-left-12)/days.length):0;
    const barWidth=Math.max(3,Math.min(22,slot*.58));
    const bars=days.map((day,index)=>{
      const height=Math.max(day.count?3:0,(day.count/maxValue)*(chartHeight-top-bottom));
      const x=left+index*slot+(slot-barWidth)/2;
      const y=chartHeight-bottom-height;
      const showLabel=days.length<=14 || index%Math.ceil(days.length/10)===0 || index===days.length-1;
      return '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+barWidth.toFixed(1)+'" height="'+height.toFixed(1)+'" rx="4" fill="url(#barGradient)"><title>'+escapeHtml(day.label)+': '+escapeHtml(day.count)+'</title></rect>'+
        (showLabel?'<text x="'+(x+barWidth/2).toFixed(1)+'" y="'+(chartHeight-9)+'" text-anchor="middle" class="axis-label">'+escapeHtml(day.label)+'</text>':'');
    }).join("");
    const chartSvg='<svg class="trend-svg" viewBox="0 0 '+chartWidth+' '+chartHeight+'" role="img" aria-label="روند ثبت گزارش‌ها"><defs><linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#13b8e8"/><stop offset="100%" stop-color="#2858d8"/></linearGradient></defs>'+
      [0,1,2,3].map((line)=>'<line x1="'+left+'" x2="'+(chartWidth-8)+'" y1="'+(top+line*52)+'" y2="'+(top+line*52)+'" stroke="#e8eef5" stroke-dasharray="4 5"/>').join("")+
      bars+'</svg>';
    const total=data.total??0;
    const approvalPct=total?Math.round(approved/total*100):0;
    const pendingPct=total?Math.round(pending/total*100):0;
    const rejectedPct=total?Math.max(0,100-approvalPct-pendingPct):0;
    const statusGradient='conic-gradient(#12a879 0 '+approvalPct+'%,#e9a43b '+approvalPct+'% '+(approvalPct+pendingPct)+'%,#df6472 '+(approvalPct+pendingPct)+'% 100%)';
    const rankingRows=areas.length?areas.map((area,index)=>'<tr><td class="rank">'+fmt(index+1)+'</td><td>'+escapeHtml(area.name)+'</td><td><div class="mini-track"><i style="width:'+Math.max(0,area.count/maxArea*100)+'%"></i></div></td><td class="num">'+fmt(area.count)+'</td></tr>').join(""):'<tr><td colspan="4" class="empty">داده‌ای برای این بازه وجود ندارد.</td></tr>';
    const period=range==="custom"?(from||"ابتدا")+" تا "+(to||"امروز"):({ "7":"۷ روز گذشته","30":"۳۰ روز گذشته","90":"۹۰ روز گذشته","all":"تمام بازه‌ها" } as Record<string,string>)[range]||"بازه انتخاب‌شده";
    const generated=new Date().toLocaleString("fa-IR",{dateStyle:"long",timeStyle:"short"});
    const html='<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>گزارش تحلیلی راهبرد شوشتر</title><style>'+
      '@page{size:A4 portrait;margin:13mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#172b45;font-family:Vazirmatn,Tahoma,Arial,sans-serif;direction:rtl;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:100%;max-width:190mm;margin:auto}.hero{position:relative;overflow:hidden;border-radius:18px;padding:25px 28px;background:linear-gradient(120deg,#071c35,#123e68 65%,#087ea8);color:#fff}.hero:after{content:"";position:absolute;width:180px;height:180px;border:1px solid rgba(133,222,255,.25);border-radius:50%;left:-48px;top:-85px;box-shadow:0 0 0 18px rgba(130,220,255,.05),0 0 0 38px rgba(130,220,255,.04)}.brand{font-size:10px;letter-spacing:1px;color:#9feaff;font-weight:800}.hero h1{font-size:24px;margin:12px 0 5px}.hero p{font-size:10px;color:#d3e7f5;margin:0}.hero-meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:19px;color:#c2d9eb;font-size:9px}.section-title{display:flex;align-items:center;justify-content:space-between;margin:19px 0 10px}.section-title h2{font-size:13px;margin:0;color:#173653}.section-title span{font-size:8px;color:#8495a8}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.kpi{border:1px solid #e2ebf4;border-radius:12px;padding:13px 12px;background:linear-gradient(145deg,#fff,#f7fbff);min-height:83px}.kpi small{display:block;color:#7d8fa3;font-size:8px}.kpi strong{display:block;font-size:22px;margin-top:7px;color:#123c69}.kpi.pending strong{color:#c58a24}.kpi.approved strong{color:#11966c}.kpi.rejected strong{color:#ce5966}.grid{display:grid;grid-template-columns:1.35fr .85fr;gap:11px}.card{border:1px solid #e2ebf4;border-radius:13px;padding:14px;background:#fff;break-inside:avoid}.card h3{font-size:11px;margin:0 0 4px}.card .sub{font-size:8px;color:#8b9aab;margin:0 0 10px}.trend-svg{display:block;width:100%;height:auto;max-height:190px}.axis-label{font-size:9px;fill:#8798aa}.status-wrap{display:flex;align-items:center;gap:12px;min-height:150px}.ring{width:112px;height:112px;border-radius:50%;background:'+statusGradient+';display:grid;place-items:center;flex:0 0 112px;position:relative}.ring:after{content:"";width:78px;height:78px;border-radius:50%;background:#fff}.ring b{position:absolute;font-size:18px;color:#193d61}.legend{flex:1;display:grid;gap:10px}.legend div{display:flex;align-items:center;gap:6px;font-size:8px;color:#60758b}.legend b{margin-right:auto;color:#183754}.dot{width:7px;height:7px;border-radius:50%}.dot.a{background:#12a879}.dot.p{background:#e9a43b}.dot.r{background:#df6472}.ranking{width:100%;border-collapse:collapse;font-size:9px}.ranking th{text-align:right;color:#8192a5;font-size:8px;font-weight:600;padding:8px 7px;background:#f6f9fc}.ranking td{padding:8px 7px;border-bottom:1px solid #edf2f6}.ranking .rank{color:#8b9aac;width:28px}.ranking .num{font-weight:800;color:#174d85}.mini-track{height:6px;background:#edf2f7;border-radius:9px;overflow:hidden;min-width:55px}.mini-track i{height:100%;display:block;background:linear-gradient(90deg,#11b8e6,#315ce0);border-radius:9px}.empty{text-align:center;color:#91a0b0;padding:18px!important}.footer{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e5edf4;margin-top:17px;padding-top:9px;color:#8c9bab;font-size:8px}.footer b{color:#315a7d}.note{margin-top:10px;color:#91a0ae;font-size:7px}@media print{body{background:#fff}.page{max-width:none}.hero,.kpi,.card{break-inside:avoid}.no-print{display:none!important}}@media(max-width:700px){.kpis{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}}'+
      '</style><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"></head><body><main class="page">'+
      '<header class="hero"><div class="brand">RAHBORD SHUSHTAR · COMMAND CENTER</div><h1>گزارش تحلیلی سامانه راهبرد</h1><p>نمای کلی عملکرد، روند ثبت گزارش‌ها و وضعیت رسیدگی</p><div class="hero-meta"><span>بازه گزارش: '+escapeHtml(period)+'</span><span>تاریخ تهیه: '+escapeHtml(generated)+'</span></div></header>'+
      '<div class="section-title"><h2>شاخص‌های کلیدی</h2><span>KEY PERFORMANCE INDICATORS</span></div><section class="kpis">'+
      '<article class="kpi"><small>کل گزارش‌ها</small><strong>'+fmt(total)+'</strong></article><article class="kpi pending"><small>در انتظار بررسی</small><strong>'+fmt(pending)+'</strong></article><article class="kpi approved"><small>تأیید شده</small><strong>'+fmt(approved)+'</strong></article><article class="kpi rejected"><small>رد شده</small><strong>'+fmt(rejected)+'</strong></article></section>'+
      '<div class="section-title"><h2>تحلیل روند و رسیدگی</h2><span>ANALYTICS OVERVIEW</span></div><section class="grid"><article class="card"><h3>روند ثبت گزارش‌ها</h3><p class="sub">تغییرات تعداد گزارش‌های ثبت‌شده در بازه انتخابی</p>'+chartSvg+'</article>'+
      '<article class="card"><h3>وضعیت رسیدگی</h3><p class="sub">سهم هر وضعیت از کل گزارش‌ها</p><div class="status-wrap"><div class="ring"><b>'+fmt(reviewRate)+'٪</b></div><div class="legend"><div><i class="dot a"></i>تأیید شده <b>'+fmt(approved)+'</b></div><div><i class="dot p"></i>در انتظار <b>'+fmt(pending)+'</b></div><div><i class="dot r"></i>رد شده <b>'+fmt(rejected)+'</b></div></div></div></article></section>'+
      '<div class="section-title"><h2>مقایسه عملکرد حوزه‌ها</h2><span>AREA PERFORMANCE</span></div><section class="card"><table class="ranking"><thead><tr><th>رتبه</th><th>حوزه</th><th>میزان نسبی</th><th>تعداد گزارش</th></tr></thead><tbody>'+rankingRows+'</tbody></table></section>'+
      '<footer class="footer"><span><b>راهبرد شوشتر</b> · مرکز پایش و تصمیم‌گیری</span><span>گزارش تولیدشده از داده‌های سامانه</span></footer><p class="note">این گزارش بر اساس اطلاعات موجود در زمان تهیه خروجی تولید شده است.</p>'+
      '<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print()},700)});window.addEventListener("afterprint",function(){window.close()});<\/script></main></body></html>';
    popup.document.open();popup.document.write(html);popup.document.close();
  }

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
      <section className="panel analytics-ranking"><div className="panel-title"><div><span className="panel-eyebrow">AREA PERFORMANCE</span><h2>مقایسه عملکرد حوزه‌ها</h2></div><div className="analytics-export-actions"><button className="small-btn pdf-export-btn" type="button" onClick={exportPdf}>⬇ دریافت گزارش حرفه‌ای PDF</button><button className="small-btn" type="button" onClick={exportCsv}>خروجی اکسل‌خوان (CSV) ↓</button></div></div>
        {areas.length===0?<div className="empty-state">در این بازه گزارشی برای مقایسه وجود ندارد.</div>:areas.map((area,index)=><div className="analytics-rank-row" key={area.name}><b className="rank-number">{fmt(index+1)}</b><span>{area.name}</span><div className="bar"><i style={{width:(area.count/maxArea*100)+"%"}}/></div><strong>{fmt(area.count)}</strong></div>)}
      </section>
    </>}
  </main></AppShell>;
}
