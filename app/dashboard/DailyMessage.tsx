"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
const DEFAULT_TITLE="قدم‌های کوچک و پیوسته، مسیرهای بزرگ را می‌سازند.";
const DEFAULT_BODY="با دقت، همدلی و مسئولیت‌پذیری، هر روز می‌توانیم یک گام بهتر از دیروز باشیم.";
export default function DailyMessage({canEdit=false}:{canEdit?:boolean}){
 const [title,setTitle]=useState(DEFAULT_TITLE);const [body,setBody]=useState(DEFAULT_BODY);
 useEffect(()=>{let active=true;fetch("/api/daily-message",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>{if(active&&v){setTitle(v.title||DEFAULT_TITLE);setBody(v.body||DEFAULT_BODY)}}).catch(()=>{});return()=>{active=false}},[]);
 return <section className="daily-message-card" aria-label="پیام روز"><div className="daily-message-art" aria-hidden="true"><span/><span/><span/></div><div className="daily-message-content"><div className="daily-message-kicker"><span>✦</span> پیام روز</div><h2>{title}</h2><p>{body}</p><div className="daily-message-signature"><i/> راهبرد شوشتر <span>•</span> اندیشه امروز</div></div>{canEdit&&<Link className="daily-message-edit" href="/daily-message" aria-label="مدیریت پیام روز" title="مدیریت پیام روز">✎</Link>}<div className="daily-message-mark" aria-hidden="true">〝</div></section>;
}
