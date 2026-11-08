import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentContext } from "@/lib/auth";

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SENIOR = ["main_admin", "deputy"];
const EMPTY = "00000000-0000-0000-0000-000000000000";

async function access() {
  const ctx = await getCurrentContext();
  if (!ctx) return { ctx: null, battalionIds: [] as string[], error: NextResponse.json({ message: "ابتدا وارد سامانه شوید." }, { status: 401 }) };
  if (SENIOR.includes(ctx.profile.role)) return { ctx, battalionIds: ["brothers", "sisters"], error: null };
  if (ctx.profile.role === "area_manager" || ctx.profile.role === "area_force") {
    const ids = ctx.areaIds.length ? ctx.areaIds : [EMPTY];
    const { data: mapped } = await db().from("battalion_areas").select("battalion_id").in("area_id", ids);
    return { ctx, battalionIds: [...new Set((mapped ?? []).map((x: any) => x.battalion_id))], error: null };
  }
  if (ctx.profile.role !== "battalion_commander") return { ctx, battalionIds: [], error: NextResponse.json({ message: "دسترسی به داشبورد گردان‌ها ندارید." }, { status: 403 }) };
  const { data } = await db().from("battalion_commander_assignments").select("battalion_id").eq("user_id", ctx.user.id).maybeSingle();
  if (!data?.battalion_id) return { ctx, battalionIds: [], error: NextResponse.json({ message: "حساب فرمانده هنوز به گردان برادر یا خواهر اختصاص داده نشده است. مدیر اصلی باید این انتساب را ثبت کند." }, { status: 403 }) };
  return { ctx, battalionIds: [data.battalion_id], error: null };
}

export async function GET() {
  const { ctx, battalionIds, error } = await access();
  if (error) return error;
  const admin = db();
  let allowedAreaIds: string[] | null = null;
  if (ctx!.profile.role === "area_manager" || ctx!.profile.role === "area_force") {
    allowedAreaIds = ctx!.areaIds;
  }
  if (ctx!.profile.role === "battalion_commander") {
    const { data: assignment } = await admin.from("battalion_commander_assignments").select("battalion_id").eq("user_id", ctx!.user.id).maybeSingle();
    if (!assignment?.battalion_id) return NextResponse.json({ message: "گردان این فرمانده مشخص نشده است." }, { status: 403 });
    const { data: mapped } = await admin.from("battalion_areas").select("area_id").eq("battalion_id", assignment.battalion_id);
    allowedAreaIds = (mapped ?? []).map((x: any) => x.area_id);
  }
  const [battalionsRes, mapRes, missionsRes, battalionQuotaRes, areaQuotaRes, scoresRes] = await Promise.all([
    admin.from("battalions").select("id,name").in("id", battalionIds.length ? battalionIds : [EMPTY]),
    admin.from("battalion_areas").select("battalion_id,area_id,areas(id,name,code)").in("battalion_id", battalionIds),
    admin.from("missions").select("id,title,unit,target_value,group_id,category_groups(name)").eq("is_active", true).order("created_at", { ascending: false }),
    admin.from("mission_battalion_quotas").select("mission_id,battalion_id,quota_value").in("battalion_id", battalionIds),
    admin.from("mission_area_quotas").select("mission_id,area_id,quota_value"),
    admin.from("mission_scores").select("mission_id,area_id,actual_value")
  ]);
  const failure = [battalionsRes, mapRes, missionsRes, battalionQuotaRes, areaQuotaRes, scoresRes].find((r) => r.error);
  if (failure?.error) return NextResponse.json({ message: "دریافت اطلاعات سهمیه‌ها ناموفق بود. " + failure.error.message }, { status: 500 });

  const missions = missionsRes.data ?? [];
  const allAreaIds = [...new Set((mapRes.data ?? []).map((row: any) => row.area_id).filter((id: string) => !allowedAreaIds || allowedAreaIds.includes(id)))];
  const { data: reportRows, error: reportsError } = allAreaIds.length
    ? await admin.from("reports").select("id,title,status,created_at,area_id,categories(name)").is("deleted_at", null).in("area_id", allAreaIds).order("created_at", { ascending: false }).limit(1000)
    : { data: [], error: null };
  if (reportsError) return NextResponse.json({ message: "دریافت گزارش‌های حوزه‌ها ناموفق بود. " + reportsError.message }, { status: 500 });
  const reportsByArea = new Map<string, any[]>();
  for (const report of reportRows ?? []) {
    const list = reportsByArea.get(report.area_id) ?? [];
    list.push({ id: report.id, title: report.title, status: report.status, created_at: report.created_at, category: (report as any).categories?.name || "بدون دسته‌بندی" });
    reportsByArea.set(report.area_id, list);
  }
  const areasByBattalion = new Map<string, any[]>();
  for (const row of mapRes.data ?? []) {
    const area = Array.isArray(row.areas) ? row.areas[0] : row.areas;
    if (!area) continue;
    const list = areasByBattalion.get(row.battalion_id) ?? [];
    list.push(area);
    areasByBattalion.set(row.battalion_id, list);
  }
  const battalionQuotas = battalionQuotaRes.data ?? [];
  const areaQuotas = areaQuotaRes.data ?? [];
  const scores = scoresRes.data ?? [];
  const battalions = (battalionsRes.data ?? []).map((battalion) => {
    const areaOrder = ["urban-1","urban-2","urban-3","rural-1","rural-2","rural-3","rural-4","rural-5","special-zainab","special-fatemeh"];
    const areas = (areasByBattalion.get(battalion.id) ?? []).filter((a) => !allowedAreaIds || allowedAreaIds.includes(a.id)).sort((a, b) => areaOrder.indexOf(a.code) - areaOrder.indexOf(b.code));
    const areaIds = new Set(areas.map((a) => a.id));
    const missionRows = missions.map((mission: any) => {
      const totalRow = battalionQuotas.find((q) => q.mission_id === mission.id && q.battalion_id === battalion.id);
      const missionAreas = areas.map((area) => {
        const allocation = areaQuotas.find((q) => q.mission_id === mission.id && q.area_id === area.id);
        const quota = Number(allocation?.quota_value ?? 0);
        const actual = scores.filter((s) => s.mission_id === mission.id && s.area_id === area.id).reduce((sum, s) => sum + Number(s.actual_value ?? 0), 0);
        return { id: area.id, name: area.name, quota, actual, remaining: Math.max(0, quota - actual), percent: quota > 0 ? Math.round(actual / quota * 100) : 0 };
      });
      const quota = Number(totalRow?.quota_value ?? 0);
      const actual = scores.filter((s) => s.mission_id === mission.id && areaIds.has(s.area_id)).reduce((sum, s) => sum + Number(s.actual_value ?? 0), 0);
      return {
        id: mission.id, title: mission.title, unit: mission.unit || "عدد",
        section: (mission as any).category_groups?.name || "بدون بخش",
        quota, actual, remaining: Math.max(0, quota - actual),
        percent: quota > 0 ? Math.round(actual / quota * 100) : 0,
        areas: missionAreas
      };
    });
    const quota = missionRows.reduce((sum, m) => sum + m.quota, 0);
    const actual = missionRows.reduce((sum, m) => sum + m.actual, 0);
    const remaining = Math.max(0, quota - actual);
    return {
      id: battalion.id, name: battalion.name, areas,
      quota, actual, remaining, surplus: Math.max(0, actual - quota),
      percent: quota > 0 ? Math.round(actual / quota * 100) : 0,
      missions: missionRows
    };
  });
  const areaMap = new Map<string, any>();
  for (const battalion of battalions) {
    for (const area of battalion.areas) {
      const rows = battalion.missions.map((m: any) => ({ mission_id: m.id, title: m.title, quota: m.areas.find((x: any) => x.id === area.id)?.quota ?? 0, actual: m.areas.find((x: any) => x.id === area.id)?.actual ?? 0 }));
      const current = areaMap.get(area.id) ?? { id: area.id, name: area.name, quota: 0, actual: 0, battalion_quota: battalion.quota, battalion_actual: battalion.actual, missions: [] as any[] };
      current.quota += rows.reduce((sum: number, x: any) => sum + x.quota, 0);
      current.actual += rows.reduce((sum: number, x: any) => sum + x.actual, 0);
      current.missions.push(...rows);
      areaMap.set(area.id, current);
    }
  }
  const areaOrder = ["urban-1","urban-2","urban-3","rural-1","rural-2","rural-3","rural-4","rural-5","special-zainab","special-fatemeh"];
  const areas = [...areaMap.values()].map((a: any) => {
    const reports = reportsByArea.get(a.id) ?? [];
    return { ...a, remaining: Math.max(0,a.quota-a.actual), surplus: Math.max(0,a.actual-a.quota), percent: a.quota ? Math.round(a.actual/a.quota*100) : 0,
      battalion_quota: a.battalion_quota || 0, battalion_actual: a.battalion_actual || 0,
      battalion_contribution_percent: a.battalion_quota ? Math.round(a.actual/a.battalion_quota*1000)/10 : 0,
      report_count: reports.length, approved_reports: reports.filter((r: any) => r.status === "approved").length,
      pending_reports: reports.filter((r: any) => r.status === "pending").length,
      rejected_reports: reports.filter((r: any) => r.status === "rejected").length,
      reports: reports.slice(0, 30)
    };
  }).sort((a: any,b: any) => {
    const ac = (mapRes.data ?? []).find((x: any) => x.area_id === a.id);
    const bc = (mapRes.data ?? []).find((x: any) => x.area_id === b.id);
    const aa = Array.isArray(ac?.areas) ? ac.areas[0] : ac?.areas;
    const ba = Array.isArray(bc?.areas) ? bc.areas[0] : bc?.areas;
    return areaOrder.indexOf(aa?.code) - areaOrder.indexOf(ba?.code);
  });
  return NextResponse.json({ battalions, areas, can_manage: Boolean(ctx && SENIOR.includes(ctx.profile.role)), updated_at: new Date().toISOString() });
}

export async function PATCH(request: Request) {
  const { ctx, battalionIds, error } = await access();
  if (error) return error;
  if (!ctx || !SENIOR.includes(ctx.profile.role)) return NextResponse.json({ message: "تغییر سهمیه کل گردان فقط در اختیار مدیر اصلی و معاون است." }, { status: 403 });
  const body = await request.json();
  const missionId = String(body.mission_id ?? "");
  const battalionId = String(body.battalion_id ?? "");
  const total = Number(body.quota_total);
  const allocations = Array.isArray(body.allocations) ? body.allocations : [];
  if (!missionId || !battalionIds.includes(battalionId) || !Number.isFinite(total) || total < 0) {
    return NextResponse.json({ message: "اطلاعات سهمیه معتبر نیست." }, { status: 400 });
  }
  if (allocations.some((x: any) => !x.area_id || !Number.isFinite(Number(x.quota_value)) || Number(x.quota_value) < 0)) {
    return NextResponse.json({ message: "مقدار سهمیه یکی از حوزه‌ها معتبر نیست." }, { status: 400 });
  }
  const admin = db();
  const [{ data: mission }, { data: mappedAreas }] = await Promise.all([
    admin.from("missions").select("id").eq("id", missionId).eq("is_active", true).maybeSingle(),
    admin.from("battalion_areas").select("area_id").eq("battalion_id", battalionId)
  ]);
  if (!mission) return NextResponse.json({ message: "مأموریت فعال پیدا نشد." }, { status: 404 });
  const validIds = new Set((mappedAreas ?? []).map((x) => x.area_id));
  if (allocations.some((x: any) => !validIds.has(String(x.area_id)))) return NextResponse.json({ message: "حوزه‌ای خارج از این گردان در تخصیص سهمیه وجود دارد." }, { status: 400 });
  const allocationSum = allocations.reduce((sum: number, x: any) => sum + Number(x.quota_value), 0);
  if (allocationSum > total + 0.0001) return NextResponse.json({ message: "مجموع سهمیه حوزه‌ها نمی‌تواند از سهمیه کل گردان بیشتر باشد." }, { status: 400 });
  const now = new Date().toISOString();
  const { error: totalError } = await admin.from("mission_battalion_quotas").upsert({
    mission_id: missionId, battalion_id: battalionId, quota_value: total, updated_by: ctx!.user.id, updated_at: now
  }, { onConflict: "mission_id,battalion_id" });
  if (totalError) return NextResponse.json({ message: "ثبت سهمیه کل گردان انجام نشد: " + totalError.message }, { status: 500 });
  if (allocations.length) {
    const { error: allocationError } = await admin.from("mission_area_quotas").upsert(
      allocations.map((x: any) => ({ mission_id: missionId, area_id: String(x.area_id), quota_value: Number(x.quota_value), updated_by: ctx!.user.id, updated_at: now })),
      { onConflict: "mission_id,area_id" }
    );
    if (allocationError) return NextResponse.json({ message: "ثبت سهمیه حوزه‌ها انجام نشد: " + allocationError.message }, { status: 500 });
  }
  await admin.from("audit_logs").insert({ user_id: ctx!.user.id, action: "battalion.quota.update", entity_type: "mission", entity_id: missionId, metadata: { battalion_id: battalionId, quota_total: total, allocation_sum: allocationSum } });
  return NextResponse.json({ ok: true });
}
