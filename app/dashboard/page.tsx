import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import AppShell from "@/app/components/AppShell";
import DailyMessage from "./DailyMessage";

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
  "message.create": "ارسال پیام",
};

export default async function Dashboard() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const sectionScoped =
    ctx.responsibleGroupIds.length > 0 &&
    !["main_admin", "deputy", "battalion_commander"].includes(ctx.profile.role);

  const { data: responsibleCategories } = sectionScoped
    ? await db
        .from("categories")
        .select("id")
        .in("group_id", ctx.responsibleGroupIds)
        .eq("is_active", true)
    : { data: [] as { id: string }[] };

  const responsibleCategoryIds = (responsibleCategories ?? []).map((x: { id: string }) => x.id);

  const scope = (query: any) => {
    if (sectionScoped) {
      return query.in(
        "category_id",
        responsibleCategoryIds.length
          ? responsibleCategoryIds
          : ["00000000-0000-0000-0000-000000000000"]
      );
    }
    if (ctx.profile.role === "area_manager" || ctx.profile.role === "area_force") {
      return query.in(
        "area_id",
        ctx.areaIds.length
          ? ctx.areaIds
          : ["00000000-0000-0000-0000-000000000000"]
      );
    }
    return query;
  };

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  const [all, pending, approved, rejected, today, week, previousWeek, recent, areaRows] =
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
          .select("id", { count: "exact", head: true })
          .gte("created_at", previousWeekStart.toISOString())
          .lt("created_at", weekStart.toISOString())
          .is("deleted_at", null)
      ),
      scope(
        db.from("reports")
          .select("id,title,status,created_at,areas(name),categories(name)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(6)
      ),
      scope(db.from("reports").select("area_id,status,areas(name),categories(name)").is("deleted_at", null)),
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
  const approvedRate = total ? Math.round((approvedCount / total) * 100) : 0;
  const pendingRate = total ? Math.round((pendingCount / total) * 100) : 0;
  const rejectedRate = total ? Math.round((rejectedCount / total) * 100) : 0;

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
  const previousWeekCount = previousWeek.count ?? 0;
  const currentWeekCount = week.data?.length ?? 0;
  const weeklyChange = previousWeekCount
    ? Math.round(((currentWeekCount - previousWeekCount) / previousWeekCount) * 100)
    : currentWeekCount > 0 ? 100 : 0;

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

  const categoryMap = new Map<string, number>();
  (areaRows.data ?? []).forEach((row: any) => {
    const name = row.categories?.name ?? "بدون دسته‌بندی";
    categoryMap.set(name, (categoryMap.get(name) ?? 0) + 1);
  });
  const categories = [...categoryMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxCategory = Math.max(1, ...categories.map((item) => item.count));

  const isSenior = ["main_admin", "deputy", "battalion_commander"].includes(ctx.profile.role);
  const canManageAreas = ["main_admin", "deputy", "battalion_commander", "area_manager"].includes(ctx.profile.role);
  const shortcuts = [
    { href: "/reports/new", icon: "＋", title: "ثبت گزارش جدید", detail: "ارسال گزارش تازه" },
    { href: "/reports/mine", icon: "▤", title: "گزارش‌های من", detail: "پیگیری گزارش‌های ثبت‌شده" },
    { href: "/messages", icon: "✉", title: "صندوق نامه‌ها", detail: "مشاهده و ارسال نامه" },
    ...(isSenior ? [{ href: "/users", icon: "♟", title: "مدیریت کاربران", detail: "افزودن و مدیریت کاربران" }] : []),
    ...(canManageAreas ? [{ href: "/areas", icon: "⌖", title: "مدیریت حوزه‌ها", detail: "تعریف و ویرایش حوزه‌ها" }] : []),
    ...(isSenior ? [{ href: "/categories", icon: "▦", title: "دسته‌بندی‌ها", detail: "مدیریت گروه‌ها و دسته‌بندی‌ها" }, { href: "/settings", icon: "⚙", title: "تنظیمات سیستم", detail: "پیکربندی سامانه" }] : []),
  ];

  return (
    <AppShell>
      <main className="content">
        <section className="welcome welcome-pro">
          <div>
            <div className="welcome-kicker">
              <span className="online-dot" />
              سامانه عملیاتی فعال
            </div>
            <h1>سامانه راهبرد شوشتر</h1>
            <p>مرکز یکپارچه مدیریت، فرماندهی و پایش عملکرد حوزه‌ها و پایگاه‌ها</p>
            <div className="welcome-motto"><span>✦</span> هم‌افزایی، مسئولیت‌پذیری و خدمت هوشمندانه <span>✦</span></div>
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
        <DailyMessage canEdit={["main_admin", "deputy", "battalion_commander"].includes(ctx.profile.role)} />
        <section className="panel shushtar-map-panel">
          <div className="panel-title">
            <div>
              <span className="panel-eyebrow">نقشه جغرافیایی شهر</span>
              <h2>نقشه واقعی شوشتر</h2>
              <small>نمای خیابان‌ها و محدوده شهری بر پایه نقشه OpenStreetMap</small>
            </div>
            <a href="https://www.openstreetmap.org/?mlat=32.0497&mlon=48.8484#map=13/32.0497/48.8484" target="_blank" rel="noreferrer">نمایش در نقشه کامل ↗</a>
          </div>
          <div className="shushtar-map-frame">
            <iframe
              title="نقشه واقعی شهر شوشتر"
              src="https://www.openstreetmap.org/export/embed.html?bbox=48.7900%2C32.0050%2C48.9100%2C32.0950&layer=mapnik&marker=32.0497%2C48.8484"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="shushtar-map-caption"><span><i /> مرکز شهر شوشتر</span><span>نقشه تعاملی · قابلیت بزرگ‌نمایی و جابه‌جایی</span></div>
          </div>
          <p className="shushtar-map-note">این نقشه، نقشه جغرافیایی واقعی شهر است؛ مرزبندی حوزه‌ها تا زمان تأیید محدوده‌های رسمی روی آن نمایش داده نمی‌شود.</p>
        </section>
        <section className="stats">
          <Stat label="کل گزارش‌ها" value={total} tone="blue" note="تمام گزارش‌های فعال" />
          <Stat label="گزارش‌های امروز" value={todayCount} tone="cyan" note="ثبت‌شده از ابتدای امروز" />
          <Stat label="در انتظار بررسی" value={pendingCount} tone="orange" note="نیازمند اقدام" />
          <Stat label="گزارش‌های ردشده" value={rejectedCount} tone="red" note="گزارش‌های تعیین‌تکلیف‌شده" />
          <Stat label="نرخ تأیید" value={approvalRate} suffix="٪" tone="green" note="سهم گزارش‌های تأییدشده از کل" />
          <Stat label="نرخ بررسی" value={reviewRate} suffix="٪" tone="violet" note="سهم گزارش‌های بررسی‌شده از کل" />
        </section>

        <section className="dashboard-grid dashboard-grid-pro">
          <section className="panel wide">
            <div className="panel-title">
              <div><span className="panel-eyebrow">۷ روز اخیر</span><h2>روند ثبت گزارش‌ها</h2><small className={"dashboard-trend-delta " + (weeklyChange >= 0 ? "positive" : "negative")}>{weeklyChange > 0 ? "↑ " : weeklyChange < 0 ? "↓ " : ""}{Math.abs(weeklyChange).toLocaleString("fa-IR")}٪ نسبت به ۷ روز قبل</small></div>
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
            <div className="report-status-dashboard">
              <div className="report-status-summary">
                <div className="report-status-total"><span>مجموع گزارش‌های ثبت‌شده</span><strong>{total.toLocaleString("fa-IR")}</strong><small>بر اساس گزارش‌های فعال سامانه</small></div>
                <div className="report-status-rate" style={{background:"conic-gradient(#239b79 0% "+approvedRate+"%, #e5a13c "+approvedRate+"% "+(approvedRate+pendingRate)+"%, #d36c79 "+(approvedRate+pendingRate)+"% 100%)"}}><div><strong>{reviewRate}٪</strong><small>نرخ بررسی</small></div></div>
              </div>
              <div className="report-status-stack" role="img" aria-label={"تأیید "+approvedRate+" درصد، در انتظار "+pendingRate+" درصد، رد شده "+rejectedRate+" درصد"}>
                {total>0&&<><i className="approved" style={{width:approvedRate+"%"}}/><i className="pending" style={{width:pendingRate+"%"}}/><i className="rejected" style={{width:rejectedRate+"%"}}/></>}
              </div>
              <div className="report-status-items">
                <div className="report-status-item approved"><span className="report-status-item-top"><i/><b>تأیید شده</b><strong>{approvedCount.toLocaleString("fa-IR")}</strong></span><span className="report-status-item-bottom"><small>از کل گزارش‌ها</small><b>{approvedRate}٪</b></span></div>
                <div className="report-status-item pending"><span className="report-status-item-top"><i/><b>در انتظار بررسی</b><strong>{pendingCount.toLocaleString("fa-IR")}</strong></span><span className="report-status-item-bottom"><small>نیازمند اقدام</small><b>{pendingRate}٪</b></span></div>
                <div className="report-status-item rejected"><span className="report-status-item-top"><i/><b>رد شده</b><strong>{rejectedCount.toLocaleString("fa-IR")}</strong></span><span className="report-status-item-bottom"><small>از کل گزارش‌ها</small><b>{rejectedRate}٪</b></span></div>
              </div>
              <div className="report-status-footer"><span><i/> وضعیت‌ها بر اساس گزارش‌های فعال</span><Link href="/reports">مدیریت گزارش‌ها ←</Link></div>
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
              <div><span className="panel-eyebrow">نمای کلی دسته‌بندی‌ها</span><h2>دسته‌بندی‌های پرتکرار</h2></div>
            </div>
            <div className="area-ranking">
              {categories.length === 0 ? (
                <div className="empty-state">هنوز داده‌ای برای دسته‌بندی‌ها ثبت نشده است.</div>
              ) : categories.map((item, index) => (
                <div className="area-rank" key={item.name}>
                  <b className="rank-number">{String(index + 1).padStart(2, "0")}</b>
                  <div className="area-rank-main">
                    <div><strong>{item.name}</strong><small>تعداد گزارش‌های ثبت‌شده</small></div>
                    <b>{item.count.toLocaleString("fa-IR")}</b>
                  </div>
                  <div className="area-bar"><i style={{ width: (item.count / maxCategory) * 100 + "%" }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel wide">
            <div className="panel-title">
              <div><span className="panel-eyebrow">گزارش‌های تازه</span><h2>آخرین گزارش‌های ثبت‌شده</h2></div>
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
        <section className="quick-actions dashboard-shortcuts" aria-label="دسترسی‌های سریع">
          {shortcuts.map((item) => <Link href={item.href} key={item.href}><span>{item.icon}</span><div><b>{item.title}</b><small>{item.detail}</small></div><i>←</i></Link>)}
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
