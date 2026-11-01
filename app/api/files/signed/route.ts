import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentContext } from "@/lib/auth";

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

export async function GET(request: Request) {
  const ctx = await getCurrentContext();

  if (!ctx) {
    return NextResponse.json(
      { message: "احراز هویت لازم است." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket");
  const path = url.searchParams.get("path");
  const download = url.searchParams.get("download") === "1";

  if (!bucket || !path || !["avatars", "report-files"].includes(bucket)) {
    return NextResponse.json(
      { message: "مسیر فایل نامعتبر است." },
      { status: 400 },
    );
  }

  let allowed = false;
  let downloadName: string | undefined;

  if (bucket === "avatars") {
    allowed = path.startsWith(`users/${ctx.user.id}/`);
  } else {
    const match = path.match(/^reports\/([0-9a-f-]{36})\//i);

    if (match) {
      const { data: report } = await db()
        .from("reports")
        .select("creator_id,area_id,category_id,categories(group_id)")
        .eq("id", match[1])
        .maybeSingle();

      const groupId = (report as any)?.categories?.group_id;
      const role = ctx.profile.role;
      const privileged = [
        "main_admin",
        "deputy",
        "battalion_commander",
      ].includes(role);
      const areaRole = role === "area_manager" || role === "area_force";
      const areaAllowed = areaRole && !!report && ctx.areaIds.includes(report.area_id);
      const sectionAllowed =
        !!groupId && ctx.responsibleGroupIds.includes(groupId);

      allowed =
        !!report &&
        (report.creator_id === ctx.user.id ||
          privileged ||
          areaAllowed ||
          sectionAllowed);
    }

    if (allowed && download) {
      const { data: file } = await db()
        .from("report_files")
        .select("original_name")
        .eq("storage_bucket", bucket)
        .eq("storage_path", path)
        .maybeSingle();

      downloadName = file?.original_name || "report-attachment";
    }
  }

  if (!allowed) {
    return NextResponse.json(
      { message: "دسترسی به این فایل ندارید." },
      { status: 403 },
    );
  }

  const { data, error } = await db()
    .storage.from(bucket)
    .createSignedUrl(
      path,
      300,
      download ? { download: downloadName || true } : undefined,
    );

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { message: "لینک امن فایل ایجاد نشد." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    signed_url: data.signedUrl,
    expires_in: 300,
  });
}
