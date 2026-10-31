"use client";

import AppShell from "@/app/components/AppShell";
import {useEffect,useMemo,useState} from "react";

type Force={id:string;user_code:string;display_name:string;is_active:boolean;created_at:string};
type Area={id:string;name:string;code:string|null;is_active:boolean;forces:Force[]};

export default function ForcesPage(){
  const [areas,setAreas]=useState<Area[]>([]);
  const [selected,setSelected]=useState("");
  const [canCreate,setCanCreate]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [form,setForm]=useState({user_code:"",display_name:"",password:""});
  const selectedArea=useMemo(()=>areas.find(a=>a.id===selected)??null,[areas,selected]);

  async function load(keepSelection=true){
    const r=await fetch("/api/forces",{cache:"no-store"});
    const d=await r.json();
    if(!r.ok)throw new Error(d.message||"دریافت نیروها انجام نشد.");
    setAreas(d.areas??[]);
    setCanCreate(Boolean(d.can_create));
    if(!keepSelection||!selected)setSelected(d.areas?.[0]?.id??"");
    else if(!(d.areas??[]).some((a:Area)=>a.id===selected))setSelected(d.areas?.[0]?.id??"");
    setLoading(false);
  }
  useEffect(()=>{load(false).catch(e=>{setError(e.message);setLoading(false)})},[]);

  async function createForce(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!selectedArea||saving)return;
    setSaving(true);setError("");setNotice("");
    try{
      const r=await fetch("/api/forces",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,area_id:selectedArea.id})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"ایجاد نیرو انجام نشد.");
      setForm({user_code:"",display_name:"",password:""});
      setNotice("حساب نیرو با موفقیت ایجاد و به حوزه متصل شد.");
      await load();
    }catch(e:any){setError(e.message||"ایجاد نیرو انجام نشد.")}
    finally{setSaving(false)}
  }

  return <AppShell><main className="shell unified-page">
    <div className="topbar"><div><span className="eyebrow">ساختار نیروی انسانی</span><h1>نیروها</h1><p>فهرست نیروهای ثبت‌شده به تفکیک حوزه</p></div><div className="header-live">{areas.reduce((n,a)=>n+a.forces.length,0).toLocaleString("fa-IR")} نیرو</div></div>
    {notice&&<div className="notice">{notice}</div>}{error&&<div className="error">{error}</div>}
    {loading?<section className="panel">در حال دریافت اطلاعات نیروها…</section>:areas.length===0?<section className="panel empty-state">حوزه‌ای برای نمایش در دسترس نیست.</section>:<>
      <section className="force-area-grid">
        {areas.map((a,i)=><button type="button" key={a.id} className={"force-area-card"+(selected===a.id?" selected":"")} onClick={()=>{setSelected(a.id);setError("");setNotice("")}}>
          <span className="force-area-index">{String(i+1).padStart(2,"0")}</span>
          <b>{a.name}</b><small>{a.code||"حوزه"}</small>
          <span className="force-area-count">{a.forces.length.toLocaleString("fa-IR")} نیرو <span>←</span></span>
        </button>)}
      </section>
      {selectedArea&&<section className="panel force-detail-panel">
        <div className="force-detail-heading"><div><span className="eyebrow">فهرست حوزه انتخاب‌شده</span><h2>{selectedArea.name}</h2><p>{selectedArea.forces.length.toLocaleString("fa-IR")} نیروی ثبت‌شده</p></div></div>
        {canCreate&&<form className="force-create-form" onSubmit={createForce}>
          <div className="form-step"><span>＋</span><div><b>ثبت نیروی جدید</b><small>این حساب فقط با نقش «نیروی حوزه» ساخته می‌شود.</small></div></div>
          <label>کد کاربری<input value={form.user_code} onChange={e=>setForm(x=>({...x,user_code:e.target.value}))} autoComplete="off" required placeholder="مثلاً FORCE001"/></label>
          <label>نام و نام خانوادگی<input value={form.display_name} onChange={e=>setForm(x=>({...x,display_name:e.target.value}))} required/></label>
          <label>رمز عبور<input type="password" minLength={8} value={form.password} onChange={e=>setForm(x=>({...x,password:e.target.value}))} autoComplete="new-password" required/><small>حداقل ۸ کاراکتر</small></label>
          <button className="button neon-button" disabled={saving||!form.user_code.trim()||!form.display_name.trim()||form.password.length<8}>{saving?"در حال ثبت…":"＋ ایجاد حساب نیروی حوزه"}</button>
        </form>}
        <div className="force-list">
          {selectedArea.forces.length===0?<div className="empty-state">هنوز نیرویی برای این حوزه ثبت نشده است.</div>:selectedArea.forces.map((f,i)=><article className="force-person-row" key={f.id}>
            <div className="avatar">{f.display_name?.slice(0,1)||"ن"}</div>
            <div className="force-person-info"><b>{f.display_name}</b><small>کد کاربری: {f.user_code}</small></div>
            <span className={f.is_active?"force-status active":"force-status"}>{f.is_active?"فعال":"غیرفعال"}</span>
            <span className="force-person-number">{(i+1).toLocaleString("fa-IR")}</span>
          </article>)}
        </div>
      </section>}
    </>}
  </main></AppShell>
}
