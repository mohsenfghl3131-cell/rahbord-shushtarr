"use client";

import AppShell from "@/app/components/AppShell";
import Link from "next/link";
import {useEffect,useState} from "react";

type Area={id:string;name:string;code:string|null;description:string|null;is_active:boolean};
const empty={name:"",code:"",description:""};

export default function Areas(){
  const [areas,setAreas]=useState<Area[]>([]);
  const [canManage,setCanManage]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState<string|null>(null);

  async function load(){
    setError("");
    const r=await fetch("/api/areas");
    const d=await r.json();
    if(!r.ok)throw new Error(d.message||"دریافت حوزه‌ها انجام نشد.");
    setAreas(d.areas??[]);
    setCanManage(Boolean(d.can_manage));
    setLoading(false);
  }
  useEffect(()=>{load().catch(e=>{setError(e.message);setLoading(false)})},[]);

  function startEdit(a:Area){
    setEditing(a.id);
    setForm({name:a.name,code:a.code??"",description:a.description??""});
    setNotice("");setError("");
  }
  function cancel(){setEditing(null);setForm(empty)}
  async function save(e:any){
    e.preventDefault();setSaving(true);setError("");setNotice("");
    const url=editing?"/api/areas/"+editing:"/api/areas";
    const r=await fetch(url,{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    const d=await r.json();
    if(!r.ok){setError(d.message||"ذخیره حوزه انجام نشد.");setSaving(false);return}
    setNotice(editing?"اطلاعات حوزه به‌روزرسانی شد.":"حوزه جدید ایجاد شد.");
    cancel();await load();setSaving(false);
  }
  async function toggle(a:Area){
    const next=!a.is_active;
    if(!confirm(next?"این حوزه فعال شود؟":"این حوزه غیرفعال شود؟"))return;
    setError("");setNotice("");
    const r=await fetch("/api/areas/"+a.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:next})});
    const d=await r.json();
    if(!r.ok){setError(d.message||"تغییر وضعیت انجام نشد.");return}
    setNotice("وضعیت حوزه تغییر کرد.");await load();
  }

  return <AppShell><main className="shell unified-page">
    <div className="topbar"><div><span className="eyebrow">ساختار عملیاتی راهبرد</span><h1>مدیریت حوزه‌ها</h1><p>تعریف حوزه‌ها و کنترل وضعیت فعالیت آن‌ها</p></div><div className="header-live">{areas.length.toLocaleString("fa-IR")} حوزه</div></div>
    {notice&&<div className="notice">{notice}</div>}{error&&<div className="error">{error}</div>}
    {canManage&&<form className="form-panel" onSubmit={save} style={{marginTop:18}}>
      <div className="form-step"><span>＋</span><div><b>{editing?"ویرایش حوزه":"افزودن حوزه جدید"}</b><small>نام حوزه الزامی است؛ کد و توضیحات اختیاری هستند.</small></div></div>
      <label>نام حوزه<input value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} required maxLength={150}/></label>
      <label>کد حوزه<input value={form.code} onChange={e=>setForm(x=>({...x,code:e.target.value}))} maxLength={40} placeholder="مثلاً C-01"/></label>
      <label>توضیحات<textarea rows={2} value={form.description} onChange={e=>setForm(x=>({...x,description:e.target.value}))} maxLength={500}/></label>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="button neon-button" disabled={saving||!form.name.trim()}>{saving?"در حال ذخیره…":editing?"ذخیره تغییرات":"ایجاد حوزه"}</button>{editing&&<button type="button" className="small-btn" onClick={cancel}>انصراف</button>}</div>
    </form>}
    <section className="area-grid" style={{marginTop:20}}>
      {loading?<div className="panel">در حال دریافت حوزه‌ها…</div>:areas.length===0?<div className="panel empty-state">حوزه‌ای برای نمایش وجود ندارد.</div>:areas.map((a,i)=><article className="area-card" key={a.id}>
        <span>{String(i+1).padStart(2,"0")}</span><div style={{minWidth:0,flex:1}}><b>{a.name}</b><small>{a.code||"بدون کد"} · {a.is_active?"فعال":"غیرفعال"}</small>{a.description&&<small>{a.description}</small>}<Link className="area-subchart-link" href={"/organization/"+a.id}>مدیریت چارت فرعی و مسئولان پایگاه‌ها ←</Link></div>
        {canManage&&<div className="user-actions"><button className="small-btn" onClick={()=>startEdit(a)}>ویرایش</button><button className="small-btn" onClick={()=>toggle(a)}>{a.is_active?"غیرفعال‌سازی":"فعال‌سازی"}</button></div>}
      </article>)}
    </section>
  </main></AppShell>
}
