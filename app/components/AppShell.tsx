"use client";

import type {ReactNode} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";

type Props={children:ReactNode};

const nav=[
  {label:"داشبورد",href:"/dashboard",icon:"⌂",roles:[]},
  {label:"ثبت گزارش",href:"/reports/new",icon:"＋",roles:[]},
  {label:"گزارش‌های من",href:"/reports/mine",icon:"▤",roles:[]},
  {label:"همه گزارش‌ها",href:"/reports",icon:"☷",roles:["main_admin","deputy","battalion_commander","area_manager"]},
  {label:"کاربران",href:"/users",icon:"♟",roles:["main_admin","deputy","battalion_commander"]},
  {label:"حوزه‌ها",href:"/areas",icon:"⌖",roles:["main_admin","deputy","battalion_commander","area_manager"]},
  {label:"دسته‌بندی‌ها",href:"/categories",icon:"▦",roles:["main_admin","deputy","battalion_commander"]},
  {label:"فایل‌ها",href:"/files",icon:"▣",roles:[]},
  {label:"گزارش‌های تحلیلی",href:"/analytics",icon:"⌁",roles:["main_admin","deputy","battalion_commander","area_manager"]},
  {label:"لاگ‌ها",href:"/audit",icon:"◷",roles:["main_admin","deputy","battalion_commander"]},
  {label:"تنظیمات",href:"/settings",icon:"⚙",roles:["main_admin","deputy","battalion_commander"]}
];

const roles:Record<string,string>={main_admin:"مدیر اصلی",deputy:"معاون",battalion_commander:"فرمانده گردان",area_manager:"مدیر حوزه",area_force:"نیروی حوزه"};

export default function AppShell({children}:Props){
  const pathname=usePathname();
  const [me,setMe]=useState<any>(null);
  const [mobileOpen,setMobileOpen]=useState(false);
  useEffect(()=>{fetch("/api/me").then(r=>r.ok?r.json():null).then(setMe).catch(()=>null)},[]);
  const role=me?.profile?.role;
  const visible=nav.filter(x=>!x.roles.length||(role&&x.roles.includes(role)));
  const active=(href:string)=>href==="/dashboard"?pathname==="/dashboard":pathname===href||pathname.startsWith(href+"/");
  const initials=me?.profile?.display_name?.slice(0,1)??"ر";
  const pageTitle=pathname==="/reports/new"?"ثبت گزارش جدید":pathname==="/reports/mine"?"گزارش‌های من":pathname==="/reports"?"همه گزارش‌ها":pathname==="/users"?"مدیریت کاربران":pathname==="/users/new"?"ایجاد کاربر":pathname==="/areas"?"مدیریت حوزه‌ها":pathname==="/analytics"?"گزارش‌های تحلیلی":pathname==="/categories"?"دسته‌بندی‌ها":pathname==="/audit"?"لاگ‌های سامانه":pathname==="/files"?"فایل‌ها":pathname==="/settings"?"تنظیمات":"راهبرد شوشتر";

  const closeMobile=()=>setMobileOpen(false);

  return <div className="app-shell unified-shell">
    {mobileOpen&&<button className="sidebar-backdrop" aria-label="بستن منو" onClick={closeMobile}/>} 
    <aside className={"sidebar"+(mobileOpen?" open":"")}>
      <div className="brand">
        <div className="brand-mark">ر</div>
        <div className="brand-copy"><b>راهبرد شوشتر</b><small>مرکز عملیات و پایش</small></div>
        <span className="brand-status"/>
      </div>
      <div className="sidebar-scroll">
        <div className="sidebar-section"><span>فضای کاری</span><nav>
          {visible.filter(x=>["/dashboard","/reports/new","/reports/mine","/reports"].includes(x.href)).map(x=><Link key={x.href} href={x.href} className={active(x.href)?"active":""} onClick={closeMobile}><span className="nav-icon">{x.icon}</span><span className="nav-label">{x.label}</span></Link>)}
        </nav></div>
        <div className="sidebar-section"><span>مدیریت سامانه</span><nav>
          {visible.filter(x=>["/users","/areas","/categories","/files","/analytics","/audit","/settings"].includes(x.href)).map(x=><Link key={x.href} href={x.href} className={active(x.href)?"active":""}><span className="nav-icon">{x.icon}</span><span className="nav-label">{x.label}</span></Link>)}
        </nav></div>
      </div>
      <div className="sidebar-profile">
        <Link href="/profile" className="sidebar-user" onClick={closeMobile}><div className="avatar sidebar-avatar">{initials}</div><div><b>{me?.profile?.display_name??"کاربر سامانه"}</b><small>{roles[role]??"در حال بارگذاری"}</small></div><span>‹</span></Link>
        <Link className="sidebar-logout" href="/logout" onClick={closeMobile}><span>↪</span>خروج امن</Link>
      </div>
    </aside>
    <div className="main">
      <header className="header unified-header">
        <button className="menu-toggle" type="button" aria-label="منوی سامانه" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(value=>!value)}><span/><span/><span/></button>
        <div className="header-context"><span>سامانه مدیریت و پایش</span><b>{pageTitle}</b></div>
        <div className="header-spacer"/>
        <Link className="header-profile" href="/profile"><span className="header-live"/>{me?.profile?.display_name??"کاربر"}</Link>
      </header>
      {children}
    </div>
  </div>
}
