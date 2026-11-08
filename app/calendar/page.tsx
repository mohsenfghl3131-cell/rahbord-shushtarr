"use client";

import AppShell from "@/app/components/AppShell";
import { useEffect, useMemo, useState } from "react";

type Mission = {
  id: string;
  title: string;
  description?: string | null;
  unit?: string | null;
  target_value?: number | null;
  is_active?: boolean;
  created_at?: string;
  deadline_at?: string | null;
  category_groups?: { name?: string } | { name?: string }[] | null;
};

const fa = (value: number) => Number(value || 0).toLocaleString("fa-IR");
const dateLabel = (value: string) => new Date(value).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
const groupName = (mission: Mission) => {
  const group = Array.isArray(mission.category_groups) ? mission.category_groups[0] : mission.category_groups;
  return group?.name || "بدون بخش";
};

export default function MissionCalendarPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/missions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "دریافت تقویم مأموریت‌ها ناموفق بود.");
      setMissions(data.missions || []);
      setUpdatedAt(new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) {
      setError(e.message || "خطا در دریافت تقویم.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const now = Date.now();
  const classified = useMemo(() => missions.map((mission) => {
    const deadline = mission.deadline_at ? new Date(mission.deadline_at).getTime() : null;
    const expired = deadline !== null && deadline < now;
    const daysLeft = deadline === null ? null : Math.ceil((deadline - now) / 86400000);
    return { ...mission, deadline, expired, daysLeft };
  }).sort((a, b) => {
    if (a.deadline === null && b.deadline !== null) return 1;
    if (a.deadline !== null && b.deadline === null) return -1;
    return (a.deadline ?? Infinity) - (b.deadline ?? Infinity);
  }), [missions, now]);

  const counts = useMemo(() => ({
    total: missions.length,
    upcoming: classified.filter((m) => m.is_active !== false && m.deadline !== null && !m.expired).length,
    overdue: classified.filter((m) => m.is_active !== false && m.expired).length,
    noDeadline: classified.filter((m) => !m.deadline).length
  }), [missions, classified]);

  const visible = classified.filter((m) => {
    if (filter === "upcoming") return m.is_active !== false && m.deadline !== null && !m.expired;
    if (filter === "overdue") return m.is_active !== false && m.expired;
    if (filter === "no-deadline") return !m.deadline;
    return true;
  });

  return <AppShell><main className="shell unified-page">
    <div className="topbar">
      <div><span className="eyebrow">MISSION TIMELINE</span><h1>تقویم مأموریت‌ها</h1><p>مهلت‌ها، مأموریت‌های نزدیک به سررسید و موارد عقب‌افتاده</p></div>
      <button className="button" type="button" onClick={load} disabled={loading}>{loading ? "در حال بروزرسانی…" : "بروزرسانی تقویم"}</button>
    </div>
    {error && <div className="error" role="alert">{error}</div>}
    <section className="performance-kpis">
      <article><small>کل مأموریت‌ها</small><strong>{fa(counts.total)}</strong></article>
      <article><small>دارای مهلت پیش‌رو</small><strong>{fa(counts.upcoming)}</strong></article>
      <article><small>مهلت گذشته</small><strong>{fa(counts.overdue)}</strong></article>
      <article><small>بدون مهلت تعیین‌شده</small><strong>{fa(counts.noDeadline)}</strong></article>
    </section>
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div><span className="panel-eyebrow">DEADLINE TRACKER</span><h2>برنامه زمانی مأموریت‌ها</h2></div>
        <small>{updatedAt ? "آخرین بروزرسانی: " + updatedAt : " "}</small>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 18px" }}>
        {[["all","همه مأموریت‌ها"],["upcoming","مهلت‌های پیش‌رو"],["overdue","عقب‌افتاده‌ها"],["no-deadline","بدون مهلت"]].map(([value,label]) =>
          <button key={value} type="button" className={filter === value ? "button neon-button" : "button"} onClick={() => setFilter(value)}>{label}</button>
        )}
      </div>
      {loading ? <div className="empty-state">در حال بارگذاری مأموریت‌ها…</div> :
       visible.length === 0 ? <div className="empty-state">در این دسته مأموریتی برای نمایش وجود ندارد.</div> :
       <div style={{ display: "grid", gap: 12 }}>
        {visible.map((mission) => {
          const status = mission.is_active === false ? "غیرفعال" : !mission.deadline ? "بدون مهلت" : mission.expired ? "مهلت گذشته" : mission.daysLeft === 0 ? "امروز سررسید می‌شود" : mission.daysLeft === 1 ? "فردا سررسید می‌شود" : "در مهلت";
          const tone = mission.is_active === false ? "#64748b" : mission.expired ? "#e36b78" : !mission.deadline ? "#94a3b8" : mission.daysLeft !== null && mission.daysLeft <= 3 ? "#e5a33d" : "#20b486";
          return <article key={mission.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center", padding: 16, border: "1px solid var(--border, rgba(148,163,184,.22))", borderRadius: 16, background: "var(--panel-soft, rgba(148,163,184,.06))" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b>{mission.title}</b><span style={{ color: tone, fontSize: 12, fontWeight: 700 }}>{status}</span></div>
              <small style={{ display: "block", opacity: .72, marginTop: 6 }}>{groupName(mission)} · سهمیه پایه: {fa(Number(mission.target_value || 0))} {mission.unit || "عدد"}</small>
              {mission.description ? <p style={{ margin: "8px 0 0", opacity: .8, fontSize: 13 }}>{mission.description}</p> : null}
            </div>
            <div style={{ textAlign: "end", minWidth: 116 }}>
              <b style={{ color: tone, display: "block" }}>{mission.deadline ? dateLabel(mission.deadline_at!) : "تعیین نشده"}</b>
              <small style={{ opacity: .72 }}>{mission.deadline && !mission.expired ? (mission.daysLeft === 0 ? "امروز" : fa(mission.daysLeft!) + " روز باقی‌مانده") : mission.expired ? fa(Math.abs(mission.daysLeft || 0)) + " روز از مهلت گذشته" : " "}</small>
            </div>
          </article>;
        })}
       </div>}
    </section>
  </main></AppShell>;
}
