"use client";

import AppShell from "@/app/components/AppShell";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type DashboardData = {
  area: { id: string; name: string };
  status: { total: number; approved: number; pending: number; rejected: number };
  trend: { date: string; label: string; count: number }[];
  missionProgress: { id: string; title: string; unit: string; group: string; target: number; actual: number; percent: number; submitted: boolean }[];
  summary: { activeMissions: number; submittedMissions: number; missionAverage: number; reportCount: number };
  updatedAt?: string;
};

const fa = (value: number) => value.toLocaleString("fa-IR");

function LineChart({ data }: { data: DashboardData["trend"] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  const points = data.map((item, index) => {
    const x = data.length <= 1 ? 50 : 8 + (index / (data.length - 1)) * 84;
    const y = 88 - (item.count / max) * 68;
    return x + "," + y;
  }).join(" ");
  return (
    <div className="command-chart-wrap">
      <svg viewBox="0 0 100 100" role="img" aria-label="نمودار خطی روند ثبت گزارش‌ها" className="command-line-svg">
        {[20, 42, 64, 88].map((y) => <line key={y} x1="5" x2="95" y1={y} y2={y} stroke="currentColor" opacity=".12" strokeDasharray="2 2" />)}
        <polyline points={points} fill="none" stroke="#20b9e9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((item, index) => {
          const x = data.length <= 1 ? 50 : 8 + (index / (data.length - 1)) * 84;
          const y = 88 - (item.count / max) * 68;
          return <circle key={item.date} cx={x} cy={y} r="1.8" fill="#20b9e9"><title>{item.label}: {fa(item.count)} گزارش</title></circle>;
        })}
      </svg>
      <div className="command-chart-labels">
        {data.filter((_, index) => index % 2 === 0 || index === data.length - 1).map((item) => <span key={item.date}>{item.label}</span>)}
      </div>
    </div>
  );
}

export default function AreaCommandDashboard() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.id) return;
    fetch("/api/command-dashboard?area_id=" + encodeURIComponent(params.id), { cache: "no-store" })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.message || "دریافت داشبورد حوزه ناموفق بود.");
        setData(value);
      })
      .catch((reason) => setError(reason.message || "خطا در دریافت اطلاعات حوزه."))
      .finally(() => setLoading(false));
  }, [params.id]);

  const reportMax = Math.max(1, data?.status.total ?? 0);

  return (
    <AppShell>
      <main className="shell unified-page">
        <div className="topbar">
          <div><span className="eyebrow">مرکز پایش حوزه‌ها</span><h1>داشبورد فرماندهی</h1><p>{data?.area.name || "نمایش جزئیات عملکرد حوزه"}</p></div>
          <Link className="button" href="/dashboard">بازگشت به داشبورد اصلی</Link>
        </div>
        {loading ? <section className="panel" style={{ marginTop: 18 }}>در حال دریافت آمار واقعی حوزه…</section> :
          error ? <div className="error" style={{ marginTop: 18 }}>{error}</div> :
          data ? <>
            <section className="panel command-area-hero" style={{ marginTop: 18 }}>
              <div><span className="panel-eyebrow">گزارش وضعیت حوزه</span><h2>{data.area.name}</h2><p>نمای یکپارچه مأموریت‌ها، گزارش‌ها و روند فعالیت در ۱۴ روز اخیر</p></div>
              <div className="command-hero-mark">ر</div>
            </section>
            <section className="stats command-stats">
              <div className="stat-card blue"><span>کل گزارش‌های ثبت‌شده</span><strong>{fa(data.status.total)}</strong><small>تمام گزارش‌های فعال این حوزه</small></div>
              <div className="stat-card green"><span>گزارش‌های تأییدشده</span><strong>{fa(data.status.approved)}</strong><small>تأیید نهایی</small></div>
              <div className="stat-card orange"><span>در انتظار بررسی</span><strong>{fa(data.status.pending)}</strong><small>نیازمند رسیدگی</small></div>
              <div className="stat-card red"><span>گزارش‌های ردشده</span><strong>{fa(data.status.rejected)}</strong><small>ردشده توسط بررسی‌کنندگان</small></div>
              <div className="stat-card violet"><span>مأموریت‌های فعال</span><strong>{fa(data.summary.activeMissions)}</strong><small>تعریف‌شده در سامانه</small></div>
              <div className="stat-card cyan"><span>مأموریت‌های ثبت‌شده</span><strong>{fa(data.summary.submittedMissions)}</strong><small>دارای عملکرد ثبت‌شده</small></div>
            </section>
            <section className="dashboard-grid command-charts-grid">
              <section className="panel wide">
                <div className="panel-title"><div><span className="panel-eyebrow">۱۴ روز اخیر</span><h2>روند ثبت گزارش‌ها</h2></div></div>
                <LineChart data={data.trend} />
              </section>
              <section className="panel">
                <div className="panel-title"><div><span className="panel-eyebrow">وضعیت گزارش‌ها</span><h2>ترکیب گزارش‌های حوزه</h2></div></div>
                <div className="command-report-bars">
                  {[
                    { label: "تأییدشده", value: data.status.approved, color: "#16b978" },
                    { label: "در انتظار", value: data.status.pending, color: "#e6a23c" },
                    { label: "ردشده", value: data.status.rejected, color: "#e35b6b" }
                  ].map((item) => <div className="command-bar-row" key={item.label}><div><span>{item.label}</span><b>{fa(item.value)}</b></div><i><em style={{ width: (item.value / reportMax * 100) + "%", background: item.color }} /></i></div>)}
                </div>
              </section>
              <section className="panel wide">
                <div className="panel-title"><div><span className="panel-eyebrow">پیشرفت مأموریت‌ها</span><h2>مقایسه عملکرد با هدف تعیین‌شده</h2></div><b className="command-average">{fa(data.summary.missionAverage)}٪ میانگین تحقق</b></div>
                {data.missionProgress.length === 0 ? <div className="empty-state">در حال حاضر مأموریت فعالی تعریف نشده است.</div> :
                  <div className="command-mission-list">
                    {data.missionProgress.map((mission) => <div className="command-mission" key={mission.id}>
                      <div className="command-mission-heading"><div><b>{mission.title}</b><small>{mission.group} · {mission.unit || "واحد ثبت نشده"}</small></div><strong>{fa(mission.percent)}٪</strong></div>
                      <div className="command-mission-track"><i style={{ width: Math.min(100, mission.percent) + "%" }} /></div>
                      <div className="command-mission-values"><span>عملکرد: {fa(mission.actual)} {mission.unit}</span><span>هدف: {fa(mission.target)} {mission.unit}</span><span>{mission.submitted ? "ثبت شده" : "هنوز ثبت نشده"}</span></div>
                    </div>)}
                  </div>
                }
              </section>
            </section>
            <p className="command-updated">اطلاعات بر اساس داده‌های ثبت‌شده در سامانه · آخرین دریافت: {new Date(data.updatedAt || Date.now()).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</p>
          </> : null}
      </main>
    </AppShell>
  );
}
