"use client";
import AppShell from "@/app/components/AppShell";
import {useEffect,useMemo,useState} from "react";

export default function ScoresPage(){
 const [data,setData]=useState<any>({missions:[],areas:[],scores:[]});
 const [groups,setGroups]=useState<any[]>([]),[me,setMe]=useState<any>(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[saving,setSaving]=useState(""),[selectedId,setSelectedId]=useState("");
 const [missionForm,setMissionForm]=useState({group_id:"",title:"",description:"",target_value:"",unit:"عدد",deadline_at:""});
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
 const role=me?.profile?.role,isLeader=["main_admin","deputy","battalion_commander"].includes(role),canCreate=Boolean(data.can_create),canEnter=Boolean(data.can_enter);
 const visibleGroups=groups.filter(g=>isLeader||(me?.responsible_group_ids??[]).includes(g.id));
 const scoreMap=useMemo(()=>new Map((data.scores??[]).map((s:any)=>[s.mission_id+"_"+s.area_id,s])),[data.scores]);
 const selectedMission=data.missions.find((m:any)=>m.id===selectedId);
 const pct=(a:number,t:number)=>t>0?Math.round(a/t*100):0;
 const isClosed=(m:any)=>Boolean(m.deadline_at&&new Date(m.deadline_at).getTime()<=Date.now());
 const dateLabel=(v:string)=>v?new Date(v).toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"}):"بدون مهلت";

 function safeExportText(value:any){return String(value??"").replace(/[&<>"']/g,(c:string)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]??c));}
 function missionExportRows(m:any){
  return data.areas.map((area:any)=>{
   const score:any=scoreMap.get(m.id+"_"+area.id),actual=Number(score?.actual_value??0),percent=pct(actual,Number(m.target_value));
   return {name:area.name,actual,percent,notes:score?.notes??"",submitted:Boolean(score)};
  });
 }
 function exportMissionPdf(m:any){
  const rows=missionExportRows(m),total=rows.reduce((n:number,r:any)=>n+r.actual,0),overall=pct(total,Number(m.target_value)*Math.max(rows.length,1));
  const w=window.open("","_blank");
  if(!w){setError("مرورگر اجازه باز شدن صفحه خروجی را نداد؛ پنجره بازشو را برای این سایت فعال کنید.");return;}
  const tableRows=rows.map((r:any)=>"<tr><td>"+safeExportText(r.name)+"</td><td>"+r.actual.toLocaleString("fa-IR")+" "+safeExportText(m.unit)+"</td><td>"+r.percent.toLocaleString("fa-IR")+"٪</td><td>"+(r.submitted?"ثبت شده":"ثبت نشده")+"</td><td>"+safeExportText(r.notes||"—")+"</td></tr>").join("");
  const html="<!doctype html><html lang='fa' dir='rtl'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>گزارش مأموریت - "+safeExportText(m.title)+"</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#172b43;margin:0;direction:rtl}.head{background:#102b46;color:#fff;padding:24px;border-radius:14px}.eyebrow{color:#a9d8ee;font-size:12px}.head h1{font-size:24px;margin:12px 0}.head p{margin:5px 0;color:#d9e9f5}.summary{display:flex;gap:12px;margin:18px 0}.metric{flex:1;border:1px solid #d9e4ed;border-radius:10px;padding:14px}.metric b{display:block;font-size:22px;color:#087e89;margin-bottom:5px}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}th{background:#eaf1f6;color:#16334c}th,td{border:1px solid #d8e1e8;padding:10px;text-align:right;vertical-align:top}.foot{margin-top:22px;color:#63788a;font-size:11px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header class='head'><div class='eyebrow'>سامانه راهبرد شوشتر · گزارش ارزیابی مأموریت</div><h1>"+safeExportText(m.title)+"</h1><p>بخش: "+safeExportText(m.category_groups?.name||"—")+"</p><p>توضیحات: "+safeExportText(m.description||"—")+"</p></header><section class='summary'><div class='metric'><b>"+overall.toLocaleString("fa-IR")+"٪</b>درصد تحقق کل</div><div class='metric'><b>"+total.toLocaleString("fa-IR")+"</b>مجموع عملکرد ثبت‌شده</div><div class='metric'><b>"+Number(m.target_value).toLocaleString("fa-IR")+"</b>هدف هر حوزه · "+safeExportText(m.unit)+"</div></section><p>مهلت: "+safeExportText(dateLabel(m.deadline_at))+"　 |　 تاریخ تهیه: "+new Date().toLocaleDateString("fa-IR")+"</p><table><thead><tr><th>حوزه</th><th>عملکرد ثبت‌شده</th><th>درصد تحقق</th><th>وضعیت</th><th>توضیحات</th></tr></thead><tbody>"+tableRows+"</tbody></table><div class='foot'>این گزارش بر اساس اطلاعات ثبت‌شده در سامانه راهبرد شوشتر تهیه شده است.</div><script>window.onload=function(){setTimeout(function(){window.print()},350)};<\/script></body></html>";
  w.document.open();w.document.write(html);w.document.close();
 }
 function exportMissionPoster(m:any){
  const rows=missionExportRows(m),total=rows.reduce((n:number,r:any)=>n+r.actual,0),overall=pct(total,Number(m.target_value)*Math.max(rows.length,1));
  const rowSvg=rows.slice(0,7).map((r:any,i:number)=>{
   const y=790+i*66;
   return "<text x='930' y='"+y+"' text-anchor='end' fill='#e9f4ff' font-size='27'>"+safeExportText(r.name)+"</text><text x='145' y='"+y+"' text-anchor='start' fill='#75e0d1' font-size='25'>"+r.actual.toLocaleString("fa-IR")+" "+safeExportText(m.unit)+" · "+r.percent.toLocaleString("fa-IR")+"٪</text>";
  }).join("");
  const more=rows.length>7?"<text x='930' y='1270' text-anchor='end' fill='#9db5c9' font-size='20'>و "+(rows.length-7).toLocaleString("fa-IR")+" حوزه دیگر</text>":"";
  const svg="<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1350' viewBox='0 0 1080 1350'><defs><linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#071b31'/><stop offset='1' stop-color='#123f59'/></linearGradient><linearGradient id='accent'><stop stop-color='#27d6c1'/><stop offset='1' stop-color='#54a8ff'/></linearGradient></defs><rect width='1080' height='1350' rx='42' fill='url(#bg)'/><circle cx='930' cy='120' r='210' fill='#1c6680' opacity='.18'/><circle cx='70' cy='1260' r='250' fill='#21b8a5' opacity='.12'/><rect x='58' y='58' width='964' height='1234' rx='34' fill='none' stroke='#6ec8d5' stroke-opacity='.32' stroke-width='2'/><text x='930' y='145' text-anchor='end' fill='#9edee9' font-size='27'>سامانه راهبرد شوشتر</text><text x='930' y='205' text-anchor='end' fill='#d9f4ff' font-size='22'>گزارش تصویری مأموریت</text><rect x='150' y='250' width='780' height='5' rx='3' fill='url(#accent)'/><text x='930' y='355' text-anchor='end' fill='#ffffff' font-size='48' font-weight='bold'>"+safeExportText(m.title)+"</text><text x='930' y='420' text-anchor='end' fill='#b5d0e2' font-size='27'>"+safeExportText(m.category_groups?.name||"بخش")+" · هدف هر حوزه: "+Number(m.target_value).toLocaleString("fa-IR")+" "+safeExportText(m.unit)+"</text><rect x='150' y='475' width='780' height='210' rx='28' fill='#ffffff' fill-opacity='.08' stroke='#8bd8e0' stroke-opacity='.35'/><text x='540' y='555' text-anchor='middle' fill='#a9dbe8' font-size='25'>درصد تحقق مأموریت</text><text x='540' y='635' text-anchor='middle' fill='#ffffff' font-size='76' font-weight='bold'>"+overall.toLocaleString("fa-IR")+"٪</text><text x='930' y='745' text-anchor='end' fill='#7fe2d3' font-size='26'>عملکرد حوزه‌ها</text>"+rowSvg+more+"<text x='930' y='1225' text-anchor='end' fill='#a8c1d2' font-size='19'>تاریخ تهیه: "+new Date().toLocaleDateString("fa-IR")+"</text><text x='150' y='1225' text-anchor='start' fill='#a8c1d2' font-size='19'>راهبرد شوشتر</text></svg>";
  const blob=new Blob([svg],{type:"image/svg+xml;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="poster-mission-"+String(m.title||"mission").replace(/[^\u0600-\u06FF\w-]+/g,"-")+".svg";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 }
 async function createMission(e:any){
  e.preventDefault();setSaving("mission");setError("");setNotice("");
  try{
   const deadline=missionForm.deadline_at?new Date(missionForm.deadline_at).toISOString():null;
   const r=await fetch("/api/missions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...missionForm,deadline_at:deadline,target_value:Number(missionForm.target_value)})});
   const d=await r.json();if(!r.ok)throw new Error(d.message||"ثبت مأموریت ناموفق بود.");
   setMissionForm(x=>({...x,title:"",description:"",target_value:"",deadline_at:""}));setNotice("مأموریت ثبت شد.");await load();
   if(d.id)setSelectedId(d.id);
  }catch(e:any){setError(e.message||"خطا در ثبت مأموریت.");}finally{setSaving("");}
 }
 async function saveScore(e:any){
  e.preventDefault();setSaving("score");setError("");setNotice("");
  try{
   const r=await fetch("/api/missions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...entry,actual_value:Number(entry.actual_value)})});
   const d=await r.json();if(!r.ok)throw new Error(d.message||"ثبت عملکرد ناموفق بود.");
   setNotice("عملکرد حوزه ثبت شد.");setEntry(x=>({...x,actual_value:"",notes:""}));await load();
  }catch(e:any){setError(e.message||"خطا در ثبت عملکرد.");}finally{setSaving("");}
 }
 async function deleteMission(m:any){
  if(!window.confirm("این مأموریت و تمام نمرات ثبت‌شده برای آن حذف شود؟ این عملیات قابل بازگشت نیست."))return;
  setSaving("delete");setError("");setNotice("");
  try{
   const r=await fetch("/api/missions",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({mission_id:m.id})});
   const d=await r.json();if(!r.ok)throw new Error(d.message||"حذف مأموریت ناموفق بود.");
   setNotice("مأموریت حذف شد.");if(selectedId===m.id)setSelectedId("");await load();
  }catch(e:any){setError(e.message||"خطا در حذف مأموریت.");}finally{setSaving("");}
 }
 return <AppShell><main className="shell unified-page scores-page">
  <div className="topbar"><div><span className="eyebrow">ارزیابی عملکرد بخش‌ها و حوزه‌ها</span><h1>مدیریت مأموریت و نمره‌دهی</h1><p>ابتدا مأموریت را انتخاب کنید، سپس عملکرد تک‌تک حوزه‌ها را ببینید.</p></div><span className="header-live">● پایش عملکرد</span></div>
  {error&&<div className="error" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
  {canCreate&&<form className="panel score-form" onSubmit={createMission}>
   <div className="panel-title"><div><span className="panel-eyebrow">NEW MISSION</span><h2>تعریف مأموریت جدید</h2></div></div>
   <div className="score-form-grid">
    <label>بخش<select required value={missionForm.group_id} onChange={e=>setMissionForm({...missionForm,group_id:e.target.value})}><option value="">انتخاب بخش</option>{visibleGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label>عنوان مأموریت<input required value={missionForm.title} onChange={e=>setMissionForm({...missionForm,title:e.target.value})} placeholder="مثلاً انتشار محتوای عملیاتی"/></label>
    <label>سهمیه هدف<input type="number" min="1" step="any" required value={missionForm.target_value} onChange={e=>setMissionForm({...missionForm,target_value:e.target.value})} placeholder="مثلاً ۱۰۰"/></label>
    <label>واحد اندازه‌گیری<input required value={missionForm.unit} onChange={e=>setMissionForm({...missionForm,unit:e.target.value})} placeholder="عدد، محتوا، اقدام"/></label>
    <label>آخرین مهلت ثبت نمره<input type="datetime-local" value={missionForm.deadline_at} onChange={e=>setMissionForm({...missionForm,deadline_at:e.target.value})}/><small>پس از این زمان ثبت و ویرایش نمره توسط حوزه‌ها بسته می‌شود.</small></label>
    <label className="score-wide">توضیحات<textarea rows={2} value={missionForm.description} onChange={e=>setMissionForm({...missionForm,description:e.target.value})}/></label>
   </div>
   <button className="button neon-button" disabled={saving==="mission"||!missionForm.group_id}>{saving==="mission"?"در حال ثبت…":"ثبت مأموریت"}</button>
  </form>}
  <section className="panel score-results">
   <div className="panel-title"><div><span className="panel-eyebrow">MISSION CENTER</span><h2>فهرست کلی مأموریت‌ها</h2></div><span className="score-count">{data.missions.length} مأموریت</span></div>
   {loading?<div className="empty-state">در حال دریافت اطلاعات…</div>:data.missions.length===0?<div className="empty-state">هنوز مأموریتی ثبت نشده است.</div>:
    <div className="mission-list">{data.missions.map((m:any)=>{
     const scores=data.scores.filter((s:any)=>s.mission_id===m.id),total=scores.reduce((n:number,s:any)=>n+Number(s.actual_value||0),0),overall=pct(total,Number(m.target_value)*Math.max(data.areas.length,1)),closed=isClosed(m);
     return <article className={"mission-tile "+(selectedId===m.id?"selected":"")} key={m.id}>
      <button type="button" className="mission-tile-main" onClick={()=>setSelectedId(selectedId===m.id?"":m.id)}>
       <div className="mission-tile-title"><span className="panel-eyebrow">{m.category_groups?.name||"بخش"}</span><h3>{m.title}</h3><p>{m.description||"بدون توضیحات"}</p></div>
       <div className="mission-tile-meta"><strong>{overall.toLocaleString("fa-IR")}٪</strong><span className={closed?"deadline-closed":"deadline-open"}>{closed?"مهلت تمام شده":"در حال ثبت"}</span><small>مهلت: {dateLabel(m.deadline_at)}</small></div>
       <span className="mission-chevron">{selectedId===m.id?"−":"+"}</span>
      </button>
      <div className="score-progress"><span style={{width:Math.min(overall,100)+"%"}}/></div>
      <div className="mission-export-actions"><button type="button" className="button neon-button mission-export-button" onClick={()=>exportMissionPdf(m)}>خروجی PDF</button><button type="button" className="button mission-export-button mission-poster-button" onClick={()=>exportMissionPoster(m)}>دریافت پوستر</button></div>\n      {isLeader&&<button type="button" className="mission-delete" disabled={saving==="delete"} onClick={()=>deleteMission(m)}>حذف مأموریت</button>}
     </article>;
    })}</div>}
  </section>
  {selectedMission&&<section className="panel score-results mission-detail">
   <div className="panel-title"><div><span className="panel-eyebrow">MISSION DETAILS</span><h2>{selectedMission.title}</h2><p>{selectedMission.category_groups?.name} · هدف هر حوزه: {selectedMission.target_value} {selectedMission.unit}</p></div><span className={isClosed(selectedMission)?"deadline-closed":"deadline-open"}>{isClosed(selectedMission)?"بسته شده":"فعال"}</span></div>
   <div className="mission-detail-grid">{data.areas.map((area:any)=>{
    const score:any=scoreMap.get(selectedMission.id+"_"+area.id),actual=Number(score?.actual_value??0),percent=pct(actual,Number(selectedMission.target_value));
    return <div className="area-score" key={area.id}><b>{area.name}</b><span>{actual.toLocaleString("fa-IR")} از {Number(selectedMission.target_value).toLocaleString("fa-IR")} {selectedMission.unit}</span><strong>{percent.toLocaleString("fa-IR")}٪</strong><div className="score-progress"><span style={{width:Math.min(percent,100)+"%"}}/></div><small>{score?"ثبت شده":"هنوز ثبت نشده"}</small></div>;
   })}</div>
   {canEnter&&!isClosed(selectedMission)&&<form className="score-entry-form" onSubmit={saveScore}>
    <h3>ثبت یا ویرایش عملکرد حوزه</h3>
    <div className="score-form-grid">
     <label>حوزه<select required value={entry.area_id} onChange={e=>setEntry({...entry,mission_id:selectedMission.id,area_id:e.target.value})}><option value="">انتخاب حوزه</option>{data.areas.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
     <label>مقدار انجام‌شده<input type="number" min="0" step="any" required value={entry.actual_value} onChange={e=>setEntry({...entry,mission_id:selectedMission.id,actual_value:e.target.value})}/></label>
     <label>توضیحات<input value={entry.notes} onChange={e=>setEntry({...entry,mission_id:selectedMission.id,notes:e.target.value})}/></label>
    </div>
    <button className="button neon-button" disabled={saving==="score"||!entry.area_id||!entry.actual_value}>{saving==="score"?"در حال ثبت…":"ثبت عملکرد"}</button>
   </form>}
   {isClosed(selectedMission)&&<p className="score-closed-note">مهلت این مأموریت به پایان رسیده و ثبت نمره حوزه‌ها قفل شده است.</p>}
  </section>}
 </main></AppShell>;
}
