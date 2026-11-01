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
  const rows=missionExportRows(m),total=rows.reduce((n:number,r:any)=>n+r.actual,0),target=Number(m.target_value)||0;
  const overall=pct(total,target*Math.max(rows.length,1)),submitted=rows.filter((r:any)=>r.submitted).length,pending=rows.length-submitted;
  const generatedAt=new Date(),fmt=(v:any)=>Number(v||0).toLocaleString("fa-IR");
  const tableRows=rows.map((r:any,i:number)=>"<tr><td class='index'>"+fmt(i+1)+"</td><td class='area'><strong>"+safeExportText(r.name)+"</strong></td><td class='actual'>"+fmt(r.actual)+" <small>"+safeExportText(m.unit||"")+"</small></td><td><div class='percent-cell'><b>"+fmt(r.percent)+"٪</b><span class='mini-track'><i style='width:"+Math.min(r.percent,100)+"%'></i></span></div></td><td><span class='status "+(r.submitted?"done":"pending")+"'><i></i>"+(r.submitted?"ثبت شده":"در انتظار ثبت")+"</span></td><td class='notes'>"+safeExportText(r.notes||"—")+"</td></tr>").join("");
  const w=window.open("","_blank");if(!w){setError("مرورگر اجازه باز شدن صفحه گزارش را نداد؛ پنجره بازشو را برای این سایت فعال کنید.");return;}
  const html="<!doctype html><html lang='fa' dir='rtl'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>گزارش ارزیابی · "+safeExportText(m.title)+"</title><style>"+
  "@page{size:A4 landscape;margin:7mm 8mm 9mm;@bottom-right{content:'سامانه راهبرد شوشتر  |  گزارش مدیریتی';font:7px Tahoma;color:#7b91a5}}"+
  "*{box-sizing:border-box}html{background:#eaf0f5}body{margin:0;background:#fff;color:#18344c;font-family:Tahoma,Arial,sans-serif;font-size:10px;line-height:1.9;direction:rtl;-webkit-print-color-adjust:exact;print-color-adjust:exact}"+
  ".report{position:relative;overflow:hidden}.hero{position:relative;overflow:hidden;padding:22px 27px 19px;border-radius:17px;background:linear-gradient(118deg,#071b30 0%,#103c59 57%,#087b88 100%);color:#fff}.hero:before{content:'';position:absolute;width:250px;height:250px;border:1px solid #ffffff20;border-radius:50%;left:-65px;top:-155px;box-shadow:0 0 0 25px #ffffff08,0 0 0 55px #ffffff06}.hero:after{content:'';position:absolute;width:170px;height:170px;border-radius:50%;right:43%;bottom:-135px;background:#3de0d51c}.hero-top{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:15px}.brand{font-size:10px;font-weight:bold;letter-spacing:.5px;color:#9cecf0}.doc-tag{padding:5px 11px;border:1px solid #a4e7e744;border-radius:30px;color:#c9f7f1;font-size:8px}.kicker{position:relative;z-index:1;margin-top:10px;color:#b9d7e6;font-size:9px}h1{position:relative;z-index:1;margin:5px 0 5px;font-size:22px;line-height:1.8;color:#fff;overflow-wrap:anywhere}.description{position:relative;z-index:1;margin:0;color:#d5e8ef;font-size:9px;line-height:1.9;overflow-wrap:anywhere}.meta{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:6px 19px;margin-top:12px;padding-top:9px;border-top:1px solid #ffffff2c;color:#d7eaf2;font-size:8px}"+
  ".section-title{display:flex;align-items:center;gap:8px;margin:16px 0 8px;color:#173b55;font-size:11px;font-weight:bold}.section-title:before{content:'';width:4px;height:16px;border-radius:5px;background:linear-gradient(#17c9c2,#2785dc)}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.metric{min-width:0;position:relative;overflow:hidden;padding:10px 12px;border:1px solid #dce8ef;border-radius:11px;background:linear-gradient(145deg,#f8fcfe,#edf5f8)}.metric:after{content:'';position:absolute;left:-20px;bottom:-29px;width:70px;height:70px;border-radius:50%;background:#16b9bd12}.metric b{position:relative;z-index:1;display:block;margin-bottom:2px;color:#087f89;font-size:19px;line-height:1.5;overflow-wrap:anywhere}.metric span{position:relative;z-index:1;display:block;color:#647e91;font-size:8px;line-height:1.8}.progress-wrap{margin-top:9px;padding:10px 13px;border:1px solid #dce7ee;border-radius:11px;background:#fbfdfe}.progress-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:6px;color:#526b80;font-size:8px}.progress-head strong{color:#087f89}.track{height:7px;overflow:hidden;border-radius:20px;background:#e4edf2}.fill{height:100%;width:"+Math.min(overall,100)+"%;border-radius:20px;background:linear-gradient(90deg,#12b8b5,#2784dc)}"+
  "table{width:100%;border-collapse:separate;border-spacing:0;margin-top:6px;table-layout:fixed;font-size:8.5px}thead{display:table-header-group}th{padding:8px 8px;background:#103750;color:#fff;text-align:right;font-size:8px}th:first-child{border-radius:0 7px 0 0}th:last-child{border-radius:7px 0 0 0}td{padding:7px 8px;border-bottom:1px solid #e5edf2;color:#29465b;text-align:right;vertical-align:middle;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f3f8fa}tr{break-inside:avoid;page-break-inside:avoid}.index{color:#8498a8;width:5%}.area{font-weight:bold;color:#173b55}.actual{font-weight:bold;color:#087f89}.actual small{font-size:7px;color:#6c8293;font-weight:normal}.percent-cell{display:flex;align-items:center;gap:7px}.percent-cell b{min-width:34px;color:#176b91}.mini-track{display:block;flex:1;height:5px;min-width:35px;border-radius:10px;background:#e2edf2;overflow:hidden}.mini-track i{display:block;height:100%;border-radius:10px;background:linear-gradient(90deg,#16b9b5,#328be0)}.status{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:20px;font-weight:bold;white-space:nowrap;font-size:7.5px}.status i{width:5px;height:5px;border-radius:50%;background:currentColor}.done{background:#e3f7ee;color:#087d55}.pending{background:#fff2df;color:#9a680e}.notes{white-space:pre-wrap;line-height:1.7;color:#61798b}.footnote{margin-top:12px;padding:8px 11px;border-right:3px solid #12aebc;border-radius:6px;background:#f1f7fa;color:#63798b;font-size:8px;line-height:1.9}.signature{display:flex;justify-content:space-between;gap:12px;margin-top:12px;padding-top:8px;border-top:1px solid #dce6ed;color:#7b8d9c;font-size:7.5px}@media screen{body{max-width:1100px;margin:24px auto;padding:18px;background:#eaf0f5}.report{padding:0 0 12px}}@media print{html,body{width:100%;height:auto;margin:0!important;padding:0!important;background:#fff!important}.report{width:100%!important;margin:0!important;padding:0!important;overflow:visible!important}.hero,.metric,.progress-wrap,.footnote{break-inside:avoid;page-break-inside:avoid}table{font-size:7.5px}th,td{padding:5px 6px}.section-title{margin:10px 0 5px}.hero{padding:15px 20px 13px}h1{font-size:19px}.metrics{gap:6px}.metric{padding:7px 9px}.progress-wrap{margin-top:6px;padding:7px 10px}.signature{margin-top:7px;padding-top:5px}}"+
  "</style></head><body><main class='report'><header class='hero'><div class='hero-top'><div class='brand'>RAHBORD  /  SHUSHTAR</div><span class='doc-tag'>گزارش رسمی · ارزیابی عملکرد</span></div><div class='kicker'>مرکز پایش مأموریت‌ها و عملکرد حوزه‌ها</div><h1>"+safeExportText(m.title||"گزارش مأموریت")+"</h1><p class='description'>"+safeExportText(m.description||"گزارش وضعیت تحقق مأموریت در حوزه‌ها")+"</p><div class='meta'><span>بخش: "+safeExportText(m.category_groups?.name||"—")+"</span><span>هدف هر حوزه: "+fmt(target)+" "+safeExportText(m.unit||"")+"</span><span>مهلت: "+safeExportText(dateLabel(m.deadline_at))+"</span></div></header>"+
  "<div class='section-title'>نمای کلی و شاخص‌های مدیریتی</div><section class='metrics'><div class='metric'><b>"+fmt(overall)+"٪</b><span>درصد تحقق کل مأموریت</span></div><div class='metric'><b>"+fmt(total)+"</b><span>مجموع عملکرد ثبت‌شده</span></div><div class='metric'><b>"+fmt(submitted)+" از "+fmt(rows.length)+"</b><span>حوزه‌های دارای گزارش</span></div><div class='metric'><b>"+fmt(pending)+"</b><span>حوزه‌های در انتظار ثبت</span></div></section>"+
  "<section class='progress-wrap'><div class='progress-head'><span>پیشرفت نسبت به مجموع سهمیه هدف حوزه‌ها</span><strong>"+fmt(overall)+"٪</strong></div><div class='track'><div class='fill'></div></div></section><div class='section-title'>جدول تفصیلی عملکرد حوزه‌ها</div>"+
  "<table><thead><tr><th style='width:5%'>ردیف</th><th style='width:22%'>نام حوزه</th><th style='width:14%'>عملکرد ثبت‌شده</th><th style='width:17%'>درصد تحقق</th><th style='width:17%'>وضعیت ثبت</th><th style='width:25%'>توضیحات و ملاحظات</th></tr></thead><tbody>"+(tableRows||"<tr><td colspan='6'>اطلاعاتی برای نمایش وجود ندارد.</td></tr>")+"</tbody></table>"+
  "<div class='footnote'>این سند به‌صورت خودکار از اطلاعات ثبت‌شده در سامانه راهبرد شوشتر تهیه شده است. درصد تحقق کل بر اساس مجموع عملکرد ثبت‌شده در مقایسه با مجموع اهداف حوزه‌ها محاسبه می‌شود. اطلاعات ثبت‌نشده به‌عنوان عملکرد صفر در نظر گرفته شده‌اند.</div><footer class='signature'><span>تاریخ و ساعت تهیه: "+safeExportText(generatedAt.toLocaleString("fa-IR"))+"</span><span>سامانه مدیریت و پایش · راهبرد شوشتر</span></footer></main><script>window.onload=function(){setTimeout(function(){var el=document.querySelector('.report');if(el){var availableW=1060,availableH=735;var naturalW=el.scrollWidth,naturalH=el.scrollHeight;var scale=Math.min(1,availableW/naturalW,availableH/naturalH);el.style.zoom=String(scale);el.style.width=(100/scale)+'%';}window.focus();window.print()},650)};<\/script></body></html>";
  w.document.open();w.document.write(html);w.document.close();
 }
 function exportMissionPoster(m:any){
  const rows=missionExportRows(m),total=rows.reduce((n:number,r:any)=>n+r.actual,0),overall=pct(total,Number(m.target_value)*Math.max(rows.length,1));
  const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext("2d");if(!ctx){setError("ساخت پوستر در این مرورگر پشتیبانی نمی‌شود.");return;}
  const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,"#071b31");bg.addColorStop(1,"#123f59");ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
  ctx.fillStyle="rgba(28,102,128,.22)";ctx.beginPath();ctx.arc(930,120,210,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(33,184,165,.13)";ctx.beginPath();ctx.arc(70,1260,250,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="rgba(110,200,213,.42)";ctx.lineWidth=2;ctx.strokeRect(58,58,964,1234);
  ctx.direction="rtl";ctx.textAlign="right";ctx.fillStyle="#9edee9";ctx.font="27px Tahoma,Arial";ctx.fillText("سامانه راهبرد شوشتر",930,145);
  ctx.fillStyle="#d9f4ff";ctx.font="22px Tahoma,Arial";ctx.fillText("گزارش تصویری مأموریت",930,205);
  const accent=ctx.createLinearGradient(150,0,930,0);accent.addColorStop(0,"#27d6c1");accent.addColorStop(1,"#54a8ff");ctx.fillStyle=accent;ctx.fillRect(150,250,780,5);
  ctx.fillStyle="#fff";ctx.font="bold 48px Tahoma,Arial";ctx.fillText(String(m.title||"مأموریت"),930,355,850);
  ctx.fillStyle="#b5d0e2";ctx.font="27px Tahoma,Arial";ctx.fillText(String(m.category_groups?.name||"بخش")+" · هدف هر حوزه: "+Number(m.target_value).toLocaleString("fa-IR")+" "+String(m.unit||""),930,420,850);
  ctx.fillStyle="rgba(255,255,255,.08)";ctx.strokeStyle="rgba(139,216,224,.45)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(150,475,780,210,28);ctx.fill();ctx.stroke();
  ctx.textAlign="center";ctx.fillStyle="#a9dbe8";ctx.font="25px Tahoma,Arial";ctx.fillText("درصد تحقق مأموریت",540,555);
  ctx.fillStyle="#fff";ctx.font="bold 76px Tahoma,Arial";ctx.fillText(overall.toLocaleString("fa-IR")+"٪",540,635);
  ctx.textAlign="right";ctx.fillStyle="#7fe2d3";ctx.font="26px Tahoma,Arial";ctx.fillText("عملکرد حوزه‌ها",930,745);
  rows.slice(0,7).forEach((r:any,i:number)=>{const y=790+i*66;ctx.textAlign="right";ctx.fillStyle="#e9f4ff";ctx.font="27px Tahoma,Arial";ctx.fillText(String(r.name),930,y,520);ctx.textAlign="left";ctx.fillStyle="#75e0d1";ctx.font="25px Tahoma,Arial";ctx.fillText(r.actual.toLocaleString("fa-IR")+" "+String(m.unit||"")+" · "+r.percent.toLocaleString("fa-IR")+"٪",145,y,420);});
  if(rows.length>7){ctx.textAlign="right";ctx.fillStyle="#9db5c9";ctx.font="20px Tahoma,Arial";ctx.fillText("و "+(rows.length-7).toLocaleString("fa-IR")+" حوزه دیگر",930,1270);}
  ctx.textAlign="right";ctx.fillStyle="#a8c1d2";ctx.font="19px Tahoma,Arial";ctx.fillText("تاریخ تهیه: "+new Date().toLocaleDateString("fa-IR"),930,1225);
  ctx.textAlign="left";ctx.fillText("راهبرد شوشتر",150,1225);
  canvas.toBlob((blob)=>{if(!blob){setError("ساخت فایل پوستر ناموفق بود.");return;}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="poster-mission-"+String(m.title||"mission").replace(/[^\u0600-\u06FF\w-]+/g,"-")+".png";document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1500);},"image/png");
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
    return <div className="area-score" key={area.id}><b>{area.name}</b><span>{actual.toLocaleString("fa-IR")} از {Number(selectedMission.target_value).toLocaleString("fa-IR")} {selectedMission.unit}</span><strong>{percent.toLocaleString("fa-IR")}٪</strong><div className="score-progress"><span style={{width:Math.min(percent,100)+"%"}}/></div><small>{score?"ثبت شده":"هنوز ثبت نشده"}</small>{canEnter&&(isLeader||!isClosed(selectedMission))&&<button type="button" className="button mission-export-button" onClick={()=>{setEntry({mission_id:selectedMission.id,area_id:area.id,actual_value:score?String(score.actual_value):"",notes:score?.notes??""});document.querySelector(".score-entry-form")?.scrollIntoView({behavior:"smooth",block:"center"});}}> {score?"ویرایش نمره":"ثبت نمره"} </button>}</div>;
   })}</div>
   {canEnter&&(isLeader||!isClosed(selectedMission))&&<form className="score-entry-form" onSubmit={saveScore}>
    <h3>{entry.area_id&&data.areas.find((a:any)=>a.id===entry.area_id)?(data.areas.find((a:any)=>a.id===entry.area_id).name+" · "):""}ثبت یا ویرایش عملکرد حوزه</h3>
    <div className="score-form-grid">
     <label>حوزه<select required value={entry.area_id} onChange={e=>{const areaId=e.target.value,existing:any=scoreMap.get(selectedMission.id+"_"+areaId);setEntry({mission_id:selectedMission.id,area_id:areaId,actual_value:existing?String(existing.actual_value):"",notes:existing?.notes??""});}}><option value="">انتخاب حوزه</option>{data.areas.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
     <label>مقدار انجام‌شده<input type="number" min="0" step="any" required value={entry.actual_value} onChange={e=>setEntry({...entry,mission_id:selectedMission.id,actual_value:e.target.value})}/></label>
     <label>توضیحات<input value={entry.notes} onChange={e=>setEntry({...entry,mission_id:selectedMission.id,notes:e.target.value})}/></label>
    </div>
    <button className="button neon-button" disabled={saving==="score"||!entry.area_id||!entry.actual_value}>{saving==="score"?"در حال ثبت…":(scoreMap.has(selectedMission.id+"_"+entry.area_id)?"ذخیره ویرایش نمره":"ثبت نمره حوزه")}</button>
   </form>}
   {isClosed(selectedMission)&&!isLeader&&<p className="score-closed-note">مهلت این مأموریت به پایان رسیده و ثبت نمره حوزه‌ها قفل شده است.</p>}
  </section>}
 </main></AppShell>;
}
