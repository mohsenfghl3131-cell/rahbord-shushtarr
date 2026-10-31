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
const roleOptions = Object.entries(roleLabels);

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState("");
  const [deleting, setDeleting] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [draft, setDraft] = useState({ display_name: "", role: "area_force", area_ids: [] as string[] });

  async function load() {
    setError("");
    const [usersRes, meRes, areasRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/me"),
      fetch("/api/areas"),
    ]);
    const usersData = await usersRes.json();
    const meData = await meRes.json();
    const areasData = areasRes.ok ? await areasRes.json() : { areas: [] };
    if (!usersRes.ok) throw new Error(usersData.message || "دریافت کاربران انجام نشد.");
    setUsers(usersData.users ?? []);
    setAreas(areasData.areas ?? []);
    setIsAdmin(meData.profile?.role === "main_admin");
  }

  useEffect(() => { load().catch(e => setError(e.message)); }, []);

  function beginEdit(user: any) {
    setEditing(user);
    setDraft({
      display_name: user.display_name ?? "",
      role: user.role ?? "area_force",
      area_ids: (user.user_area_access ?? []).map((x: any) => x.area_id).filter(Boolean),
    });
    setError("");
    setNotice("");
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(editing.id);
    setError("");
    setNotice("");
    const res = await fetch("/api/users/" + editing.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "ذخیره تغییرات انجام نشد.");
    } else {
      setNotice("اطلاعات و دسترسی‌های کاربر به‌روزرسانی شد.");
      setEditing(null);
      await load();
    }
    setBusy("");
  }

  async function toggleUser(user: any) {
    const next = !user.is_active;
    if (!confirm(next ? "این حساب فعال شود؟" : "این حساب غیرفعال شود؟")) return;
    setBusy(user.id);
    setError("");
    setNotice("");
    const res = await fetch("/api/users/" + user.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.message || "تغییر وضعیت انجام نشد.");
    else {
      setUsers(items => items.map(x => x.id === user.id ? { ...x, is_active: next } : x));
      setNotice("وضعیت حساب کاربر به‌روزرسانی شد.");
    }
    setBusy("");
  }

  async function deleteUser(user: any) {
    if (user.user_code === "ADMIN001") {
      setError("حساب اصلی سامانه قابل حذف نیست.");
      return;
    }
    if (!confirm(`کاربر «${user.display_name}» با تمام دسترسی‌هایش حذف شود؟ این عملیات قابل بازگشت نیست.`)) return;
    setDeleting(user.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/users/" + user.id, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "حذف کاربر انجام نشد.");
      } else {
        setUsers(items => items.filter(x => x.id !== user.id));
        if (editing?.id === user.id) setEditing(null);
        setNotice("حساب کاربر با موفقیت حذف شد.");
      }
    } catch {
      setError("ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.");
    } finally {
      setDeleting("");
    }
  }

  function toggleArea(areaId: string) {
    setDraft(current => ({
      ...current,
      area_ids: current.area_ids.includes(areaId)
        ? current.area_ids.filter(id => id !== areaId)
        : [...current.area_ids, areaId],
    }));
  }

  return <AppShell><main className="shell unified-page">
    <div className="topbar">
      <div><span className="eyebrow">راهبرد شوشتر</span><h1>مدیریت کاربران</h1><p>مدیریت حساب‌ها، نقش‌ها و دسترسی حوزه‌ای</p></div>
      <Link className="button" href="/users/new">＋ کاربر جدید</Link>
    </div>
    {notice && <div className="notice">{notice}</div>}
    {error && <div className="error">{error}</div>}

    {editing && isAdmin && <section className="form-panel" style={{ marginTop: 18 }}>
      <div className="form-step"><span>✎</span><div><b>ویرایش کاربر: {editing.user_code}</b><small>نام نمایشی، نقش و حوزه‌های مجاز را تنظیم کنید.</small></div></div>
      <label>نام و نام خانوادگی<input value={draft.display_name} onChange={e => setDraft(x => ({ ...x, display_name: e.target.value }))} /></label>
      <label>نقش کاربر<select value={draft.role} onChange={e => setDraft(x => ({ ...x, role: e.target.value }))}>{roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="area-access-list">
        <b>حوزه‌های مجاز</b>
        <div className="area-access-options">
          {areas.map(area => <label key={area.id} className="area-access-option">
            <input type="checkbox" checked={draft.area_ids.includes(area.id)} onChange={() => toggleArea(area.id)} />
            <span>{area.name}</span>
          </label>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button className="button" disabled={busy === editing.id || !draft.display_name.trim()} onClick={saveEdit}>{busy === editing.id ? "در حال ذخیره…" : "ذخیره تغییرات"}</button>
        <button className="small-btn" onClick={() => setEditing(null)}>انصراف</button>
      </div>
    </section>}

    <section className="panel" style={{ marginTop: 18 }}>
      <div className="users-grid">{users.map(user => <article className="user-card" key={user.id}>
        <div className="avatar">{user.display_name?.[0] ?? "ک"}</div>
        <div className="user-info">
          <b>{user.display_name}</b><small>{user.user_code}</small><span>{roleLabels[user.role] ?? user.role}</span>
          <small>{(user.user_area_access ?? []).map((a: any) => a.areas?.name).filter(Boolean).join("، ") || "بدون حوزه تخصیص‌یافته"}</small>
        </div>
        <div className={user.is_active ? "active-dot" : "inactive-dot"}>{user.is_active ? "فعال" : "غیرفعال"}</div>
        {isAdmin && <div className="user-actions">
          {user.user_code !== "ADMIN001" && <button className="small-btn" disabled={busy === user.id} onClick={() => toggleUser(user)}>{busy === user.id ? "…" : user.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}</button>}
          <button className="small-btn" onClick={() => beginEdit(user)}>ویرایش دسترسی</button>
          {user.user_code !== "ADMIN001" && <button className="small-btn btn-danger" disabled={deleting === user.id || busy === user.id} onClick={() => deleteUser(user)}>{deleting === user.id ? "در حال حذف…" : "حذف کاربر"}</button>}
        </div>}
      </article>)}</div>
    </section>
  </main></AppShell>;
}
