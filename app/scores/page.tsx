"use client";

import AppShell from "@/app/components/AppShell";
import {useEffect,useMemo,useState} from "react";

export default function ScoresPage(){
 const [data,setData]=useState<any>({missions:[],areas:[],scores:[]});
 const [groups,setGroups]=useState<any[]>([]);
 const [me,setMe]=useState<any>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [saving,setSaving]=useState("");
 const [missionForm,setMissionForm]=useState({group_id:"",title:"",description:"",target_value:"",unit:"عدد"});
 const [entry,setEntry]=useState({mission_id:"",area_id:"",actual_value:"",notes:""});

 async function load(){
  const [r,g,m]=await Promise.all([fetch("/api/missions",{cache:"no-store"}),fetch("/api/categories",{cache:"no-store"}),fetch("/api/me",{cache:"no-store"})]);
  const [d,gd,md]=await Promise.all([r.json(),g.json(),m.json()]);
  if(!r.ok)throw new Error(d.message||"دریافت اطلاعات نمره‌دهی ناموفق بود.");
  if(!g.ok)throw new Error(gd.message||"دریافت بخش‌ها ناموفق بود.");
  setData(d);setGroups(gd.groups??[]);setMe(md);
  setMissionForm(x=>({...x,group_id:x.group_id||md.responsible_group_ids?.[0]||gd.groups?.[0]?.id||""}));
 }
 useEffect(()=>{load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 const role=me?.profile?.role;
 const isLeader=["main_admin","deputy","battalion_commander"].includes(role);
 const canCreate=Boolean(data.can_create);
 const canEnter=Boolean(data.can_enter);
 const visibleGroups=groups.filter(g=>isLeader||(me?.responsible_group_ids??[]).includes(g.id));
 const scoreMap=useMemo(()=>new Map((data.scores??[]).map((s:any)=>[s.mission_id+"_"+s.area_id,s])),[data.scores]);
 const selectedMission=data.missions.find((m:any)=>m.id===entry.mission_id);

 async function createMission(e:any){
  e.preventDefault();setSaving("mission");setError("");setNotice("");
  try{
   const r=await fetch("/api/missions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...missionForm,target_value:Number(missionForm.target_value)})});
   const d=await r.json();if(!r.ok)throw new Error(d.message||"ثبت مأموریت ناموفق بود.");
   setMissionForm(x=>({...x,title:"",description:"",target_value:""}));setNotice("سهمیه مأموریت ثبت شد.");await load();
  }catch(e:any){setError(e.message||"خطا در ثبت مأموریت.");}finally{setSaving("");}
 }
 async function saveScore(e:any){
  e.preventDefault();setSaving("score");setError("");setNotice("");
  try{
   const r=await fetch("/api/missions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...entry,actual_value:Number(entry.actual_value)})});
   const d=await r.json();if(!r.ok)throw new Error(d.message||"ثبت عملکرد ناموفق بود.");
   setNotice("عدد عملکرد با موفقیت ثبت شد.");setEntry(x=>({...x,actual_value:"",notes:""}));await load();
  }catch(e:any){setError(e.message||"خطا در ثبت عملکرد.");}finally{setSaving("");}
 }
 const pct=(actual:number,target:number)=>target>0?Math.round(actual/target*100):0;
 return <AppShell><main className="shell unified-page scores-page">
  <div className="topbar"><div><span className="eyebrow">ارزیابی عملکرد بخش‌ها و حوزه‌ها</span><h1>نمره‌دهی و سهمیه مأموریت‌ها</h1><p>تعیین سهمیه توسط مسئول بخش و ثبت عملکرد توسط حوزه‌ها و فرماندهی</p></div><span className="header-live">● پایش عملکرد</span></div>
  {error&&<div className="error" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
  {canCreate&&<form className="panel score-form" onSubmit={createMission}>
   <div className="panel-title"><div><span className="panel-eyebrow">MISSION / QUOTA</span><h2>تعیین مأموریت و سهمیه</h2></div></div>
   <div className="score-form-grid">
    <label>بخش<select required value={missionForm.group_id} onChange={e=>setMissionForm({...missionForm,group_id:e.target.value})}><option value="">انتخاب بخش</option>{visibleGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label>عنوان مأموریت<input required value={missionForm.title} onChange={e=>setMissionForm({...missionForm,title:e.target.value})} placeholder="مثلاً انتشار توییت"/></label>
    <label>سهمیه هدف<input type="number" min="1" step="any" required value={missionForm.target_value} onChange={e=>setMissionForm({...missionForm,target_value:e.target.value})} placeholder="مثلاً ۱۰۰"/></label>
    <label>واحد اندازه‌گیری<input required value={missionForm.unit} onChange={e=>setMissionForm({...missionForm,unit:e.target.value})} placeholder="توییت، محتوا، اقدام"/></label>
    <label className="score-wide">توضیحات (اختیاری)<textarea rows={2} value={missionForm.description} onChange={e=>setMissionForm({...missionForm,description:e.target.value})}/></label>
   </div>
   <button className="button neon-button" disabled={saving==="mission"||!missionForm.group_id}>{saving==="mission"?"در حال ثبت…":"ثبت سهمیه مأموریت"}</button>
  </form>}
  {canEnter&&<form className="panel score-form" onSubmit={saveScore}>
   <div className="panel-title"><div><span className="panel-eyebrow">AREA PERFORMANCE</span><h2>ثبت عملکرد حوزه</h2></div></div>
   <div className="score-form-grid">
    <label>مأموریت<select required value={entry.mission_id} onChange={e=>setEntry({...entry,mission_id:e.target.value})}><option value="">انتخاب مأموریت</option>{data.missions.filter((m:any)=>m.is_active).map((m:any)=><option key={m.id} value={m.id}>{m.category_groups?.name} · {m.title} (هدف {m.target_value} {m.unit})</option>)}</select></label>
    <label>حوزه<select required value={entry.area_id} onChange={e=>setEntry({...entry,area_id:e.target.value})}><option value="">انتخاب حوزه</option>{data.areas.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>مقدار انجام‌شده<input type="number" min="0" step="any" required value={entry.actual_value} onChange={e=>setEntry({...entry,actual_value:e.target.value})} placeholder="عدد عملکرد"/></label>
    <label>توضیحات<input value={entry.notes} onChange={e=>setEntry({...entry,notes:e.target.value})} placeholder="توضیح یا مستند کوتاه"/></label>
   </div>
   {selectedMission&&<p className="score-hint">سهمیه این مأموریت: {selectedMission.target_value} {selectedMission.unit}</p>}
   <button className="button neon-button" disabled={saving==="score"||!entry.mission_id||!entry.area_id}>{saving==="score"?"در حال ثبت…":"ثبت عدد عملکرد"}</button>
  </form>}
  <section className="panel score-results">
   <div className="panel-title"><div><span className="panel-eyebrow">PERFORMANCE OVERVIEW</span><h2>درصد پیشرفت هر بخش و حوزه</h2></div></div>
   {loading?<div className="empty-state">در حال دریافت اطلاعات…</div>:data.missions.length===0?<div className="empty-state">هنوز مأموریتی ثبت نشده است.</div>:data.missions.map((mission:any)=>{
    const scores=(data.scores??[]).filter((s:any)=>s.mission_id===mission.id);
    const total=scores.reduce((n:number,s:any)=>n+Number(s.actual_value||0),0);
    const overall=pct(total,Number(mission.target_value)*Math.max(data.areas.length,1));
    return <article className="mission-result" key={mission.id}>
     <div className="mission-result-head"><div><span className="panel-eyebrow">{mission.category_groups?.name}</span><h3>{mission.title}</h3><p>{mission.description||"بدون توضیحات"} · سهمیه هر حوزه: {mission.target_value} {mission.unit}</p></div><strong>{overall.toLocaleString("fa-IR")}٪</strong></div>
     <div className="score-progress"><span style={{width:Math.min(overall,100)+"%"}}/></div>
     <div className="area-score-grid">{data.areas.map((area:any)=>{
      const score:any=scoreMap.get(mission.id+"_"+area.id);
      const actual=Number(score?.actual_value??0);const percent=pct(actual,Number(mission.target_value));
      return <div className="area-score" key={area.id}><b>{area.name}</b><span>{actual.toLocaleString("fa-IR")} / {Number(mission.target_value).toLocaleString("fa-IR")} {mission.unit}</span><strong>{percent.toLocaleString("fa-IR")}٪</strong><div className="score-progress"><span style={{width:Math.min(percent,100)+"%"}}/></div></div>;
     })}</div>
    </article>
   })}
  </section>
 </main></AppShell>;
}
