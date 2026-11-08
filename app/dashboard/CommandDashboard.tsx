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

type ChartPoint = { label: string; value: number; quota: number; actual: number; href?: string };

function LineChart({ points, label }: { points: ChartPoint[]; label: string }) {
  const [selected, setSelected] = useState(0);
  if (!points.length) return <div className="command-empty-chart">هنوز داده‌ای برای رسم نمودار وجود ندارد.</div>;
  const width = 620, left = 42, right = 586, top = 24, bottom = 160;
  const max = 100;
  const coords = points.map((p, i) => ({
    x: points.length === 1 ? (left + right) / 2 : left + i * ((right - left) / (points.length - 1)),
    y: bottom - (clamp(p.value) / max) * (bottom - top)
  }));
  const polyline = coords.map(p => p.x + "," + p.y).join(" ");
  const activeIndex = Math.min(selected, points.length - 1);
  const active = points[activeIndex];
  return <div className="command-line-wrap">
    <svg viewBox={`0 0 ${width} 194`} role="group" aria-label={label}>
      {[0, 50, 100].map((v, i) => { const y = bottom - (v / max) * (bottom - top); return <g key={v}><line x1={left} x2={right} y1={y} y2={y} stroke="currentColor" opacity=".13" strokeDasharray="4 5"/><text x="30" y={y + 4} textAnchor="end" fill="currentColor" opacity=".65" fontSize="10">{fa(v)}٪</text></g>; })}
      <polyline points={polyline} fill="none" stroke="#35baff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      {coords.map((p,i)=><g key={i} onClick={()=>setSelected(i)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(i);}}} role="button" tabIndex={0} aria-label={`${points[i].label}: سهمیه ${fa(points[i].quota)}، محقق‌شده ${fa(points[i].actual)}`} style={{cursor:"pointer"}}>
        <circle cx={p.x} cy={p.y} r="12" fill="transparent"/>
        <circle cx={p.x} cy={p.y} r={i===activeIndex?7:5} fill={i===activeIndex?"#20c997":"#35baff"} stroke="var(--panel,#101827)" strokeWidth="2"/>
        <text x={p.x} y="183" textAnchor="middle" fill="currentColor" fontSize="9">{points[i].label.length > 12 ? points[i].label.slice(0,12)+"…" : points[i].label}</text>
      </g>)}
    </svg>
    <div className="command-chart-selection">
      <b>{active.label}</b>
      <span>سهمیه: {quotaFa(active.quota)}</span>
      <span>محقق‌شده: {fa(active.actual)}</span>
      <strong>{fa(clamp(active.value))}٪ تحقق</strong>
      {active.href ? <Link href={active.href}>ورود به جزئیات حوزه ←</Link> : null}
    </div>
    <small>{label} · برای دیدن سهمیه و مقدار تحقق، روی نقطه نمودار بزنید.</small>
  </div>;
}

function DonutChart({ quota, actual, percent }: { quota: number; actual: number; percent: number }) {
  const [selected, setSelected] = useState<"actual" | "remaining">("actual");
  const radius = 48, circumference = 2 * Math.PI * radius;
  const achieved = clamp(percent);
  const achievedLength = circumference * achieved / 100;
  const remainingLength = circumference - achievedLength;
  return <div className="command-donut-interactive">
    <svg viewBox="0 0 140 140" role="group" aria-label="نمودار دایره‌ای سهمیه و تحقق">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(148,163,184,.2)" strokeWidth="18"/>
      <circle cx="70" cy="70" r={radius} fill="none" stroke="#20c997" strokeWidth="18" strokeDasharray={`${achievedLength} ${circumference-achievedLength}`} transform="rotate(-90 70 70)" strokeLinecap="butt" onClick={()=>setSelected("actual")} style={{cursor:"pointer"}}/>
      <circle cx="70" cy="70" r={radius} fill="none" stroke="#64748b" strokeWidth="18" strokeDasharray={`${remainingLength} ${achievedLength}`} strokeDashoffset={-achievedLength} transform="rotate(-90 70 70)" onClick={()=>setSelected("remaining")} style={{cursor:"pointer"}}/>
      <text x="70" y="67" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight="700">{fa(achieved)}٪</text>
      <text x="70" y="84" textAnchor="middle" fill="currentColor" opacity=".7" fontSize="10">تحقق</text>
    </svg>
    <div className="command-donut-legend">
      <button type="button" className={selected==="actual"?"active":""} onClick={()=>setSelected("actual")}><i className="actual"/>محقق‌شده</button>
      <button type="button" className={selected==="remaining"?"active":""} onClick={()=>setSelected("remaining")}><i className="remaining"/>باقی‌مانده</button>
    </div>
    <div className="command-chart-selection">
      <b>{selected==="actual"?"مقدار محقق‌شده":"مقدار باقی‌مانده"}</b>
      <span>سهمیه کل: {quotaFa(quota)}</span>
      <span>محقق‌شده: {fa(actual)}</span>
      {selected==="remaining" ? <strong>باقی‌مانده: {quotaFa(Math.max(0,quota-actual))}</strong> : <strong>درصد تحقق: {fa(achieved)}٪</strong>}
    </div>
    <small>برای مشاهده جزئیات هر بخش، روی قسمت نمودار یا راهنمای آن بزنید.</small>
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
                <DonutChart quota={chosen.quota} actual={chosen.actual} percent={donutPercent}/>

              </article>
              <article className="command-chart-card command-line-card">
                <h4>نمودار خطی تحقق مأموریت‌های حوزه</h4>
                <LineChart points={chosen.missions.map(m => ({label:m.title,value:m.quota ? clamp(m.actual/m.quota*100) : 0,quota:m.quota,actual:m.actual}))} label="درصد تحقق مأموریت‌های حوزه"/>
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
              <LineChart points={areas.map(a=>({label:a.name,value:clamp(a.percent),quota:a.quota,actual:a.actual,href:"/dashboard/command/"+a.id}))} label="مقایسه امتیاز کلی حوزه‌ها از ۱۰۰"/>
            </div>
          </div>
        )}
       </>}
    </section>
  );
}
