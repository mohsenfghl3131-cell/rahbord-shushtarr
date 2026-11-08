"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Mission = { mission_id: string; title: string; quota: number; actual: number; battalion_quota: number; battalion_actual: number };
type Area = {
  id: string; name: string; quota: number; actual: number; remaining: number; surplus?: number; percent: number;
  battalion_quota: number; battalion_actual: number; battalion_contribution_percent: number;
  missions: Mission[];
};

const fa = (n: number) => Number(n || 0).toLocaleString("fa-IR", { maximumFractionDigits: 2 });
const quotaFa = (n: number) => Math.ceil(Number(n || 0)).toLocaleString("fa-IR");
const clamp = (n: number) => Math.max(0, Math.min(100, n));

function LineChart({ labels, values, label }: { labels: string[]; values: number[]; label: string }) {
  if (!values.length) return <div className="command-empty-chart">هنوز داده‌ای برای رسم نمودار وجود ندارد.</div>;
  const width = 620, left = 34, right = 586, top = 24, bottom = 160;
  const max = Math.max(100, ...values.map(v => Math.max(0, v)));
  const points = values.map((v, i) => ({
    x: values.length === 1 ? (left + right) / 2 : left + i * ((right - left) / (values.length - 1)),
    y: bottom - (Math.max(0, v) / max) * (bottom - top)
  }));
  const polyline = points.map(p => p.x + "," + p.y).join(" ");
  return <div className="command-line-wrap">
    <svg viewBox={`0 0 ${width} 194`} role="img" aria-label={label}>
      {[0, .5, 1].map((ratio, i) => <g key={i}><line x1={left} x2={right} y1={top + ratio * (bottom - top)} y2={top + ratio * (bottom - top)} stroke="currentColor" opacity=".13" strokeDasharray="4 5"/><text x="25" y={top + ratio * (bottom - top) + 4} textAnchor="end" fill="currentColor" opacity=".65" fontSize="10">{fa(Math.round(max * (1-ratio)))}</text></g>)}
      <polyline points={polyline} fill="none" stroke="#35baff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      {points.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="5" fill="#35baff" stroke="var(--panel,#101827)" strokeWidth="2"/><text x={p.x} y="183" textAnchor="middle" fill="currentColor" fontSize="9">{labels[i].length > 12 ? labels[i].slice(0,12)+"…" : labels[i]}</text></g>)}
    </svg>
    <small>{label}</small>
  </div>;
}

export default function CommandDashboard({ initialAreaId, detailOnly = false }: { initialAreaId?: string; detailOnly?: boolean }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(initialAreaId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/command-dashboard/battalions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "دریافت داشبورد فرماندهی ناموفق بود.");
      setAreas(data.areas || []);
    } catch (e: any) {
      setError(e.message || "خطا در دریافت اطلاعات فرماندهی.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => areas.reduce((acc, area) => ({
    quota: acc.quota + Number(area.quota || 0),
    actual: acc.actual + Number(area.actual || 0),
  }), { quota: 0, actual: 0 }), [areas]);

  const chosen = areas.find(area => area.id === selectedArea) || null;
  const overallPercent = totals.quota ? totals.actual / totals.quota * 100 : 0;
  const donutPercent = chosen ? clamp(chosen.percent) : clamp(overallPercent);

  return (
    <section className="panel command-dashboard command-pro-panel">
      <div className="command-dashboard-head">
        <div>
          <span className="panel-eyebrow">مرکز کنترل و پایش هوشمند</span>
          <h2>داشبورد فرماندهی</h2>
          <p>{chosen ? "نمای جزئیات و عملکرد حوزه انتخاب‌شده" : "ابتدا حوزه را انتخاب کنید تا مأموریت‌ها و امتیاز عملکرد آن را ببینید."}</p>
        </div>
        <div className="command-live"><i/> داده‌های سامانه</div>
      </div>

      {loading ? <div className="empty-state">در حال دریافت اطلاعات حوزه‌ها و مأموریت‌ها…</div> :
       error ? <div className="error">{error}</div> :
       areas.length === 0 ? <div className="empty-state">برای این حساب حوزه‌ای جهت نمایش تعریف نشده است.</div> :
       <>
        {chosen ? (
          <div className="command-selected-area">
            <div className="command-detail-toolbar">
              <Link href="/dashboard">→ بازگشت به فهرست حوزه‌ها</Link>
              <span>نمایش جزئیات حوزه</span>
            </div>
            <div className="command-selected-heading">
              <div><span>حوزه انتخاب‌شده</span><h3>{chosen.name}</h3><small>مأموریت‌ها، درصد تحقق و امتیاز عملکرد حوزه</small></div>
              <div className="command-area-badge">حوزه عملیاتی</div>
            </div>
            <div className="command-detail-kpis">
              <div><small>امتیاز کلی حوزه از ۱۰۰</small><b className="good">{fa(clamp(chosen.percent))} / ۱۰۰</b></div>
              <div><small>درصد تحقق کل مأموریت‌ها</small><b>{fa(chosen.percent)}٪</b></div>
              <div><small>مجموع سهمیه حوزه</small><b>{quotaFa(chosen.quota)}</b></div>
              <div><small>مجموع تحقق ثبت‌شده</small><b>{fa(chosen.actual)}</b></div>
            </div>

            <div className="command-detail-analytics">
              <article className="command-chart-card command-donut-card">
                <h4>امتیاز و تحقق کلی حوزه</h4>
                <div className="command-donut" style={{ background: `conic-gradient(#20c997 0% ${donutPercent}%,rgba(148,163,184,.2) ${donutPercent}% 100%)` }}>
                  <div><b>{fa(clamp(chosen.percent))}</b><small>امتیاز از ۱۰۰</small></div>
                </div>
                <p>تحقق {fa(chosen.actual)} از سهمیه {quotaFa(chosen.quota)}</p>
                
              </article>
              <article className="command-chart-card command-line-card">
                <h4>نمودار خطی تحقق مأموریت‌های حوزه</h4>
                <LineChart labels={chosen.missions.map(m => m.title)} values={chosen.missions.map(m => m.quota ? clamp(m.actual / m.quota * 100) : 0)} label="درصد تحقق هر مأموریت به ترتیب فهرست مأموریت‌ها"/>
              </article>
            </div>

            <section className="command-detail-section">
              <div className="command-section-heading">
                <div><span>پایش اجرایی</span><h4>مأموریت‌های حوزه</h4></div>
                <b>{fa(chosen.missions.length)} مأموریت</b>
              </div>
              {chosen.missions.length ? <div className="command-mission-grid">{chosen.missions.map(m => {
                const percent = m.quota ? clamp(m.actual / m.quota * 100) : 0;
                const battalionShare = m.battalion_quota ? clamp(m.actual / m.battalion_quota * 100) : 0;
                return <article className="command-mission-item" key={m.mission_id}>
                  <div className="command-mission-item-head"><b>{m.title}</b><strong>{fa(percent)}٪ تحقق حوزه</strong></div>
                  <div className="command-progress"><i style={{width: clamp(percent)+"%"}}/></div>
                  <div className="command-mission-item-stats">
                    <span>سهمیه حوزه: {quotaFa(m.quota)}</span>
                    <span>تحقق حوزه: {fa(m.actual)}</span>
                    <span>سهمیه کل گردان: {quotaFa(m.battalion_quota)}</span>
                    <span>تحقق کل گردان: {fa(m.battalion_actual)}</span>
                    <span>میزان تکمیل سهمیه گردان توسط این حوزه: {fa(battalionShare)}٪</span>
                  </div>
                </article>;
              })}</div> : <div className="command-empty-chart">برای این حوزه مأموریت فعالی ثبت نشده است.</div>}
            </section>

          </div>
        ) : detailOnly ? (
          <div className="empty-state">حوزه موردنظر پیدا نشد یا دسترسی مشاهده آن را ندارید. <Link href="/dashboard">بازگشت به داشبورد</Link></div>
        ) : (
          <div className="command-area-overview">
            <div className="command-overview-heading"><div><span>انتخاب حوزه</span><h3>فهرست حوزه‌ها</h3><small>برای مشاهده امتیاز و جزئیات تحقق مأموریت‌ها، حوزه را انتخاب کنید.</small></div><span>{fa(areas.length)} حوزه</span></div>
            <div className="command-area-grid">{areas.map((area,index)=><Link href={"/dashboard/command/"+area.id} className="command-area-card" key={area.id}>
              <span className="command-area-index">{String(index+1).padStart(2,"0")}</span>
              <span className="command-area-card-main"><b>{area.name}</b><small>{fa(area.missions.length)} مأموریت</small></span>
              <span className="command-area-card-progress"><b>{fa(clamp(area.percent))}٪</b><i><em style={{width:clamp(area.percent)+"%"}}/></i><small>{fa(area.actual)} از {quotaFa(area.quota)}</small></span>
              <span className="command-area-open">جزئیات ←</span>
            </Link>)}</div>
            <div className="command-overview-chart">
              <div><span>مقایسه حوزه‌ها</span><h4>مقایسه امتیاز حوزه‌ها از ۱۰۰</h4></div>
              <LineChart labels={areas.map(a=>a.name)} values={areas.map(a=>clamp(a.percent))} label="مقایسه امتیاز کلی حوزه‌ها از ۱۰۰"/>
            </div>
          </div>
        )}
       </>}
    </section>
  );
}
