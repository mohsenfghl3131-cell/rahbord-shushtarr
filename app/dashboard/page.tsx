import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import AppShell from "@/app/components/AppShell";

type AreaStat = {
  name: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
};

const statusLabels: Record<string, string> = {
  approved: "تأیید شده",
  rejected: "رد شده",
  pending: "در انتظار بررسی",
};

const auditLabels: Record<string, string> = {
  "report.create": "ثبت گزارش",
  "report.approved": "تأیید گزارش",
  "report.rejected": "رد گزارش",
  "user.create": "ایجاد کاربر",
  "user.update": "ویرایش کاربر",
  "settings.update": "تغییر تنظیمات",
  "auth.login": "ورود به سامانه",
  "auth.logout": "خروج از سامانه",
  "file.upload": "آپلود فایل",
  "profile.update": "ویرایش پروفایل",
};

export default async function Dashboard() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const restricted =
    ctx.profile.role === "area_manager" || ctx.profile.role === "area_force";

  const scope = (query: any) => {
    if (!restricted) return query;
    return query.in(
      "area_id",
      ctx.areaIds.length
        ? ctx.areaIds
        : ["00000000-0000-0000-0000-000000000000"]
    );
  };

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const [all, pending, approved, rejected, today, week, recent, audit, areaRows] =
    await Promise.all([
      scope(db.from("reports").select("id", { count: "exact", head: true }).is("deleted_at", null)),
      scope(db.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null)),
      scope(db.from("reports").select("id", { count: "exact", head: true }).eq("status", "approved").is("deleted_at", null)),
      scope(db.from("reports").select("id", { count: "exact", head: true }).eq("status", "rejected").is("deleted_at", null)),
      scope(db.from("reports").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()).is("deleted_at", null)),
      scope(
        db.from("reports")
          .select("created_at")
          .gte("created_at", weekStart.toISOString())
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
      ),
      scope(
        db.from("reports")
          .select("id,title,status,created_at,areas(name),categories(name)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(6)
      ),
      db.from("audit_logs").select("id,action,created_at").order("created_at", { ascending: false }).limit(6),
      scope(db.from("reports").select("area_id,status,areas(name)").is("deleted_at", null)),
    ]);

  const total = all.count ?? 0;
  const pendingCount = pending.count ?? 0;
  const approvedCount = approved.count ?? 0;
  const rejectedCount = rejected.count ?? 0;
  const todayCount = today.count ?? 0;
  const approvalRate = total ? Math.round((approvedCount / total) * 100) : 0;
  const reviewRate = total
    ? Math.round(((approvedCount + rejectedCount) / total) * 100)
    : 0;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return {
      date,
      count: 0,
      label: date.toLocaleDateString("fa-IR", { weekday: "short" }),
    };
  });

  (week.data ?? []).forEach((row: any) => {
    const value = new Date(row.created_at);
    value.setHours(0, 0, 0, 0);
    const found = days.find((day) => day.date.getTime() === value.getTime());
    if (found) found.count += 1;
  });

  const maxDay = Math.max(1, ...days.map((day) => day.count));

  const areaMap = new Map<string, AreaStat>();
  (areaRows.data ?? []).forEach((row: any) => {
    const id = String(row.area_id);
    const item = areaMap.get(id) ?? {
      name: row.areas?.name ?? "نامشخص",
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };

    item.total += 1;
    if (row.status === "approved") item.approved += 1;
    if (row.status === "pending") item.pending += 1;
    if (row.status === "rejected") item.rejected += 1;
    areaMap.set(id, item);
  });

  const areas = [...areaMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const maxArea = Math.max(1, ...areas.map((area) => area.total));

  return (
    <AppShell>
      <main className="content">
        <section className="welcome welcome-pro">
          <div>
            <div className="welcome-kicker">
              <span className="online-dot" />
              سامانه عملیاتی فعال
            </div>
            <h1>مرکز فرماندهی راهبرد</h1>
            <p>نمای کلی عملکرد، گزارش‌ها و فعالیت‌های سامانه در یک نگاه.</p>
            <div className="welcome-meta">
              <span>
                امروز {now.toLocaleDateString("fa-IR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
              <span>آخرین به‌روزرسانی: اکنون</span>
            </div>
          </div>
          <div className="welcome-orbit">
            <div>
              <strong>{todayCount.toLocaleString("fa-IR")}</strong>
              <small>گزارش امروز</small>
            </div>
          </div>
        </section>

        <section className="quick-actions">
          <Link href="/reports/new">
            <span>＋</span>
            <div><b>ثبت گزارش جدید</b><small>ارسال گزارش به حوزه</small></div>
          </Link>
          <Link href="/reports/mine">
            <span>▤</span>
            <div><b>گزارش‌های من</b><small>پیگیری وضعیت ارسال‌ها</small></div>
          </Link>
          <Link href="/reports">
            <span>☷</span>
            <div><b>گزارش‌ها</b><small>{pendingCount.toLocaleString("fa-IR")} مورد در انتظار</small></div>
          </Link>
          <Link href="/analytics">
            <span>⌁</span>
            <div><b>مرکز تحلیل</b><small>روندها و رتبه‌بندی حوزه‌ها</small></div>
          </Link>
        </section>

        <section className="stats">
          <Stat label="کل گزارش‌ها" value={total} tone="blue" note="تمام گزارش‌های فعال" />
          <Stat label="گزارش‌های امروز" value={todayCount} tone="cyan" note="ثبت‌شده از ابتدای امروز" />
          <Stat label="در انتظار بررسی" value={pendingCount} tone="orange" note="نیازمند اقدام" />
          <Stat label="نرخ تأیید" value={approvalRate} suffix="٪" tone="green" note={reviewRate + "٪ از گزارش‌ها بررسی شده‌اند"} />
        </section>

        <section className="dashboard-grid dashboard-grid-pro">
          <section className="panel wide">
            <div className="panel-title">
              <div><span className="panel-eyebrow">۷ روز اخیر</span><h2>روند ثبت گزارش‌ها</h2></div>
              <Link href="/analytics">تحلیل کامل ←</Link>
            </div>
            <div className="trend-chart">
              <div className="trend-bars">
                {days.map((day) => (
                  <div className="trend-col" key={day.date.toISOString()}>
                    <b>{day.count || ""}</b>
                    <i style={{ height: Math.max(8, (day.count / maxDay) * 145) }} />
                    <small>{day.label}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <div><span className="panel-eyebrow">وضعیت فعلی</span><h2>توزیع گزارش‌ها</h2></div>
            </div>
            <div className="status-overview">
              <div className="status-ring">
                <strong>{approvalRate}٪</strong>
                <small>نرخ تأیید</small>
              </div>
              <div className="status-legend">
                <Legend label="تأیید شده" value={approvedCount} cls="approved" />
                <Legend label="در انتظار" value={pendingCount} cls="pending" />
                <Legend label="رد شده" value={rejectedCount} cls="rejected" />
              </div>
            </div>
          </section>

          <section className="panel wide">
            <div className="panel-title">
              <div><span className="panel-eyebrow">عملکرد حوزه‌ها</span><h2>رتبه‌بندی حوزه‌های فعال</h2></div>
              <Link href="/analytics">مشاهده همه ←</Link>
            </div>
            <div className="area-ranking">
              {areas.length === 0 ? (
                <div className="empty-state">هنوز گزارشی برای رتبه‌بندی ثبت نشده است.</div>
              ) : (
                areas.map((area, index) => (
                  <div className="area-rank" key={area.name}>
                    <b className="rank-number">{String(index + 1).padStart(2, "0")}</b>
                    <div className="area-rank-main">
                      <div>
                        <strong>{area.name}</strong>
                        <small>{area.approved} تأیید · {area.pending} در انتظار · {area.rejected} رد</small>
                      </div>
                      <b>{area.total.toLocaleString("fa-IR")}</b>
                    </div>
                    <div className="area-bar">
                      <i style={{ width: (area.total / maxArea) * 100 + "%" }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <div><span className="panel-eyebrow">LIVE FEED</span><h2>آخرین فعالیت‌ها</h2></div>
              <Link href="/audit">لاگ کامل ←</Link>
            </div>
            <div className="activity activity-pro">
              {(audit.data ?? []).map((item: any) => (
                <div key={item.id}>
                  <span className="activity-dot">◈</span>
                  <div>
                    <b>{auditLabels[item.action] ?? item.action}</b>
                    <small>{new Date(item.created_at).toLocaleString("fa-IR")}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel wide">
            <div className="panel-title">
              <div><span className="panel-eyebrow">RECENT REPORTS</span><h2>آخرین گزارش‌های ثبت‌شده</h2></div>
              <Link href="/reports">مشاهده همه ←</Link>
            </div>
            <div className="recent-table">
              {(recent.data ?? []).length === 0 ? (
                <div className="empty-state">هنوز گزارشی ثبت نشده است.</div>
              ) : (
                (recent.data ?? []).map((report: any) => (
                  <Link href={"/reports#" + report.id} className="recent-row" key={report.id}>
                    <span className={"status " + report.status}>
                      {statusLabels[report.status] ?? report.status}
                    </span>
                    <div>
                      <b>{report.title}</b>
                      <small>{report.areas?.name ?? "—"} · {report.categories?.name ?? "—"}</small>
                    </div>
                    <time>
                      {new Date(report.created_at).toLocaleDateString("fa-IR", { day: "numeric", month: "short" })}
                    </time>
                    <span className="row-arrow">←</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </section>
      </main>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  tone,
  note,
  suffix = "",
}: {
  label: string;
  value: number;
  tone: string;
  note: string;
  suffix?: string;
}) {
  return (
    <article className={"stat-card " + tone}>
      <span>{label}</span>
      <strong>{value.toLocaleString("fa-IR")}{suffix}</strong>
      <small>{note}</small>
    </article>
  );
}

function Legend({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="legend-row">
      <span className={"legend-dot " + cls} />
      <span>{label}</span>
      <b>{value.toLocaleString("fa-IR")}</b>
    </div>
  );
}
