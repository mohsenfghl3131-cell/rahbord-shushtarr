import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import AppShell from "@/app/components/AppShell";
import CommandDashboard from "../CommandDashboard";

const ALLOWED = ["main_admin", "deputy", "battalion_commander", "area_manager", "area_force"];

export default async function CommandDashboardPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");
  if (!ALLOWED.includes(ctx.profile.role)) redirect("/dashboard");

  return <AppShell><main className="shell unified-page"><div className="topbar"><div><span className="eyebrow">COMMAND CENTER</span><h1>داشبورد فرماندهی</h1><p>حوزه موردنظر را انتخاب کنید تا امتیاز و میزان تحقق مأموریت‌های آن را ببینید.</p></div></div><CommandDashboard /></main></AppShell>;
}
