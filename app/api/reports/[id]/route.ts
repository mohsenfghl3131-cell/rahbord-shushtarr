import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{getCurrentContext}from"@/lib/auth";

const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  const{id}=await params;
  const admin=db();
  const{data:report,error}=await admin.from("reports")
    .select("id,title,body,status,rejection_reason,created_at,updated_at,reviewed_at,creator_id,reviewer_id,area_id,category_id,areas(id,name),categories(id,name,group_id,category_groups(id,name,responsible_user_id))")
    .eq("id",id).is("deleted_at",null).maybeSingle();
  if(error||!report)return NextResponse.json({message:"گزارش پیدا نشد."},{status:404});

  const groupId=(report as any).categories?.category_groups?.id;
  const sectionAllowed=!!groupId&&ctx.responsibleGroupIds.includes(groupId);
  const manager=["main_admin","deputy","battalion_commander"].includes(ctx.profile.role);
  const areaRole=ctx.profile.role==="area_manager"||ctx.profile.role==="area_force";
  const areaAllowed=areaRole&&ctx.areaIds.includes(report.area_id);
  const own=report.creator_id===ctx.user.id;
  if(!manager&&!sectionAllowed&&!areaAllowed&&!own)
    return NextResponse.json({message:"شما به این گزارش دسترسی ندارید."},{status:403});

  const{data:files}=await admin.from("report_files").select("id,storage_bucket,storage_path,original_name,mime_type,size_bytes,created_at").eq("report_id",id).order("created_at");
  return NextResponse.json({report,files:files??[]});
}

function isTestReportTitle(title:string){
  return /(^|[\\sـ])(?:تست|آزمایشی|test)(?:$|[\\sـ])/i.test(title.trim());
}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(ctx.profile.role!=="main_admin")
    return NextResponse.json({message:"فقط مدیر اصلی اجازه حذف گزارش تست را دارد."},{status:403});

  const {id}=await params;
  const admin=db();
  const {data:report,error:readError}=await admin.from("reports")
    .select("id,title")
    .eq("id",id)
    .is("deleted_at",null)
    .maybeSingle();
  if(readError||!report)return NextResponse.json({message:"گزارش پیدا نشد یا قبلاً حذف شده است."},{status:404});
  if(!isTestReportTitle(report.title))
    return NextResponse.json({message:"حذف فقط برای گزارش‌هایی مجاز است که عنوان آن‌ها با «تست»، «آزمایشی» یا «test» مشخص شده باشد."},{status:400});

  const now=new Date().toISOString();
  const {error}=await admin.from("reports").update({deleted_at:now,updated_at:now}).eq("id",id).is("deleted_at",null);
  if(error)return NextResponse.json({message:"حذف گزارش انجام نشد."},{status:500});

  await admin.from("audit_logs").insert({
    user_id:ctx.user.id,
    action:"report.test_delete",
    entity_type:"report",
    entity_id:id,
    metadata:{title:report.title,soft_delete:true}
  });
  return NextResponse.json({ok:true,message:"گزارش تست از فهرست گزارش‌ها حذف شد."});
}
