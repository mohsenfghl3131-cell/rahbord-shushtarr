"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Area = { id: string; name: string; is_active: boolean };

export default function CommandDashboard() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/command-dashboard", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "دریافت حوزه‌ها ناموفق بود.");
        setAreas(data.areas || []);
      })
      .catch((reason) => setError(reason.message || "خطا در دریافت حوزه‌ها."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="panel command-dashboard-panel" style={{ margin: "16px 0 20px", padding: 20 }}>
      <div className="panel-title">
        <div>
          <span className="panel-eyebrow">مرکز پایش حوزه‌ها</span>
          <h2>داشبورد فرماندهی</h2>
          <small style={{ color: "var(--muted)", fontSize: 10 }}>برای مشاهده آمار، مأموریت‌ها و گزارش‌های هر حوزه انتخاب کنید.</small>
        </div>
        <span className="command-live">● پایش زنده اطلاعات</span>
      </div>
      {loading ? <div className="empty-state">در حال دریافت فهرست حوزه‌ها…</div> :
        error ? <div className="error">{error}</div> :
        areas.length === 0 ? <div className="empty-state">حوزه‌ای برای نمایش در دسترس نیست.</div> :
        <div className="command-area-grid">
          {areas.map((area, index) => (
            <Link href={"/command-dashboard/" + area.id} className="command-area-card" key={area.id}>
              <span className="command-area-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="command-area-name">{area.name}</span>
              <span className="command-area-open">مشاهده داشبورد <b>←</b></span>
            </Link>
          ))}
        </div>
      }
    </section>
  );
}
