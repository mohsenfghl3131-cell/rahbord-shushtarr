"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
type Base={id:string;title:string;leader_name?:string};
type Area={id:string;title:string;leader_name?:string;bases:Base[]};
export default function AreaDetailPage({params}:{params:Promise<{areaId:string}>}){
 const [areaId,setAreaId]=useState(""),[area,setArea]=useState<Area|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;Promise.resolve(params).then(p=>{if(active)setAreaId(p.areaId)});return()=>{active=false}},[params]);
 useEffect(()=>{if(!areaId)return;let active=true;fetch("/api/organization").then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||"دریافت اطلاعات انجام نشد");const found=(d.chart?.areas||[]).find((a:Area)=>a.id===areaId);if(!found)throw Error("حوزه موردنظر پیدا نشد.");if(active)setArea({...found,bases:Array.isArray(found.bases)?found.bases:[]})}).catch(e=>{if(active)setError(e.message||"خطا در دریافت اطلاعات")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[areaId]);
 return <main className="shell org-page org-area-detail-page">
  <div className="org-detail-toolbar"><Link href="/organization" className="org-back-link">← بازگشت به چارت سازمانی</Link><span>RAHBORD • SHUSHTAR</span></div>
  {loading?<section className="panel org-detail-loading">در حال دریافت اطلاعات حوزه…</section>:error?<section className="panel org-detail-error"><h1>دریافت اطلاعات ممکن نشد</h1><p>{error}</p><Link href="/organization" className="button">بازگشت به چارت</Link></section>:area?<>
   <section className="org-detail-hero"><div className="org-detail-kicker">ساختار حوزه / پایگاه‌ها</div><div className="org-detail-mark">ح</div><h1>{area.title}</h1><p>فهرست پایگاه‌های زیرمجموعه و مسئول هر پایگاه</p><div className="org-detail-leader"><span>مسئول حوزه</span><strong>{area.leader_name?.trim()||"تعیین نشده"}</strong></div><div className="org-detail-stats"><div><strong>{area.bases.length}</strong><span>پایگاه ثبت‌شده</span></div><div><strong>{area.bases.filter(b=>b.leader_name?.trim()).length}</strong><span>مسئول تعیین‌شده</span></div></div></section>
   <section className="org-detail-section"><div className="org-detail-section-head"><div><span>زیرمجموعه‌ها</span><h2>پایگاه‌های این حوزه</h2></div><small>{area.bases.length} مورد</small></div>
   {area.bases.length?<div className="org-detail-base-grid">{area.bases.map((b,i)=><article className="org-detail-base-card" key={b.id}><div className="org-base-number">{String(i+1).padStart(2,"0")}</div><div className="org-base-icon">⌂</div><h3>{b.title}</h3><div className="org-base-leader-label">مسئول پایگاه</div><strong className="org-base-leader-name">{b.leader_name?.trim()||"تعیین نشده"}</strong></article>)}</div>:<div className="org-detail-empty"><div>⌂</div><h3>هنوز پایگاهی ثبت نشده است</h3><p>برای افزودن پایگاه و ثبت مسئول آن، از بخش ویرایش چارت سازمانی استفاده کنید.</p><Link href="/organization" className="button">رفتن به ویرایش چارت</Link></div>}
   </section>
   <div className="org-detail-footer"><Link href="/organization">بازگشت به فهرست حوزه‌ها</Link><span>سامانه مدیریت و پایش • راهبرد شوشتر</span></div>
  </>:null}
 </main>
}
