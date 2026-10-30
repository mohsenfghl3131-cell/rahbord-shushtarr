"use client";

import { useEffect, useState } from "react";
import AppShell from "@/app/components/AppShell";

type AuditLog = {
  id: string;
  action: string;
  entity_type?: string | null;
  created_at: string;
  profiles?: { display_name?: string | null } | null;
};

const actionLabels: Record<string, string> = {
  "report.create": "ثبت گزارش",
  "report.approved": "تأیید گزارش",
  "report.rejected": "رد گزارش",
  "user.create": "ایجاد کاربر",
  "user.update": "ویرایش کاربر",
  "settings.update": "تغییر تنظیمات",
  "auth.login": "ورود به سامانه",
  "auth.logout": "خروج از سامانه",
  "file.upload": "بارگذاری فایل",
  "profile.update": "ویرایش پروفایل",
  "message.create": "ارسال پیام",
};

export default function Audit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/audit", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "دریافت لاگ‌ها ناموفق بود.");
        if (active) setLogs(data.logs ?? []);
      })
      .catch((reason) => {
        if (active) setError(reason.message || "خطا در دریافت اطلاعات.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <AppShell>
      <main className="content audit-page">
        <section className="welcome welcome-pro audit-heading">
          <div>
            <div className="welcome-kicker"><span className="online-dot" /> مدیریت سامانه</div>
            <h1>لاگ فعالیت‌ها</h1>
            <p>سوابق ورود، ثبت گزارش‌ها و تغییرات انجام‌شده در سامانه</p>
            <div className="welcome-meta"><span>آخرین ۲۰۰ فعالیت ثبت‌شده</span></div>
          </div>
          <div className="welcome-orbit"><div><strong>{logs.length.toLocaleString("fa-IR")}</strong><small>فعالیت</small></div></div>
        </section>

        <section className="panel audit-list-panel">
          <div className="panel-title">
            <div><span className="panel-eyebrow">ACTIVITY HISTORY</span><h2>تاریخچه فعالیت‌ها</h2></div>
          </div>
          {loading ? (
            <div className="empty-state">در حال دریافت فعالیت‌ها…</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">هنوز فعالیتی ثبت نشده است.</div>
          ) : (
            <div className="audit-list">
              {logs.map((log) => (
                <article className="audit-row" key={log.id}>
                  <div className="audit-icon">◷</div>
                  <div className="audit-main">
                    <b>{actionLabels[log.action] ?? log.action}</b>
                    <small>{log.profiles?.display_name ?? "سیستم"} · {log.entity_type ?? "فعالیت سامانه"}</small>
                  </div>
                  <time>{new Date(log.created_at).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" })}</time>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
