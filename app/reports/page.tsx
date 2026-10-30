"use client";

import AppShell from "@/app/components/AppShell";
import {useEffect,useState} from "react";
import Link from "next/link";

function isTestReport(title:string){
  return /(^|[\\sـ])(?:تست|آزمایشی|test)(?:$|[\\sـ])/i.test((title||"").trim());
}

export default function Reports(){
  const [reports,setReports]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [reason,setReason]=useState("");
  const [rejectId,setRejectId]=useState("");
  const [reviewAllowed,setReviewAllowed]=useState(false);
  const [mainAdmin,setMainAdmin]=useState(false);
  const [deletingId,setDeletingId]=useState("");

  async function loadReports(){
    const [reportsResponse,meResponse]=await Promise.all([fetch("/api/reports",{cache:"no-store"}),fetch("/api/me",{cache:"no-store"})]);
    const [r,m]=await Promise.all([reportsResponse.json(),meResponse.json()]);
    if(!reportsResponse.ok)throw new Error(r.message||"دریافت گزارش‌ها انجام نشد.");
    setReports(r.reports??[]);
    setReviewAllowed(Boolean(m.can_review));
    setMainAdmin(m.profile?.role==="main_admin");
  }

  useEffect(()=>{
    loadReports().catch(e=>setMessage(e.message||"دریافت گزارش‌ها انجام نشد.")).finally(()=>setLoading(false));
  },[]);

  async function review(id:string,status:"approved"|"rejected"){
    if(status==="rejected"&&!reason.trim()){setMessage("برای رد گزارش دلیل وارد کنید.");return;}
    const r=await fetch("/api/reports/"+id+"/review",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status,rejection_reason:reason})});
    const d=await r.json();
    if(!r.ok){setMessage(d.message??"عملیات انجام نشد.");return;}
    setReports(xs=>xs.map(x=>x.id===id?{...x,status}:x));
    setRejectId("");setReason("");setMessage("وضعیت گزارش با موفقیت ثبت شد.");
  }

  async function deleteTestReport(report:any){
    if(!mainAdmin||!isTestReport(report.title)||deletingId)return;
    const accepted=window.confirm("گزارش تست «"+report.title+"» حذف شود؟ این گزارش از فهرست خارج می‌شود و مدیر سامانه می‌تواند از طریق پشتیبانی پایگاه داده آن را بازیابی کند.");
    if(!accepted)return;
    setDeletingId(report.id);setMessage("");
    try{
      const response=await fetch("/api/reports/"+report.id,{method:"DELETE"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"حذف گزارش انجام نشد.");
      setReports(xs=>xs.filter(x=>x.id!==report.id));
      setMessage("گزارش تست با موفقیت از فهرست حذف شد.");
    }catch(e:any){setMessage(e.message||"حذف گزارش انجام نشد.");}
    finally{setDeletingId("");}
  }

  return <AppShell><main className="shell unified-page">
    <div className="topbar"><div><span className="eyebrow">راهبرد شوشتر</span><h1>گزارش‌ها</h1></div><Link className="button" href="/reports/new">＋ ثبت گزارش</Link></div>
    {message&&<div className="notice" role="status">{message}</div>}
    <section className="panel" style={{marginTop:18}}>
      {loading?<p>در حال دریافت گزارش‌ها…</p>:<div className="report-table">
        {reports.length===0?<div className="empty-state">گزارشی برای نمایش وجود ندارد.</div>:reports.map(r=><article className="report-card" key={r.id}>
          <div><h3>{r.title} {isTestReport(r.title)&&<span className="status rejected">تست</span>}</h3>
            <p>{(r.body||"").slice(0,180)}{(r.body||"").length>180?"…":""}</p>
            <small>{r.areas?.name??"—"} · {r.categories?.category_groups?.name??"—"} · {r.categories?.name??"—"} · {new Date(r.created_at).toLocaleDateString("fa-IR")}</small>
            <Link className="small-btn detail-btn" href={"/reports/"+r.id}>مشاهده کامل</Link>
            {r.status==="rejected"&&r.rejection_reason&&<small className="reject-reason">دلیل رد: {r.rejection_reason}</small>}
          </div>
          <div className="report-actions">
            <span className={"status "+r.status}>{r.status==="approved"?"تأیید شده":r.status==="rejected"?"رد شده":"در حال بررسی"}</span>
            {reviewAllowed&&r.status==="pending"&&<div className="action-stack">
              {rejectId===r.id&&<input className="reason-input" placeholder="دلیل رد" value={reason} onChange={e=>setReason(e.target.value)}/>}
              <div><button className="small-btn green-btn" onClick={()=>review(r.id,"approved")}>تأیید</button><button className="small-btn red-btn" onClick={()=>{if(rejectId===r.id)review(r.id,"rejected");else setRejectId(r.id)}}>رد</button></div>
            </div>}
            {mainAdmin&&isTestReport(r.title)&&<button className="small-btn red-btn" disabled={deletingId===r.id} onClick={()=>deleteTestReport(r)}>{deletingId===r.id?"در حال حذف…":"حذف گزارش تست"}</button>}
          </div>
        </article>)}
      </div>}
    </section>
  </main></AppShell>;
}