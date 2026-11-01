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
  async function downloadFile(file:any){
    try{
      const r=await fetch("/api/files/signed?download=1&bucket="+encodeURIComponent(file.storage_bucket)+"&path="+encodeURIComponent(file.storage_path));
      const d=await r.json();
      if(!r.ok||!d.signed_url)throw new Error(d.message||"دسترسی به فایل ممکن نیست.");
      const link=document.createElement("a");link.href=d.signed_url;link.rel="noopener";link.download=file.original_name||"report-attachment";document.body.appendChild(link);link.click();link.remove();
    }catch(e:any){setError(e.message||"دانلود فایل انجام نشد.");}
  }
  return <AppShell><main className="shell unified-page">
    <div className="topbar"><div><span className="eyebrow">مرکز گزارش‌ها</span><h1>جزئیات کامل گزارش</h1></div><Link className="button ghost-button" href="/reports">بازگشت به گزارش‌ها</Link></div>
    {error&&<div className="error">{error}</div>}
    {!report&&!error?<section className="panel"><p>در حال دریافت گزارش…</p></section>:report&&<section className="report-detail neon-detail">
      <div className="detail-head"><div><span className={"status "+report.status}>{labels[report.status]||report.status}</span><h2>{report.title}</h2><div className="detail-meta"><span>حوزه: {report.areas?.name||"—"}</span><span>بخش: {report.categories?.category_groups?.name||"—"}</span><span>زیرمجموعه: {report.categories?.name||"—"}</span><span>{new Date(report.created_at).toLocaleString("fa-IR")}</span></div></div></div>
      <div className="detail-body"><h3>متن کامل گزارش</h3><p>{report.body}</p></div>
      {report.rejection_reason&&<div className="reject-reason">دلیل رد: {report.rejection_reason}</div>}
      {files.length>0&&<section className="detail-files report-download-panel">
        <div className="report-download-heading"><div><span className="eyebrow">فایل‌های ضمیمه گزارش</span><h3>دانلود تصاویر و پیوست‌ها</h3><p>{files.length} فایل برای دریافت در این گزارش ثبت شده است.</p></div><span className="download-count">{files.length} فایل</span></div>
        <div className="report-download-list">{files.map(f=><div className="report-download-item" key={f.id}>
          <div className="report-download-file-icon">⇩</div><div className="report-download-file-info"><strong>{f.original_name}</strong><small>{f.mime_type||"فایل پیوست"}{f.size_bytes? " · "+(f.size_bytes/1024/1024).toFixed(2)+" مگابایت":""}</small></div>
          <button type="button" className="button report-download-button" onClick={()=>downloadFile(f)}>⬇ دانلود فایل</button>
        </div>)}</div>
      </section>}
    </section>}
  </main></AppShell>
}