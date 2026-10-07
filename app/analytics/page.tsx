"use client";

import AppShell from "@/app/components/AppShell";
import { useEffect, useMemo, useState } from "react";

type AnalyticsData = {
  total?: number;
  byStatus?: {
    pending?: number;
    approved?: number;
    rejected?: number;
  };
  byArea?: Record<string, number>;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/analytics")
      .then((response) => {
        if (!response.ok) throw new Error("analytics");
        return response.json();
      })
      .then((value: AnalyticsData) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const areas = useMemo(() => {
    return Object.entries(data?.byArea ?? {})
      .map(([name, count]) => ({ name, count: Number(count) || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const maxArea = Math.max(1, ...areas.map((item) => item.count));
  const pending = data?.byStatus?.pending ?? 0;
  const approved = data?.byStatus?.approved ?? 0;
  const rejected = data?.byStatus?.rejected ?? 0;

  return (
    <AppShell>
      <main className="shell unified-page">
        <div className="unified-header">
          <div>
            <span className="eyebrow">راهبرد شوشتر</span>
            <h1>گزارش‌های تحلیلی</h1>
            <p>نمای کلی عملکرد گزارش‌ها و رتبه‌بندی حوزه‌ها</p>
          </div>
          <div className="header-live">تحلیل زنده</div>
        </div>

        {error ? (
          <section className="panel">
            <div className="panel-title">
              <h2>خطا در دریافت آمار</h2>
            </div>
            <p>امکان دریافت اطلاعات تحلیلی وجود ندارد. دوباره تلاش کنید.</p>
          </section>
        ) : !data ? (
          <section className="panel">
            <div className="panel-title">
              <h2>در حال محاسبه آمار…</h2>
            </div>
            <p>اطلاعات از سامانه در حال دریافت است.</p>
          </section>
        ) : (
          <>
            <div className="stats">
              <div className="stat-card blue">
                <span>کل گزارش‌ها</span>
                <strong>{data.total ?? 0}</strong>
              </div>
              <div className="stat-card orange">
                <span>در انتظار بررسی</span>
                <strong>{pending}</strong>
              </div>
              <div className="stat-card green">
                <span>تأیید شده</span>
                <strong>{approved}</strong>
              </div>
              <div className="stat-card red">
                <span>رد شده</span>
                <strong>{rejected}</strong>
              </div>
            </div>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <span className="panel-eyebrow">عملکرد حوزه‌ها</span>
                  <h2>رتبه‌بندی حوزه‌ها</h2>
                </div>
                <span className="kpi-inline">{areas.length} حوزه</span>
              </div>

              {areas.length === 0 ? (
                <div className="empty-state">هنوز گزارشی برای رتبه‌بندی ثبت نشده است.</div>
              ) : (
                <div className="area-ranking">
                  {areas.map((area, index) => (
                    <div className="rank-row" key={area.name}>
                      <b>{index + 1}</b>
                      <span>{area.name}</span>
                      <div className="bar">
                        <i
                          style={{
                            width: `${(area.count / maxArea) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{area.count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
