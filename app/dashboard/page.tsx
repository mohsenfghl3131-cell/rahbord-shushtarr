import Link from "next/link";import type {CSSProperties} from "react";
import {createClient} from "@supabase/supabase-js";
import {redirect} from "next/navigation";
import {getCurrentContext} from "@/lib/auth";

type NavItem={label:string;href:string;icon:string;roles?:string[]};
const nav:NavItem[]=[
  {label:"داشبورد",href:"/dashboard",icon:"⌂"},
  {label:"ثبت گزارش",href:"/reports/new",icon:"＋"},
  {label:"گزارش‌های من",href:"/reports/mine",icon:"▤"},
  {label:"همه گزارش‌ها",href:"/reports",icon:"☷",roles:["main_admin","deputy","battalion_commander","area_manager"]},
  {label:"کاربران",href:"/users",icon:"♟",roles:["main_admin","deputy","battalion_commander"]},
  {label:"حوزه‌ها",href:"/areas",icon:"⌖",roles:["main_admin","deputy","battalion_commander","area_manager"]},
  {label:"دسته‌بندی‌ها",href:"/categories",icon:"▦",roles:["main_admin","deputy","battalion_commander"]},
  {label:"فایل‌ها",href:"/files",icon:"▣"},
  {label:"گزارش‌های تحلیلی",href:"/analytics",icon:"⌁",roles:["main_admin","deputy","battalion_commander","area_manager"]},
  {label:"لاگ‌ها",href:"/audit",icon:"◷",roles:["main_admin","deputy","battalion_commander"]},
  {label:"تنظیمات",href:"/settings",icon:"⚙",roles:["main_admin","deputy","battalion_commander"]}
];

const roleLabels:Record<string,string>={
  main_admin:"مدیر اصلی",
  deputy:"معاون",
  battalion_commander:"فرمانده گردان",
  area_manager:"مدیر حوزه",
  area_force:"نیروی حوزه"
};

const statusLabels:Record<string,string>={
  approved:"تأیید شده",
  rejected:"رد شده",
  pending:"در انتظار بررسی"
};

export default async function Dashboard(){
  const ctx=await getCurrentContext();
  if(!ctx)redirect("/login");

  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const scoped=(q:any)=>{
    if(ctx.profile.role==="area_manager"||ctx.profile.role==="area_force"){
      return q.in("area_id",ctx.areaIds.length?ctx.areaIds:["00000000-0000-0000-0000-000000000000"]);
    }
    return q;
  };

  const now=new Date();
  const startOfToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString();
  const startOfWeek=new Date(now);
  startOfWeek.setDate(now.getDate()-6);
  startOfWeek.setHours(0,0,0,0);
  const weekStart=startOfWeek.toISOString();

  const [all,pending,approved,rejected,today,weekRows,recent,audit,areaRows]=await Promise.all([
    scoped(db.from("reports").select("id",{count:"exact",head:true}).is("deleted_at",null)),
    scoped(db.from("reports").select("id",{count:"exact",head:true}).eq("status","pending").is("deleted_at",null)),
    scoped(db.from("reports").select("id",{count:"exact",head:true}).eq("status","approved").is("deleted_at",null)),
    scoped(db.from("reports").select("id",{count:"exact",head:true}).eq("status","rejected").is("deleted_at",null)),
    scoped(db.from("reports").select("id",{count:"exact",head:true}).gte("created_at",startOfToday).is("deleted_at",null)),
    scoped(db.from("reports").select("created_at,status").gte("created_at",weekStart).is("deleted_at",null).order("created_at",{ascending:true})),
    scoped(db.from("reports").select("id,title,status,created_at,areas(name),categories(name)").is("deleted_at",null).order("created_at",{ascending:false}).limit(6)),
    db.from("audit_logs").select("id,action,created_at,metadata").order("created_at",{ascending:false}).limit(6),
    scoped(db.from("reports").select("area_id,status,areas(name)").is("deleted_at",null))
  ]);

  const total=all.count??0;
  const pendingCount=pending.count??0;
  const approvedCount=approved.count??0;
  const rejectedCount=rejected.count??0;
  const todayCount=today.count??0;

  const trendDays=Array.from({length:7},(_,i)=>{
    const d=new Date(now);
    d.setDate(now.getDate()-(6-i));
    d.setHours(0,0,0,0);
    return {date:d,count:0,label:d.toLocaleDateString("fa-IR",{weekday:"short"}),full:d.toLocaleDateString("fa-IR",{day:"numeric",month:"short"})};
  });
  (weekRows.data??[]).forEach((r:any)=>{
    const key=new Date(r.created_at);
    key.setHours(0,0,0,0);
    const item=trendDays.find(x=>x.date.getTime()===key.getTime());
    if(item)item.count++;
  });
  const maxTrend=Math.max(1,...trendDays.map(x=>x.count));

  const areas=new Map<string,{name:string;total:number;approved:number;pending:number;rejected:number}>();
  (areaRows.data??[]).forEach((r:any)=>{
    const id=String(r.area_id);
    const current=areas.get(id)??{name:r.areas?.name??"نامشخص",total:0,approved:0,pending:0,rejected:0};
    current.total++;
    if(r.status==="approved")current.approved++;
    if(r.status==="pending")current.pending++;
    if(r.status==="rejected")current.rejected++;
    areas.set(id,current);
  });
  const areaRanking=[...areas.values()].sort((a,b)=>b.total-a.total).slice(0,6);
  const maxArea=Math.max(1,...areaRanking.map(x=>x.total));
  const approvalRate=total?Math.round((approvedCount/total)*100):0;
  const reviewRate=total?Math.round(((approvedCount+rejectedCount)/total)*100):0;
  const visibleNav=nav.filter(x=>!x.roles||x.roles.includes(ctx.profile.role));

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">ر</div><div><b>راهبرد شوشتر</b><small>مرکز عملیات و پایش گزارش‌ها</small></div></div>
      <nav>{visibleNav.map(item=><Link className={item.href==="/dashboard"?"active":""} href={item.href} key={item.href}><span>{item.icon}</span>{item.label}</Link>)}</nav>
      <div className="sidebar-footer"><Link className="button" style={{width:"100%"}} href="/logout">خروج امن از سامانه</Link></div>
    </aside>

    <section className="main">
      <header className="header">
        <div className="user"><div className="avatar">{ctx.profile.display_name?.slice(0,1)??"م"}</div><div><b>{ctx.profile.display_name}</b><small>{roleLabels[ctx.profile.role]??ctx.profile.role}</small></div></div>
        <div className="search">جستجو در گزارش‌ها، کاربران و حوزه‌ها… <span>⌕</span></div>
        <div className="head-actions"><Link href="/profile">پروفایل</Link>　<Link href="/files">فایل‌های من</Link></div>
      </header>

      <section className="content">
        <div className="welcome welcome-pro">
          <div>
            <div className="welcome-kicker"><span className="online-dot"/> سامانه عملیاتی فعال</div>
            <h1>مرکز فرماندهی راهبرد</h1>
            <p>نمای کلی عملکرد، گزارش‌ها و فعالیت‌های سامانه در یک نگاه.</p>
            <div className="welcome-meta"><span>امروز {now.toLocaleDateString("fa-IR",{weekday:"long",day:"numeric",month:"long"})}</span><span>آخرین به‌روزرسانی: اکنون</span></div>
          </div>
          <div className="welcome-orbit"><div><strong>{todayCount.toLocaleString("fa-IR")}</strong><small>گزارش امروز</small></div></div>
        </div>

        <div className="quick-actions">
          <Link href="/reports/new"><span>＋</span><div><b>ثبت گزارش جدید</b><small>ارسال گزارش به حوزه</small></div></Link>
          <Link href="/reports/mine"><span>▤</span><div><b>گزارش‌های من</b><small>پیگیری وضعیت ارسال‌ها</small></div></Link>
          {visibleNav.some(x=>x.href==="/reports")&&<Link href="/reports"><span>☷</span><div><b>بررسی گزارش‌ها</b><small>{pendingCount.toLocaleString("fa-IR")} مورد در انتظار</small></div></Link>}
          {visibleNav.some(x=>x.href==="/analytics")&&<Link href="/analytics"><span>⌁</span><div><b>مرکز تحلیل</b><small>روندها و رتبه‌بندی حوزه‌ها</small></div></Link>}
        </div>

        <div className="stats">
          <Stat label="کل گزارش‌ها" value={total} tone="blue" note="تمام گزارش‌های فعال"/>
          <Stat label="گزارش‌های امروز" value={todayCount} tone="cyan" note="ثبت‌شده از ابتدای امروز"/>
          <Stat label="در انتظار بررسی" value={pendingCount} tone="orange" note="نیازمند اقدام"/>
          <Stat label="نرخ تأیید" value={approvalRate} tone="green" suffix="٪" note={reviewRate+"٪ از گزارش‌ها بررسی شده‌اند"}/>
        </div>

        <div className="dashboard-grid dashboard-grid-pro">
          <section className="panel wide">
            <div className="panel-title"><div><span className="panel-eyebrow">۷ روز اخیر</span><h2>روند ثبت گزارش‌ها</h2></div><Link href="/analytics">تحلیل کامل ←</Link></div>
            <div className="trend-chart">
              <div className="trend-grid">{[0,1,2,3].map(x=><span key={x}/>)}</div>
              <div className="trend-bars">{trendDays.map(day=><div className="trend-col" key={day.date.toISOString()}><b>{day.count||""}</b><i style={{height:Math.max(8,(day.count/maxTrend)*145)}}/><small>{day.label}</small></div>)}</div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title"><div><span className="panel-eyebrow">وضعیت فعلی</span><h2>توزیع گزارش‌ها</h2></div></div>
            <div className="status-overview">
              <div className="status-ring" style={{"--approved":approvalRate+"%"} as CSSProperties}><strong>{approvalRate}٪</strong><small>نرخ تأیید</small></div>
              <div className="status-legend">
                <Legend label="تأیید شده" value={approvedCount} cls="approved"/>
                <Legend label="در انتظار" value={pendingCount} cls="pending"/>
                <Legend label="رد شده" value={rejectedCount} cls="rejected"/>
              </div>
            </div>
          </section>

          <section className="panel wide">
            <div className="panel-title"><div><span className="panel-eyebrow">عملکرد حوزه‌ها</span><h2>رتبه‌بندی حوزه‌های فعال</h2></div><Link href="/analytics">مشاهده همه ←</Link></div>
            <div className="area-ranking">
              {areaRanking.length===0?<div className="empty-state">هنوز گزارشی برای رتبه‌بندی ثبت نشده است.</div>:areaRanking.map((area,index)=><div className="area-rank" key={area.name}><b className="rank-number">{String(index+1).padStart(2,"0")}</b><div className="area-rank-main"><div><strong>{area.name}</strong><small>{area.approved} تأیید · {area.pending} در انتظار · {area.rejected} رد</small></div><b>{area.total.toLocaleString("fa-IR")}</b></div><div className="area-bar"><i style={{width:(area.total/maxArea*100)+"%"}}/></div>)}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title"><div><span className="panel-eyebrow">LIVE FEED</span><h2>آخرین فعالیت‌ها</h2></div><Link href="/audit">لاگ کامل ←</Link></div>
            <div className="activity activity-pro">{(audit.data??[]).map((a:any)=><div key={a.id}><span className="activity-dot">◈</span><div><b>{auditLabel(a.action)}</b><small>{new Date(a.created_at).toLocaleString("fa-IR")}</small></div></div>)}</div>
          </section>

          <section className="panel wide">
            <div className="panel-title"><div><span className="panel-eyebrow">RECENT REPORTS</span><h2>آخرین گزارش‌های ثبت‌شده</h2></div><Link href="/reports">مشاهده همه ←</Link></div>
            <div className="recent-table">
              {(recent.data??[]).length===0?<div className="empty-state">هنوز گزارشی ثبت نشده است.</div>:(recent.data??[]).map((r:any)=><Link href={"/reports#"+r.id} className="recent-row" key={r.id}><span className={"status "+r.status}>{statusLabels[r.status]??r.status}</span><div><b>{r.title}</b><small>{r.areas?.name??"—"} · {r.categories?.name??"—"}</small></div><time>{new Date(r.created_at).toLocaleDateString("fa-IR",{day:"numeric",month:"short"})}</time><span className="row-arrow">←</span></Link>)}
            </div>
          </section>
        </div>
      </section>
    </section>
  </main>
}

function Stat({label,value,tone,note,suffix=""}:{label:string;value:number;tone:string;note:string;suffix?:string}){
  return <article className={"stat-card "+tone}><span>{label}</span><strong>{value.toLocaleString("fa-IR")}{suffix}</strong><small>{note}</small></article>
}
function Legend({label,value,cls}:{label:string;value:number;cls:string}){
  return <div className="legend-row"><span className={"legend-dot "+cls}/><span>{label}</span><b>{value.toLocaleString("fa-IR")}</b></div>
}
function auditLabel(a:string){
  const m:Record<string,string>={"report.create":"ثبت گزارش","report.approved":"تأیید گزارش","report.rejected":"رد گزارش","user.create":"ایجاد کاربر","user.update":"ویرایش کاربر","settings.update":"تغییر تنظیمات","auth.login":"ورود به سامانه","auth.logout":"خروج از سامانه","file.upload":"آپلود فایل","file.delete":"حذف فایل","profile.update":"ویرایش پروفایل","category.create":"ایجاد دسته‌بندی","category.update":"ویرایش دسته‌بندی"};
  return m[a]??a;
}