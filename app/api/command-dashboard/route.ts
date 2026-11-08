import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentContext } from "@/lib/auth";

const SENIOR = ["main_admin", "deputy", "battalion_commander"];
const AREA_ROLES = ["area_manager", "area_force"];
const EMPTY = "00000000-0000-0000-0000-000000000000";

const ORDER = [
  "حوزه یک شهری", "حوزه دو شهری", "حوزه سه شهری",
  "حوزه یک روستایی", "حوزه دو روستایی", "حوزه سه روستایی",
  "حوزه چهار روستایی", "حوزه پنج روستایی",
  "حوزه حضرت زینب", "حوزه حضرت فاطمه"
];

export async function GET(request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx) return NextResponse.json({ message: "ابتدا وارد سامانه شوید." }, { status: 401 });

  const privileged = SENIOR.includes(ctx.profile.role);
  const areaScoped = AREA_ROLES.includes(ctx.profile.role);
  if (!privileged && !areaScoped) {
    return NextResponse.json({ message: "دسترسی به داشبورد فرماندهی ندارید." }, { status: 403 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const url = new URL(request.url);
  const areaId = url.searchParams.get("area_id");

  if (!areaId) {
    let query = db.from("areas").select("id,name,is_active").eq("is_active", true);
    if (!privileged) query = query.in("id", ctx.areaIds.length ? ctx.areaIds : [EMPTY]);
    const { data, error } = await query;
    if (error) return NextResponse.json({ message: "دریافت فهرست حوزه‌ها ناموفق بود." }, { status: 500 });

    const areas = (data ?? []).sort((a: any, b: any) => {
      const ai = ORDER.findIndex((name) => String(a.name).includes(name));
      const bi = ORDER.findIndex((name) => String(b.name).includes(name));
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || String(a.name).localeCompare(String(b.name), "fa");
    });
    return NextResponse.json({ areas });
  }

  if (areaScoped && !ctx.areaIds.includes(areaId)) {
    return NextResponse.json({ message: "شما فقط به داشبورد حوزه خود دسترسی دارید." }, { status: 403 });
  }

  const [{ data: area, error: areaError }, { data: reports, error: reportError }, { data: missions, error: missionError }, { data: scores, error: scoreError }] = await Promise.all([
    db.from("areas").select("id,name,is_active").eq("id", areaId).eq("is_active", true).maybeSingle(),
    db.from("reports").select("id,status,created_at").eq("area_id", areaId).is("deleted_at", null).order("created_at", { ascending: true }),
    db.from("missions").select("id,title,target_value,unit,category_groups(name)").eq("is_active", true).order("created_at", { ascending: false }),
    db.from("mission_scores").select("mission_id,actual_value,updated_at").eq("area_id", areaId)
  ]);

  if (areaError || reportError || missionError || scoreError) {
    return NextResponse.json({ message: "دریافت اطلاعات داشبورد حوزه با خطا روبه‌رو شد." }, { status: 500 });
  }
  if (!area) return NextResponse.json({ message: "حوزه موردنظر پیدا نشد یا غیرفعال است." }, { status: 404 });

  const reportRows = reports ?? [];
  const status = {
    total: reportRows.length,
    approved: reportRows.filter((r: any) => r.status === "approved").length,
    pending: reportRows.filter((r: any) => r.status === "pending").length,
    rejected: reportRows.filter((r: any) => r.status === "rejected").length
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 13);
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      label: date.toLocaleDateString("fa-IR", { day: "numeric", month: "short" }),
      count: 0
    };
  });
  for (const report of reportRows as any[]) {
    const key = String(report.created_at).slice(0, 10);
    const day = trend.find((item) => item.date === key);
    if (day) day.count += 1;
  }

  const scoreRows = scores ?? [];
  const missionProgress = (missions ?? []).map((mission: any) => {
    const score = scoreRows.find((item: any) => item.mission_id === mission.id);
    const target = Math.max(0, Number(mission.target_value) || 0);
    const actual = Math.max(0, Number(score?.actual_value) || 0);
    return {
      id: mission.id,
      title: mission.title,
      unit: mission.unit || "",
      group: mission.category_groups?.name || "بخش",
      target,
      actual,
      percent: target > 0 ? Math.round((actual / target) * 100) : 0,
      submitted: Boolean(score)
    };
  });

  const submittedMissions = missionProgress.filter((item: any) => item.submitted).length;
  const missionAverage = missionProgress.length
    ? Math.round(missionProgress.reduce((sum: number, item: any) => sum + Math.min(100, item.percent), 0) / missionProgress.length)
    : 0;

  return NextResponse.json({
    area,
    status,
    trend,
    missionProgress,
    summary: {
      activeMissions: missionProgress.length,
      submittedMissions,
      missionAverage,
      reportCount: status.total
    },
    updatedAt: new Date().toISOString()
  });
}
