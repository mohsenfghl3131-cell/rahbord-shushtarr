"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Area = { id: string; name: string; quota: number; actual: number; remaining: number; percent: number };
type Mission = { id: string; title: string; unit: string; section: string; quota: number; actual: number; remaining: number; percent: number; areas: Area[] };
type Battalion = { id: string; name: string; quota: number; actual: number; remaining: number; surplus: number; percent: number; areas: {id:string;name:string}[]; missions: Mission[] };
type ScopedArea = { id: string; name: string; is_active: boolean };

const fa = (n: number) => Number(n || 0).toLocaleString("fa-IR", { maximumFractionDigits: 2 });
const pct = (n: number) => Math.max(0, Math.min(100, n));

export default function CommandDashboard() {
  const [battalions, setBattalions] = useState<Battalion[]>([]);
  const [canManageQuota, setCanManageQuota] = useState(false);
  const [scopedAreas, setScopedAreas] = useState<ScopedArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTotal, setDraftTotal] = useState("");
  const [draftAreas, setDraftAreas] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/command-dashboard/battalions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "دریافت داشبورد فرماندهی ناموفق بود.");
      setBattalions(data.battalions || []);
      setScopedAreas(data.areas || []);
      setCanManageQuota(Boolean(data.can_manage));
    } catch (e: any) { setError(e.message || "خطا در دریافت اطلاعات."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const beginEdit = (b: Battalion, m: Mission) => {
    setEditing(b.id + ":" + m.id);
    setDraftTotal(String(m.quota));
    setDraftAreas(Object.fromEntries(m.areas.map((a) => [a.id, String(a.quota)])));
    setNotice("");
  };

  const save = async (b: Battalion, m: Mission) => {
    const allocations = m.areas.map((a) => ({ area_id: a.id, quota_value: Number(draftAreas[a.id] ?? 0) }));
    const total = Number(draftTotal);
    if (!Number.isFinite(total) || total < 0 || allocations.some((a) => !Number.isFinite(a.quota_value) || a.quota_value < 0)) {
      setNotice("اعداد سهمیه معتبر نیستند."); return;
    }
    if (allocations.reduce((sum, a) => sum + a.quota_value, 0) > total + 0.0001) {
      setNotice("مجموع سهمیه حوزه‌ها از سهمیه کل گردان بیشتر است."); return;
    }
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/command-dashboard/battalions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission_id: m.id, battalion_id: b.id, quota_total: total, allocations })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "ذخیره سهمیه انجام نشد.");
      setEditing(null); setNotice("تغییرات سهمیه با موفقیت ذخیره شد."); await load();
    } catch (e: any) { setNotice(e.message || "ذخیره سهمیه انجام نشد."); }
    finally { setSaving(false); }
  };

  return (
    <section className="panel command-dashboard-panel command-pro-panel" style={{ margin: "16px 0 20px", padding: 20 }}>
      <div className="panel-title">
        <div><span className="panel-eyebrow">مرکز پایش و ارزیابی عملکرد</span><h2>داشبورد فرماندهی گردان‌ها</h2><small style={{ color: "var(--muted)", fontSize: 10 }}>سهمیه کل، میزان تحقق، باقیمانده و عملکرد حوزه‌ها</small></div>
        <span className="command-live">● داده‌های سامانه</span>
      </div>
      {loading ? <div className="empty-state">در حال محاسبه عملکرد گردان‌ها…</div> :
       error ? <div className="error">{error}</div> :
       battalions.length === 0 && scopedAreas.length > 0 ? <div className="command-area-grid">{scopedAreas.map((area,index)=><Link href={"/command-dashboard/"+area.id} className="command-area-card" key={area.id}><span className="command-area-index">{String(index+1).padStart(2,"0")}</span><span className="command-area-name">{area.name}</span><span className="command-area-open">مشاهده داشبورد ←</span></Link>)}</div> :
       battalions.length === 0 ? <div className="empty-state">اطلاعاتی برای نمایش وجود ندارد.</div> :
       <div className="command-battalion-list">
        {battalions.map((b) => (
          <article className="command-battalion-card" key={b.id}>
            <button type="button" className="command-battalion-head" onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
              <span><b>{b.name}</b><small>{fa(b.areas.length)} حوزه · {fa(b.missions.length)} مأموریت فعال</small></span>
              <span className="command-battalion-total">{fa(b.percent)}٪ تحقق <i>{expanded === b.id ? "−" : "+"}</i></span>
            </button>
            <div className="command-kpi-grid">
              <div><small>سهمیه کل گردان</small><strong>{fa(b.quota)}</strong></div>
              <div><small>محقق‌شده</small><strong className="good">{fa(b.actual)}</strong></div>
              <div><small>محقق‌نشده</small><strong className="warn">{fa(b.remaining)}</strong></div>
              <div><small>درصد تحقق</small><strong>{fa(b.percent)}٪</strong></div>
            </div>
            <div className="command-progress"><i style={{ width: pct(b.percent) + "%" }} /></div>
            {b.surplus > 0 && <p className="command-surplus">عملکرد بیش از سهمیه: {fa(b.surplus)}</p>}
            {expanded === b.id && <>
              <div className="command-area-performance">
                <h3>عملکرد حوزه‌ها در مجموع مأموریت‌ها</h3>
                {b.areas.map((area) => {
                  const target = b.missions.reduce((s,m) => s + (m.areas.find(a => a.id === area.id)?.quota || 0), 0);
                  const actual = b.missions.reduce((s,m) => s + (m.areas.find(a => a.id === area.id)?.actual || 0), 0);
                  const remaining = Math.max(0,target-actual);
                  const percent = target > 0 ? Math.round(actual/target*100) : 0;
                  return <div className="command-area-performance-row" key={area.id}>
                    <div className="command-area-performance-title"><b>{area.name}</b><span>{fa(actual)} از {fa(target)}</span></div>
                    <div className="command-progress thin"><i style={{width:pct(percent)+"%"}}/></div>
                    <small>{fa(percent)}٪ تحقق · {fa(remaining)} محقق‌نشده</small>
                    <Link href={"/command-dashboard/" + area.id}>جزئیات حوزه ←</Link>
                  </div>;
                })}
              </div>
              <div className="command-mission-performance">
                <h3>سهمیه مأموریت‌ها و تخصیص حوزه‌ای</h3>
                {b.missions.map((m) => {
                  const key = b.id + ":" + m.id;
                  const isEditing = editing === key;
                  return <div className="command-mission-card" key={m.id}>
                    <div className="command-mission-card-title"><div><b>{m.title}</b><small>{m.section} · {m.unit}</small></div><strong>{fa(m.percent)}٪</strong></div>
                    <div className="command-mission-card-stats"><span>سهمیه: {fa(m.quota)}</span><span>محقق‌شده: {fa(m.actual)}</span><span>باقی‌مانده: {fa(m.remaining)}</span></div>
                    <div className="command-progress thin"><i style={{width:pct(m.percent)+"%"}}/></div>
                    {canManageQuota && <button type="button" className="command-edit-quota" onClick={() => isEditing ? setEditing(null) : beginEdit(b,m)}>{isEditing ? "بستن ویرایش" : "تنظیم سهمیه این مأموریت"}</button>}
                    {canManageQuota && isEditing && <div className="command-quota-editor">
                      <label>سهمیه کل این مأموریت برای {b.name}<input type="number" min="0" step="0.01" value={draftTotal} onChange={e=>setDraftTotal(e.target.value)}/></label>
                      <div className="command-quota-area-grid">{m.areas.map(a=><label key={a.id}>{a.name}<input type="number" min="0" step="0.01" value={draftAreas[a.id] ?? "0"} onChange={e=>setDraftAreas(prev=>({...prev,[a.id]:e.target.value}))}/></label>)}</div>
                      <small>مجموع تخصیص حوزه‌ها نباید از سهمیه کل مأموریت بیشتر شود.</small>
                      <button type="button" disabled={saving} onClick={()=>save(b,m)}>{saving ? "در حال ذخیره…" : "ذخیره سهمیه‌ها"}</button>
                    </div>}
                  </div>;
                })}
              </div>
            </>}
          </article>
        ))}
       </div>}
      {notice && <p className="command-notice">{notice}</p>}
    </section>
  );
}
