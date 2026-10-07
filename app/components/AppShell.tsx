"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { label: "پیام‌ها", href: "/messages", icon: "✉", roles: ["main_admin", "area_manager"] },
  { label: "کاربران", href: "/users", icon: "♟", roles: ["main_admin", "deputy", "battalion_commander"] },
  { label: "حوزه‌ها", href: "/areas", icon: "⌖", roles: ["main_admin", "deputy", "battalion_commander", "area_manager"] },
  { label: "دسته‌بندی‌ها", href: "/categories", icon: "▦", roles: ["main_admin", "deputy", "battalion_commander"] },
  { label: "فایل‌ها", href: "/files", icon: "▣", roles: [] },
  { label: "گزارش‌های تحلیلی", href: "/analytics", icon: "⌁", roles: ["main_admin", "deputy", "battalion_commander", "area_manager"] },
  { label: "لاگ‌ها", href: "/audit", icon: "◷", roles: ["main_admin", "deputy", "battalion_commander"] },
  { label: "تنظیمات", href: "/settings", icon: "⚙", roles: ["main_admin", "deputy", "battalion_commander"] }
] as const;

const roles: Record<string, string> = {
  main_admin: "مدیر اصلی",
  deputy: "معاون",
  battalion_commander: "فرمانده گردان",
  area_manager: "مدیر حوزه",
  area_force: "نیروی حوزه"
};

const pageTitles: Record<string, string> = {
  "/dashboard": "داشبورد فرماندهی",
  "/reports/new": "ثبت گزارش جدید",
  "/reports/mine": "گزارش‌های من",
  "/reports": "همه گزارش‌ها",
  "/messages": "پیام‌ها",
  "/users": "مدیریت کاربران",
  "/areas": "مدیریت حوزه‌ها",
  "/categories": "دسته‌بندی‌ها",
  "/files": "فایل‌ها",
  "/analytics": "گزارش‌های تحلیلی",
  "/audit": "لاگ‌های سامانه",
  "/settings": "تنظیمات"
};

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const [me, setMe] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => null);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const role = me?.profile?.role;
  const visible = nav.filter((item) => !item.roles.length || (role && item.roles.includes(role)) || (item.href === "/reports" && me?.can_review) || (item.href === "/messages" && me?.can_message));

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
    ["/users", "/areas", "/categories", "/files", "/analytics", "/audit", "/settings"].includes(item.href)
  );

  return (
    <div className={"app-shell unified-shell" + (collapsed ? " sidebar-collapsed" : "")}>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="بستن منو"
          onClick={closeMobile}
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

          <div className="header-context">
            <span>سامانه مدیریت و پایش</span>
            <b>{pageTitle}</b>
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
