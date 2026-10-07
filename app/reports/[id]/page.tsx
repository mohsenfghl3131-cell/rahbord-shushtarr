"use client";
import AppShell from "@/app/components/AppShell";
import Link from "next/link";
import{useEffect,useState}from"react";
import{useParams}from"next/navigation";

const labels:any={approved:"تأیید شده",rejected:"رد شده",pending:"در انتظار بررسی"};

export default function ReportDetail(){
  const params=useParams<{id:string}>();
  const[report,setReport]=useState<any>(null);
  const[files,setFiles]=useState<any[]>([]);
  const[error,setError]=useState("");
  useEffect(()=>{fetch("/api/reports/"+params.id).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||"خطا");setReport(d.report);setFiles(d.files||[])}).catch(e=>setError(e.message))},[params.id]);
  async function openFile(file:any){
    const r=await fetch("/api/files/signed?bucket="+encodeURIComponent(file.storage_bucket)+"&path="+encodeURIComponent(file.storage_path));
    const d=await r.json();if(r.ok&&d.signed_url)window.open(d.signed_url,"_blank","noopener,noreferrer");else setError(d.message||"دسترسی به فایل ممکن نیست.");
  }
  return <AppShell><main className="shell unified-page">
    <div className="topbar"><div><span className="eyebrow">مرکز گزارش‌ها</span><h1>جزئیات کامل گزارش</h1></div><Link className="button ghost-button" href="/reports">بازگشت به گزارش‌ها</Link></div>
    {error&&<div className="error">{error}</div>}
    {!report&&!error?<section className="panel"><p>در حال دریافت گزارش…</p></section>:report&&<section className="report-detail neon-detail">
      <div className="detail-head"><div><span className={"status "+report.status}>{labels[report.status]||report.status}</span><h2>{report.title}</h2><div className="detail-meta"><span>حوزه: {report.areas?.name||"—"}</span><span>بخش: {report.categories?.category_groups?.name||"—"}</span><span>زیرمجموعه: {report.categories?.name||"—"}</span><span>{new Date(report.created_at).toLocaleString("fa-IR")}</span></div></div></div>
      <div className="detail-body"><h3>متن کامل گزارش</h3><p>{report.body}</p></div>
      {report.rejection_reason&&<div className="reject-reason">دلیل رد: {report.rejection_reason}</div>}
      {files.length>0&&<div className="detail-files"><h3>پیوست‌ها</h3>{files.map(f=><button className="file-chip" key={f.id} onClick={()=>openFile(f)}>▣ {f.original_name}</button>)}</div>}
    </section>}
  </main></AppShell>
}