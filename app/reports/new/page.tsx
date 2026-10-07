"use client";
import AppShell from "@/app/components/AppShell";
import {FormEvent,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";

type Group={id:string;name:string};
type Category={id:string;name:string;group_id:string;is_active:boolean};

export default function NewReport(){
  const router=useRouter();
  const[areas,setAreas]=useState<any[]>([]);
  const[groups,setGroups]=useState<Group[]>([]);
  const[cats,setCats]=useState<Category[]>([]);
  const[title,setTitle]=useState("");
  const[body,setBody]=useState("");
  const[area,setArea]=useState("");
  const[group,setGroup]=useState("");
  const[category,setCategory]=useState("");
  const[files,setFiles]=useState<File[]>([]);
  const[error,setError]=useState("");
  const[loading,setLoading]=useState(false);

  useEffect(()=>{
    Promise.all([fetch("/api/areas").then(r=>r.json()),fetch("/api/categories").then(r=>r.json())])
      .then(([a,c])=>{
        setAreas(a.areas??[]);
        setGroups(c.groups??[]);
        setCats(c.categories??[]);
        if(c.groups?.[0])setGroup(c.groups[0].id);
      });
  },[]);

  const filteredCats=useMemo(()=>cats.filter(x=>x.group_id===group&&x.is_active),[cats,group]);

  useEffect(()=>{
    if(!filteredCats.some(x=>x.id===category))setCategory(filteredCats[0]?.id??"");
  },[group,filteredCats,category]);

  async function submit(e:FormEvent){
    e.preventDefault();
    setLoading(true);setError("");
    const r=await fetch("/api/reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,body,area_id:area,category_id:category})});
    const d=await r.json();
    if(!r.ok){setError(d.message??"ثبت انجام نشد.");setLoading(false);return}
    for(const file of files){
      const f=new FormData();f.append("file",file);f.append("kind","report");f.append("report_id",d.id);
      const up=await fetch("/api/upload",{method:"POST",body:f});
      if(!up.ok){const ud=await up.json();setError("گزارش ثبت شد، اما یکی از فایل‌ها بارگذاری نشد: "+(ud.message??"خطای فایل"));setLoading(false);return}
    }
    router.push("/reports");
  }

  return <AppShell><main className="shell unified-page">
    <div className="topbar"><div><span className="eyebrow">راهبرد شوشتر · ثبت عملیاتی</span><h1>ثبت گزارش جدید</h1><p>ابتدا بخش اصلی، سپس زیرمجموعه گزارش را انتخاب کنید.</p></div></div>
    <form className="form-panel neon-form" onSubmit={submit}>
      <div className="form-step"><span>۰۱</span><div><b>انتخاب بخش</b><small>گزارش متعلق به کدام بخش است؟</small></div></div>
      <label>بخش اصلی
        <select value={group} onChange={e=>setGroup(e.target.value)} required>
          <option value="">انتخاب بخش</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}
        </select>
      </label>
      <label>زیرمجموعه
        <select value={category} onChange={e=>setCategory(e.target.value)} disabled={!group||!filteredCats.length} required>
          <option value="">ابتدا بخش را انتخاب کنید</option>{filteredCats.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div className="form-step"><span>۰۲</span><div><b>حوزه گزارش</b><small>گزارش مربوط به کدام حوزه است؟</small></div></div>
      <label>حوزه
        <select value={area} onChange={e=>setArea(e.target.value)} required>
          <option value="">انتخاب حوزه</option>{areas.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}
        </select>
      </label>
      <div className="form-step"><span>۰۳</span><div><b>محتوای گزارش</b><small>اطلاعات گزارش را کامل وارد کنید.</small></div></div>
      <label>عنوان گزارش<input value={title} onChange={e=>setTitle(e.target.value)} required/></label>
      <label>متن گزارش<textarea value={body} onChange={e=>setBody(e.target.value)} rows={10} required/></label>
      <label>فایل‌های پیوست<input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,.doc,.docx,.xls,.xlsx" onChange={e=>setFiles(Array.from(e.target.files??[]).slice(0,5))}/><small>حداکثر ۵ فایل؛ هر فایل حداکثر ۲۰ مگابایت. فایل‌ها خصوصی نگهداری می‌شوند.</small></label>
      {files.length>0&&<div className="selected-files">{files.map((f,i)=><div key={i}>{f.name} <span>{(f.size/1024/1024).toFixed(1)} MB</span></div>)}</div>}
      {error&&<div className="error">{error}</div>}
      <button className="button neon-button" disabled={loading}>{loading?"در حال ثبت و بارگذاری…":"ارسال گزارش"}</button>
    </form>
  </main></AppShell>
}