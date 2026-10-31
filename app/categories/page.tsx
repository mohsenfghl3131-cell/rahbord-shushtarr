"use client";
import AppShell from "@/app/components/AppShell";
import{useEffect,useState}from"react";

export default function Categories(){
 const[groups,setGroups]=useState<any[]>([]);
 const[cats,setCats]=useState<any[]>([]);
 const[users,setUsers]=useState<any[]>([]);
 const[e,setE]=useState("");
 const[form,setForm]=useState({name:"",group_id:"",sort_order:0});
 const[canManage,setCanManage]=useState(false);
 const[busy,setBusy]=useState("");

 async function load(){
  setE("");
  const [r,me]=await Promise.all([fetch("/api/categories"),fetch("/api/me")]);const d=await r.json();const md=await me.json();
  setCanManage(["main_admin","deputy","battalion_commander"].includes(md.profile?.role));
  if(!r.ok){setE(d.message||"دسترسی ندارید.");return}
  setGroups(d.groups||[]);setCats(d.categories||[]);
  if(!form.group_id&&d.groups?.[0])setForm(x=>({...x,group_id:d.groups[0].id}));
  if(["main_admin","deputy","battalion_commander"].includes(md.profile?.role)){const u=await fetch("/api/users");if(u.ok){const ud=await u.json();setUsers(ud.users||[])}}
 }
 useEffect(()=>{load()},[]);

 async function add(ev:any){
  ev.preventDefault();setE("");
  const r=await fetch("/api/categories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
  const d=await r.json();if(!r.ok){setE(d.message||"ثبت نشد.");return}
  setForm(x=>({...x,name:""}));load();
 }
 async function toggle(x:any){
  const r=await fetch("/api/categories/"+x.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:!x.is_active})});
  if(!r.ok){const d=await r.json();setE(d.message||"عملیات انجام نشد.");return}load();
 }
 async function assign(groupId:string,userIds:string[]){
  setE("");setBusy(groupId);
  setGroups(old=>old.map(g=>g.id===groupId?{...g,responsible_user_ids:userIds}:g));
  const r=await fetch("/api/category-groups/"+groupId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({responsible_user_ids:userIds})});
  const d=await r.json();if(!r.ok){setE(d.message||"تعیین مسئولان انجام نشد.");setBusy("");return}
  setGroups(old=>old.map(g=>g.id===groupId?{...g,responsible_user_ids:d.responsible_user_ids}:g));
  setBusy("");
 }
 function toggleResponsible(g:any,userId:string){
  const current:string[]=g.responsible_user_ids||[];
  const next=current.includes(userId)?current.filter(x=>x!==userId):[...current,userId];
  assign(g.id,next);
 }

 return <AppShell><main className="shell unified-page">
  <div className="topbar"><div><span className="eyebrow">ساختار گزارش‌دهی</span><h1>بخش‌ها و زیرمجموعه‌ها</h1><p>برای هر مسئولیت می‌توانید چند کاربر فعال تعیین کنید؛ همه مسئولان انتخاب‌شده گزارش‌های همان بخش را می‌بینند و بررسی می‌کنند.</p></div></div>
  {e&&<div className="error">{e}</div>}
  {canManage&&<section className="section-manager-grid">
   {groups.map(g=><article className="section-manager-card" key={g.id}>
    <div><span className="section-glow">◈</span><div><small>بخش گزارش</small><h2>{g.name}</h2></div></div>
    <div className="responsible-multi-picker"><b>مسئولان این بخش</b><small>هر تعداد مسئول لازم است انتخاب کنید.</small>
     <div className="area-access-options">{users.filter(u=>u.is_active).map(u=><label key={u.id} className="area-access-option">
      <input type="checkbox" checked={(g.responsible_user_ids||[]).includes(u.id)} disabled={busy===g.id} onChange={()=>toggleResponsible(g,u.id)}/>
      <span>{u.display_name} · {u.user_code}</span>
     </label>)}</div>
     <small>{(g.responsible_user_ids||[]).length.toLocaleString("fa-IR")} مسئول انتخاب شده</small>
    </div>
    <div className="section-cats">{cats.filter(c=>c.group_id===g.id&&c.is_active).map(c=><span key={c.id}>{c.name}</span>)}</div>
   </article>)}
  </section>}
  {canManage&&<form className="form-panel" onSubmit={add}><div className="form-step"><span>＋</span><div><b>افزودن زیرمجموعه</b><small>دسته‌بندی جدید را به یکی از بخش‌ها اضافه کنید.</small></div></div><label>نام زیرمجموعه<input value={form.name} onChange={x=>setForm({...form,name:x.target.value})} required/></label><label>بخش<select value={form.group_id} onChange={x=>setForm({...form,group_id:x.target.value})}>{groups.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>{e&&<div className="error">{e}</div>}<button className="button neon-button">افزودن زیرمجموعه</button></form>}
  <section className="panel" style={{marginTop:18}}>{cats.map(x=><div className="report-row" key={x.id}><div><b>{x.name}</b><small>{x.category_groups?.name}</small></div>{canManage&&<button className="small-btn" onClick={()=>toggle(x)}>{x.is_active?"فعال":"غیرفعال"}</button>}</div>)}</section>
 </main></AppShell>
}
