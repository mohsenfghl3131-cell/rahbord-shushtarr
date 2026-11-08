import { redirect } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import { getCurrentContext } from "@/lib/auth";
import CommandDashboard from "../../CommandDashboard";

export default async function CommandAreaPage({ params }: { params: Promise<{ areaId: string }> }) {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");
  if (!["main_admin", "deputy", "battalion_commander", "area_manager", "area_force"].includes(ctx.profile.role)) redirect("/dashboard");
  const { areaId } = await params;
  return (
    <AppShell>
      <main className="content">
        <CommandDashboard initialAreaId={areaId} detailOnly />
      </main>
    </AppShell>
  );
}
