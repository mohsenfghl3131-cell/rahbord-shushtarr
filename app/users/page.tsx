"use client";
import AppShell from "@/app/components/AppShell";
import { useEffect, useState } from "react";
import Link from "next/link";

const roleLabels: Record<string, string> = {
  main_admin: "مدیر اصلی",
  deputy: "معاون",
  battalion_commander: "فرمانده گردان",
  area_manager: "مدیر حوزه",
  area_force: "نیروی حوزه",
};

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState("");

  async function load() {
    setError("");
    const [usersRes, meRes] = await Promise.all([fetch("/api/users"), fetch("/api/me")]);
    const usersData = await usersRes.json();
    const meData = await meRes.json();
    if (!usersRes.ok) throw new Error(usersData.message || "دریافت کاربران انجام نشد.");
    setUsers(usersData.users ?? []);
    setIsAdmin(meData.profile?.role === "main_admin" || meData.role === "main_admin");
  }

  useEffect(() => { load().catch(e => setError(e.message)); }, []);

  async function toggleUser(user: any) {
    const next = !user.is_active;
    if (!confirm(next ? "این حساب فعال شود؟" : "این حساب غیرفعال شود؟")) return;
    setBusy(user.id);
    setNotice("");
    const res = await fetch("/api/users/" + user.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: next })
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "تغییر وضعیت انجام نشد.");
    else {
      setUsers(items => items.map(x => x.id === user.id ? { ...x, is_active: next } : x));
      setNotice("وضعیت حساب کاربر به‌روزرسانی شد.");
    }
    setBusy("");
  }

  return <AppShell><main className="shell unified-page">
    <div className="topbar"><div><span className="eyebrow">راهبرد شوشتر</span><h1>مدیریت کاربران</h1><p>مدیریت حساب‌ها، نقش‌ها و دسترسی حوزه‌ای</p></div><Link className="button" href="/users/new">＋ کاربر جدید</Link></div>
    {notice && <div className="notice">{notice}</div>}
    {error && <div className="error">{error}</div>}
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="users-grid">{users.map(u => <article className="user-card" key={u.id}>
        <div className="avatar">{u.display_name?.[0] ?? "ک"}</div>
        <div className="user-info"><b>{u.display_name}</b><small>{u.user_code}</small><span>{roleLabels[u.role] ?? u.role}</span>
          <small>{(u.user_area_access ?? []).map((a: any) => a.areas?.name).filter(Boolean).join("، ") || "بدون حوزه تخصیص‌یافته"}</small>
        </div>
        <div className={u.is_active ? "active-dot" : "inactive-dot"}>{u.is_active ? "فعال" : "غیرفعال"}</div>
        {isAdmin && u.user_code !== "ADMIN001" && <button className="small-btn" disabled={busy === u.id} onClick={() => toggleUser(u)}>{busy === u.id ? "..." : u.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}</button>}
      </article>)}</div>
    </section>
  </main></AppShell>;
}