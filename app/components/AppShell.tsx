"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = { children: ReactNode };
type NavItem = {
  label: string;
  href: string;
  icon: string;
  roles: readonly string[];
};

const nav: readonly NavItem[] = [
  { label: "داشبورد", href: "/dashboard", icon: "⌂", roles: [] },
  { label: "ثبت گزارش", href: "/reports/new", icon: "＋", roles: [] },
  { label: "گزارش‌های من", href: "/reports/mine", icon: "▤", roles: [] },
  { label: "همه گزارش‌ها", href: "/reports", icon: "☷", roles: ["main_admin", "deputy", "battalion_commander", "area_manager"] },
  { label: "ارسال نامه", href: "/messages", icon: "✉", roles: [] },
  { label: "نمره‌دهی", href: "/scores", icon: "％", roles: ["main_admin", "deputy", "battalion_commander", "area_manager"] },
  { label: "ارزیابی عملکرد", href: "/performance", icon: "★", roles: ["main_admin", "deputy", "battalion_commander", "area_manager", "area_force"] },
  { label: "کاربران", href: "/users", icon: "♟", roles: ["main_admin", "deputy", "battalion_commander"] },
  { label: "نیروها", href: "/forces", icon: "♟", roles: ["main_admin", "deputy", "battalion_commander", "area_manager"] },
  { label: "چارت سازمانی", href: "/organization", icon: "⌘", roles: ["main_admin", "deputy", "battalion_commander"] },
  { label: "حوزه‌ها", href: "/areas", icon: "⌖", roles: ["main_admin", "deputy", "battalion_commander", "area_manager"] },
  { label: "پایگاه‌ها", href: "/bases", icon: "⌂", roles: [] },
  { label: "دسته‌بندی‌ها", href: "/categories", icon: "▦", roles: ["main_admin", "deputy", "battalion_commander"] },
  { label: "فایل‌ها", href: "/files", icon: "▣", roles: [] },
  { label: "گزارش ماهانه و تحلیلی", href: "/analytics", icon: "⌁", roles: ["main_admin", "deputy", "battalion_commander", "area_manager"] },
  { label: "لاگ‌ها", href: "/audit", icon: "◷", roles: ["main_admin", "deputy", "battalion_commander"] },
  { label: "مدیریت پیام روز", href: "/daily-message", icon: "✦", roles: ["main_admin", "deputy", "battalion_commander"] },
  { label: "اتصال تلگرام", href: "/telegram", icon: "➤", roles: ["main_admin", "deputy", "battalion_commander"] },
  { label: "تنظیمات", href: "/settings", icon: "⚙", roles: ["main_admin", "deputy", "battalion_commander"] }
] as const;

const roles: Record<string, string> = {
  main_admin: "مدیر اصلی",
  deputy: "معاون",
  battalion_commander: "فرمانده گردان",
  area_manager: "مدیر حوزه",
  area_force: "نیروی حوزه",
  section_manager: "مسئول بخش"
};

const pageTitles: Record<string, string> = {
  "/dashboard": "سامانه راهبرد شوشتر",
  "/reports/new": "ثبت گزارش جدید",
  "/reports/mine": "گزارش‌های من",
  "/reports": "همه گزارش‌ها",
  "/messages": "ارسال نامه و صندوق نامه‌ها",
  "/scores": "نمره‌دهی و سهمیه مأموریت‌ها",
  "/performance": "ارزیابی و رتبه‌بندی عملکرد",
  "/users": "مدیریت کاربران",
  "/forces": "نیروهای حوزه‌ها",
  "/organization": "چارت سازمانی",
  "/areas": "مدیریت حوزه‌ها",
  "/bases": "پایگاه‌ها و چارت حوزه‌ها",
  "/categories": "دسته‌بندی‌ها",
  "/files": "فایل‌ها",
  "/analytics": "گزارش عملکرد ماهانه و تحلیلی",
  "/audit": "لاگ‌های سامانه",
  "/settings": "تنظیمات",
  "/telegram": "اتصال تلگرام",
  "/daily-message": "مدیریت پیام روز"
};

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [notificationData, setNotificationData] = useState<any>({ unread_count: 0, unread_messages: [], activity: [], active_missions: [], is_leader: false, is_area: false });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("rahbord-theme");
    const initial = saved === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("rahbord-theme", next);
  };

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => null);
  }, []);

  useEffect(() => {
    let alive = true;
    const loadNotifications = () => fetch("/api/notifications", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => { if (alive && data) setNotificationData(data); }).catch(() => null);
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const role = me?.profile?.role;
  const visible = nav.filter((item) => !item.roles.length || (role && item.roles.includes(role)) || (item.href === "/reports" && me?.can_review) || (item.href === "/messages" && me?.can_message) || (item.href === "/scores" && (me?.responsible_group_ids?.length > 0)));

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (pathname === href) return true;
    return href !== "/reports" && href !== "/users" && pathname.startsWith(href + "/");
  };

  const initials = me?.profile?.display_name?.slice(0, 1) ?? "ر";
  const pageTitle =
    pageTitles[pathname] ??
    (pathname.startsWith("/reports/") ? "گزارش‌ها" : pathname.startsWith("/users/") ? "کاربران" : "راهبرد شوشتر");

  const closeMobile = () => setMobileOpen(false);

  const renderNav = (items: readonly NavItem[]) =>
    items.map((item) => {
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          className={active ? "active" : ""}
          aria-current={active ? "page" : undefined}
          onClick={closeMobile}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </Link>
      );
    });

  const workspace = visible.filter((item) =>
    ["/dashboard", "/reports/new", "/reports/mine", "/reports"].includes(item.href)
  );
  const management = visible.filter((item) =>
    ["/messages", "/scores", "/performance", "/users", "/forces", "/organization", "/areas", "/bases", "/categories", "/files", "/analytics", "/audit", "/daily-message", "/telegram", "/settings"].includes(item.href)
  );

  return (
    <div className={"app-shell unified-shell" + (collapsed ? " sidebar-collapsed" : "")}>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="بستن منو"
          onClick={closeMobile}
          type="button"
        />
      )}

      <aside className={"sidebar" + (mobileOpen ? " open" : "")} aria-label="ناوبری سامانه">
        <div className="brand">
          <div className="brand-mark">ر</div>
          <div className="brand-copy">
            <b>راهبرد شوشتر</b>
            <small>مرکز عملیات و پایش</small>
          </div>
          <span className="brand-status" />
          <button type="button" className="sidebar-mobile-back" onClick={closeMobile} aria-label="بستن پنل و بازگشت" title="بازگشت به صفحه">→ <span>بازگشت</span></button>
        </div>

        <div className="sidebar-controls">
          <button
            type="button"
            className="sidebar-collapse"
            aria-label={collapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
            title={collapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <div className="sidebar-scroll">
          <div className="sidebar-section">
            <span>فضای کاری</span>
            <nav>{renderNav(workspace)}</nav>
          </div>

          <div className="sidebar-section">
            <span>مدیریت سامانه</span>
            <nav>{renderNav(management)}</nav>
          </div>
        </div>

        <div className="sidebar-profile">
          <Link href="/profile" className="sidebar-user" onClick={closeMobile}>
            <div className="avatar sidebar-avatar">{initials}</div>
            <div>
              <b>{me?.profile?.display_name ?? "کاربر سامانه"}</b>
              <small>{roles[role] ?? "در حال بارگذاری"}</small>
            </div>
            <span>‹</span>
          </Link>
          <Link className="sidebar-logout" href="/logout" onClick={closeMobile}>
            <span>↪</span>
            خروج امن
          </Link>
        </div>
      </aside>

      <div className="main">
        <header className="header unified-header">
          <button
            className="menu-toggle"
            type="button"
            aria-label="منوی سامانه"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>

          <button type="button" className="header-back-button" aria-label="بازگشت به صفحه قبل" title="بازگشت" onClick={() => { if (window.history.length > 1) router.back(); else if (pathname !== "/dashboard") router.push("/dashboard"); }}>← <span>بازگشت</span></button>

          <div className="header-context">
            <span>سامانه مدیریت و پایش</span>
            <b>{pageTitle}</b>
          </div>
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "فعال‌سازی تم روشن" : "فعال‌سازی تم تاریک"} title={theme === "dark" ? "حالت روشن" : "حالت تاریک"}>
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            <small>{theme === "dark" ? "روشن" : "تاریک"}</small>
          </button>

          <div className="notification-wrap">
            <button className={"notification-bell" + (notificationsOpen ? " active" : "")} type="button" aria-label="اعلان‌ها" aria-expanded={notificationsOpen} title="اعلان‌ها" onClick={() => setNotificationsOpen((value) => !value)}>
              <span aria-hidden="true">🔔</span>
              {notificationData.unread_count > 0 && <i>{notificationData.unread_count > 99 ? "۹۹+" : notificationData.unread_count}</i>}
            </button>
            {notificationsOpen && (
              <section className="notification-panel" aria-label="مرکز اعلان‌ها">
                <div className="notification-head">
                  <div><b>مرکز اعلان‌ها</b><small>به‌روزرسانی خودکار هر ۳۰ ثانیه</small></div>
                  <button type="button" aria-label="بستن اعلان‌ها" onClick={() => setNotificationsOpen(false)}>×</button>
                </div>
                <div className="notification-scroll">
                  <Link className="notification-summary" href="/messages" onClick={() => setNotificationsOpen(false)}>
                    <span className="notification-icon">✉</span><span><b>{notificationData.unread_count || 0} نامه خوانده‌نشده</b><small>مشاهده صندوق نامه‌ها</small></span>
                  </Link>
                  {notificationData.unread_messages?.length > 0 && <>
                    <div className="notification-section-title">نامه‌های جدید</div>
                    {notificationData.unread_messages.map((item: any) => <Link className="notification-row" key={item.id} href="/messages" onClick={() => setNotificationsOpen(false)}><b>{item.subject || "بدون موضوع"}</b><span>فرستنده: {item.sender?.display_name || "کاربر سامانه"}</span></Link>)}
                  </>}
                  {notificationData.is_leader && <>
                    <div className="notification-section-title">فعالیت مدیران و کاربران</div>
                    {notificationData.activity?.length ? notificationData.activity.map((item: any) => <div className="notification-row" key={item.id}><b>{item.title}</b><span>{item.detail}</span></div>) : <div className="notification-empty">فعالیت تازه‌ای ثبت نشده است</div>}
                  </>}
                  {notificationData.is_area && <>
                    <div className="notification-section-title">مأموریت‌های در حال اجرا</div>
                    {notificationData.active_missions?.length ? notificationData.active_missions.map((item: any) => <Link className="notification-row" key={item.id} href="/scores" onClick={() => setNotificationsOpen(false)}><b>{item.title}</b><span>{item.group}{item.deadline_at ? " · مهلت: " + new Date(item.deadline_at).toLocaleDateString("fa-IR") : ""}</span></Link>) : <div className="notification-empty">مأموریت فعالی وجود ندارد</div>}
                  </>}
                </div>
                <div className="notification-foot"><Link href="/messages" onClick={() => setNotificationsOpen(false)}>رفتن به صندوق نامه‌ها ←</Link></div>
              </section>
            )}
          </div>

          <div className="header-spacer" />

          <Link className="header-profile" href="/profile">
            <span className="header-live" />
            {me?.profile?.display_name ?? "کاربر"}
          </Link>
        </header>

        {children}
      </div>
    </div>
  );
}
