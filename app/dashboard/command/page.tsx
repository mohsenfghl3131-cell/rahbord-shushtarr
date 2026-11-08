import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import AppShell from "@/app/components/AppShell";
import CommandDashboard from "../CommandDashboard";

const ALLOWED = ["main_admin", "deputy", "battalion_commander", "area_manager", "area_force"];

export default async function CommandDashboardPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");
  if (!ALLOWED.includes(ctx.profile.role)) redirect("/dashboard");

  return <AppShell><main className="shell unified-page command-page-shell"><div className="command-page-hero"><div><span>COMMAND CENTER · RAHBORD SHUSHTAR</span><h1>مرکز فرماندهی و پایش عملکرد</h1><p>مقایسه گردان‌ها و حوزه‌ها، بررسی سهمیه‌ها و مشاهده میزان تحقق مأموریت‌ها</p></div><div className="command-page-hero-mark"><b>ر</b><small>پایش هوشمند</small></div></div><CommandDashboard /></main></AppShell>;
}
