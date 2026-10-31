"use client";
import { useEffect, useState } from "react";
const DEFAULT_TITLE = "قدم‌های کوچک و پیوسته، مسیرهای بزرگ را می‌سازند.";
const DEFAULT_BODY = "با دقت، همدلی و مسئولیت‌پذیری، هر روز می‌توانیم یک گام بهتر از دیروز باشیم.";
const STORAGE_KEY = "rahbord-daily-message-v1";
export default function DailyMessage() {
  const [title,setTitle] = useState(DEFAULT_TITLE);
  const [body,setBody] = useState(DEFAULT_BODY);
  const [editTitle,setEditTitle] = useState(DEFAULT_TITLE);
  const [editBody,setEditBody] = useState(DEFAULT_BODY);
  const [editing,setEditing] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { const value = JSON.parse(saved); if (typeof value.title === "string") setTitle(value.title); if (typeof value.body === "string") setBody(value.body); }
    } catch {}
  }, []);
  function startEdit(){setEditTitle(title);setEditBody(body);setEditing(true);}
  function save(){
    const next={title:editTitle.trim(),body:editBody.trim()};
    if(!next.title)return;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));setTitle(next.title);setBody(next.body);setEditing(false);}
    catch{window.alert("ذخیره پیام در این مرورگر انجام نشد.");}
  }
  return <section className="daily-message-card" aria-label="پیام روز">
    <div className="daily-message-art" aria-hidden="true"><span/><span/><span/></div>
    <div className="daily-message-content">
      <div className="daily-message-kicker"><span>✦</span> پیام روز</div>
      {editing ? <div className="daily-message-editor">
        <label>عنوان پیام</label><textarea value={editTitle} maxLength={180} rows={2} onChange={e=>setEditTitle(e.target.value)}/>
        <label>متن توضیحی</label><textarea value={editBody} maxLength={400} rows={3} onChange={e=>setEditBody(e.target.value)}/>
        <div className="daily-message-actions"><button type="button" onClick={save} disabled={!editTitle.trim()}>ذخیره پیام</button><button type="button" onClick={()=>setEditing(false)}>انصراف</button></div>
      </div> : <><h2>{title}</h2><p>{body}</p><div className="daily-message-signature"><i/> راهبرد شوشتر <span>•</span> اندیشه امروز</div></>}
    </div>
    {!editing && <button className="daily-message-edit" type="button" onClick={startEdit}>✎ ویرایش پیام</button>}
    <div className="daily-message-mark" aria-hidden="true">〝</div>
  </section>;
}
