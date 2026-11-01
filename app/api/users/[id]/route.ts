import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentContext } from "@/lib/auth";

const roles = ["main_admin", "deputy", "battalion_commander", "area_manager", "area_force", "section_manager"];
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentContext();
  if (!ctx) return NextResponse.json({ message: "احراز هویت لازم است." }, { status: 401 });
  if (ctx.profile.role !== "main_admin") return NextResponse.json({ message: "فقط مدیر اصلی می‌تواند کاربران را ویرایش کند." }, { status: 403 });

  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 400 });
  }

  const admin = db();
  const { data: target } = await admin.from("profiles").select("id,user_code,role").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ message: "کاربر پیدا نشد." }, { status: 404 });

  const deactivateRequested: boolean = body.is_active === false;
  if (id === ctx.user.id && deactivateRequested) {
    return NextResponse.json({ message: "نمی‌توانید حساب خودتان را غیرفعال کنید." }, { status: 400 });
  }
  if (target.user_code === "ADMIN001" && deactivateRequested) {
    return NextResponse.json({ message: "حساب پشتیبان مدیر اصلی قابل غیرفعال‌سازی نیست." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (typeof body.display_name === "string" && body.display_name.trim()) patch.display_name = body.display_name.trim();
  if (typeof body.role === "string") {
    if (!roles.includes(body.role)) return NextResponse.json({ message: "نقش انتخاب‌شده معتبر نیست." }, { status: 400 });
    if ((id === ctx.user.id || target.user_code === "ADMIN001") && body.role !== "main_admin") {
      return NextResponse.json({ message: "نقش مدیر اصلی برای این حساب قابل تغییر نیست." }, { status: 400 });
    }
    patch.role = body.role;
  }

  let groupIds: string[] | null = null;
  if (Array.isArray(body.group_ids)) {
    groupIds = Array.from(new Set((body.group_ids as unknown[]).filter((v): v is string => typeof v === "string" && v.trim()).map(v => v.trim())));
    const { data: validGroups, error: groupError } = await admin.from("category_groups").select("id").in("id", groupIds).eq("is_active", true);
    if (groupError || (validGroups ?? []).length !== groupIds.length) return NextResponse.json({ message: "یک یا چند بخش انتخاب‌شده معتبر نیست." }, { status: 400 });
    if ((body.role ?? target.role) === "section_manager" && groupIds.length === 0) return NextResponse.json({ message: "برای مسئول بخش حداقل یک بخش انتخاب کنید." }, { status: 400 });
  }

  // Validate all requested area IDs before changing the profile to avoid partial updates.
  let areaIds: string[] | null = null;
  if (Array.isArray(body.area_ids)) {
    const rawAreaIds = (body.area_ids as unknown[])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim());
    areaIds = Array.from(new Set(rawAreaIds));

    const { data: validAreas, error: areaError } = await admin.from("areas").select("id").in("id", areaIds);
    if (areaError || (validAreas ?? []).length !== areaIds.length) {
      return NextResponse.json({ message: "یک یا چند حوزه انتخاب‌شده معتبر نیست." }, { status: 400 });
    }
  }

  if ((body.role ?? target.role) === "section_manager" && Array.isArray(body.area_ids) && body.area_ids.length > 0) return NextResponse.json({ message: "مسئول بخش نباید به حوزه‌ای متصل باشد." }, { status: 400 });

  const { error } = await admin.from("profiles").update(patch).eq("id", id);
  if (error) return NextResponse.json({ message: "ویرایش اطلاعات کاربر انجام نشد." }, { status: 500 });

  if (areaIds !== null) {
    const { error: deleteError } = await admin.from("user_area_access").delete().eq("user_id", id);
    if (deleteError) return NextResponse.json({ message: "حذف دسترسی‌های قبلی انجام نشد." }, { status: 500 });

    if (areaIds.length > 0) {
      const rows = areaIds.map((area_id) => ({ user_id: id, area_id }));
      const { error: insertError } = await admin.from("user_area_access").insert(rows);
      if (insertError) return NextResponse.json({ message: "ثبت دسترسی حوزه‌ای انجام نشد." }, { status: 500 });
    }
  }

  if (groupIds !== null) {
    const { error: removeGroupsError } = await admin.from("category_group_responsibles").delete().eq("user_id", id);
    if (removeGroupsError) return NextResponse.json({ message: "به‌روزرسانی مسئولیت بخش‌ها انجام نشد." }, { status: 500 });
    if (groupIds.length) { const { error: addGroupsError } = await admin.from("category_group_responsibles").insert(groupIds.map(group_id => ({ user_id: id, group_id }))); if (addGroupsError) return NextResponse.json({ message: "ثبت بخش‌های تحت مسئولیت انجام نشد." }, { status: 500 }); }
  }

  await admin.from("audit_logs").insert({
    user_id: ctx.user.id,
    action: "user.update",
    entity_type: "profile",
    entity_id: id,
    metadata: { ...patch, area_ids: areaIds ?? undefined, group_ids: groupIds ?? undefined },
  });

  return NextResponse.json({ ok: true });
}


export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentContext();
  if (!ctx) return NextResponse.json({ message: "احراز هویت لازم است." }, { status: 401 });
  if (ctx.profile.role !== "main_admin") {
    return NextResponse.json({ message: "فقط مدیر اصلی می‌تواند کاربران را حذف کند." }, { status: 403 });
  }

  const { id } = await params;
  if (id === ctx.user.id) {
    return NextResponse.json({ message: "نمی‌توانید حساب کاربری خودتان را حذف کنید." }, { status: 400 });
  }

  const admin = db();
  const { data: target, error: lookupError } = await admin
    .from("profiles")
    .select("id,user_code,display_name")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ message: "بررسی حساب کاربر انجام نشد." }, { status: 500 });
  if (!target) return NextResponse.json({ message: "کاربر پیدا نشد." }, { status: 404 });
  if (target.user_code === "ADMIN001") {
    return NextResponse.json({ message: "حساب اصلی پشتیبان سامانه قابل حذف نیست." }, { status: 400 });
  }

  const { error: auditError } = await admin.from("audit_logs").insert({
    user_id: ctx.user.id,
    action: "user.delete",
    entity_type: "profile",
    entity_id: id,
    metadata: { user_code: target.user_code, display_name: target.display_name },
  });
  if (auditError) return NextResponse.json({ message: "ثبت رویداد امنیتی حذف انجام نشد؛ حساب حذف نشد." }, { status: 500 });

  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) return NextResponse.json({ message: "حذف حساب ورود کاربر انجام نشد؛ " + authError.message }, { status: 500 });

  await admin.from("user_area_access").delete().eq("user_id", id);
  await admin.from("category_group_responsibles").delete().eq("user_id", id);
  await admin.from("profiles").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
