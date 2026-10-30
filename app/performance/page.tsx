"use client";
import AppShell from "@/app/components/AppShell";
import {useEffect,useMemo,useState} from "react";

type Ranking={id:string;name:string;score:number;missionAverage:number;reviewQuality:number;missionsCompleted:number;missionCount:number;reportCount:number;approved:number;pending:number;rejected:number;missionResults:any[]};
export default function PerformancePage(){
 const [rankings,setRankings]=useState<Ranking[]>([]),[summary,setSummary]=useState<any>({}),[scoring,setScoring]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [query,setQuery]=useState("");
 async function load(){setLoading(true);setError("");try{const r=await fetch("/api/performance",{cache:"no-store"}),d=await r.json();if(!r.ok)throw new Error(d.message||"دریافت رتبه‌بندی ناموفق بود.");setRankings(d.rankings??[]);setSummary(d.summary??{});setScoring(d.scoring??"");}catch(e:any){setError(e.message||"خطا در دریافت اطلاعات.");}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 const filtered=useMemo(()=>rankings.filter(x=>x.name.toLowerCase().includes(query.trim().toLowerCase())),[rankings,query]);
 const top=rankings[0];
 return <AppShell><main className="shell unified-page performance-page">
  <div className="topbar"><div><span className="eyebrow">PERFORMANCE INTELLIGENCE</span><h1>ارزیابی و رتبه‌بندی عملکرد</h1><p>مقایسه حوزه‌ها بر پایه داده‌های واقعی مأموریت‌ها و گزارش‌ها</p></div><button className="button" onClick={load} disabled={loading}>{loading?"در حال بروزرسانی…":"بروزرسانی آمار"}</button></div>
  {error&&<div className="error" role="alert">{error}</div>}
  <div className="performance-kpis"><article><small>حوزه‌های ارزیابی‌شده</small><strong>{Number(summary.areas??0).toLocaleString("fa-IR")}</strong></article><article><small>مأموریت‌های فعال</small><strong>{Number(summary.missions??0).toLocaleString("fa-IR")}</strong></article><article><small>میانگین امتیاز حوزه‌ها</small><strong>{Number(summary.average??0).toLocaleString("fa-IR")}٪</strong></article><article className="top-performer"><small>رتبه اول فعلی</small><strong>{top?.name??"—"}</strong><span>{top?top.score.toLocaleString("fa-IR")+"٪":"داده‌ای موجود نیست"}</span></article></div>
  <section className="panel performance-ranking"><div className="panel-title"><div><span className="panel-eyebrow">LIVE LEADERBOARD</span><h2>جدول رتبه‌بندی حوزه‌ها</h2></div><span className="kpi-inline">{filtered.length} حوزه</span></div>
   <div className="performance-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی نام حوزه…"/><span>امتیاز از ۱۰۰</span></div>
   {loading?<div className="empty-state">در حال محاسبه امتیازها…</div>:filtered.length===0?<div className="empty-state">حوزه‌ای برای نمایش پیدا نشد.</div>:<div className="performance-table-wrap"><table className="performance-table"><thead><tr><th>رتبه</th><th>حوزه</th><th>امتیاز کل</th><th>تحقق مأموریت</th><th>کیفیت رسیدگی</th><th>گزارش‌ها</th></tr></thead><tbody>{filtered.map((a,i)=><tr key={a.id}><td><span className={"performance-rank rank-"+(rankings.indexOf(a)+1)}>{(rankings.indexOf(a)+1).toLocaleString("fa-IR")}</span></td><td><b>{a.name}</b></td><td><strong className="performance-score">{a.score.toLocaleString("fa-IR")}٪</strong><div className="performance-meter"><i style={{width:Math.min(100,a.score)+"%"}}/></div></td><td>{a.missionAverage.toLocaleString("fa-IR")}٪ <small>({a.missionsCompleted}/{a.missionCount})</small></td><td>{a.reviewQuality.toLocaleString("fa-IR")}٪</td><td>{a.reportCount.toLocaleString("fa-IR")} <small>· تأیید {a.approved.toLocaleString("fa-IR")} · انتظار {a.pending.toLocaleString("fa-IR")}</small></td></tr>)}</tbody></table></div>}
  </section>
  <section className="panel performance-method"><h2>روش محاسبه امتیاز</h2><p>{scoring}</p><div><span><b>۸۰٪</b> تحقق مأموریت‌ها</span><span><b>۲۰٪</b> کیفیت رسیدگی گزارش‌ها</span></div><small>درصد تحقق هر مأموریت حداکثر ۱۰۰٪ در امتیاز کل لحاظ می‌شود. حوزه بدون مأموریت فعال با داده‌های رسیدگی گزارش‌ها سنجیده می‌شود.</small></section>
 </main></AppShell>;
}
