import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentContext } from "@/lib/auth";

const roles = ["main_admin", "deputy", "battalion_commander", "area_manager", "area_force"];
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentContext();
  if (!ctx) return NextResponse.json({ message: "احراز هویت لازم است." }, { status: 401 });
  if (ctx.profile.role !== "main_admin") return NextResponse.json({ message: "فقط مدیر اصلی می‌تواند کاربران را ویرایش کند." }, { status: 403 });
  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 400 }); }

  const admin = db();
  const { data: target } = await admin.from("profiles").select("id,user_code").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ message: "کاربر پیدا نشد." }, { status: 404 });
  if (id === ctx.user.id && body.is_active === false) return NextResponse.json({ message: "نمی‌توانید حساب خودتان را غیرفعال کنید." }, { status: 400 });
  if (target.user_code === "ADMIN001" && body.is_active === false) return NextResponse.json({ message: "حساب پشتیبان مدیر اصلی قابل غیرفعال‌سازی نیست." }, { status: 400 });

  const patch: any = { updated_at: new Date().toISOString() };
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (typeof body.display_name === "string" && body.display_name.trim()) patch.display_name = body.display_name.trim();
  if (typeof body.role === "string") {
    if (!roles.includes(body.role)) return NextResponse.json({ message: "نقش انتخاب‌شده معتبر نیست." }, { status: 400 });
    patch.role = body.role;
  }
  const { error } = await admin.from("profiles").update(patch).eq("id", id);
  if (error) return NextResponse.json({ message: "ویرایش اطلاعات کاربر انجام نشد." }, { status: 500 });

  if (Array.isArray(body.area_ids)) {
    const areaIds = [...new Set(body.area_ids.filter((x: unknown): x is string => typeof x === "string" && x.trim()).map((x: string) => x.trim()))];
    const { data: validAreas, error: areaError } = await admin.from("areas").select("id").in("id", areaIds);
    if (areaError || (validAreas ?? []).length !== areaIds.length) {
      return NextResponse.json({ message: "یک یا چند حوزه انتخاب‌شده معتبر نیست." }, { status: 400 });
    }
    const { error: deleteError } = await admin.from("user_area_access").delete().eq("user_id", id);
    if (deleteError) return NextResponse.json({ message: "حذف دسترسی‌های قبلی انجام نشد." }, { status: 500 });
    if (areaIds.length) {
      const { error: insertError } = await admin.from("user_area_access").insert(areaIds.map((area_id: string) => ({ user_id: id, area_id })));
      if (insertError) return NextResponse.json({ message: "ثبت دسترسی حوزه‌ای انجام نشد." }, { status: 500 });
    }
  }

  await admin.from("audit_logs").insert({ user_id: ctx.user.id, action: "user.update", entity_type: "profile", entity_id: id, metadata: patch });
  return NextResponse.json({ ok: true });
}