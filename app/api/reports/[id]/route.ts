import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{getCurrentContext}from"@/lib/auth";

const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const managerRoles=["main_admin","deputy","battalion_commander"];

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
  const manager=managerRoles.includes(ctx.profile.role);
  const areaRole=ctx.profile.role==="area_manager"||ctx.profile.role==="area_force";
  const areaAllowed=areaRole&&ctx.areaIds.includes(report.area_id);
  const own=report.creator_id===ctx.user.id;
  if(!manager&&!sectionAllowed&&!areaAllowed&&!own)
    return NextResponse.json({message:"شما به این گزارش دسترسی ندارید."},{status:403});
  const{data:files}=await admin.from("report_files").select("id,storage_bucket,storage_path,original_name,mime_type,size_bytes,created_at").eq("report_id",id).order("created_at");
  return NextResponse.json({report,files:files??[]});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(!managerRoles.includes(ctx.profile.role))return NextResponse.json({message:"فقط مدیر اصلی، معاون و فرمانده گردان اجازه ویرایش گزارش‌ها را دارند."},{status:403});
  const{id}=await params;
  let body:any;try{body=await request.json()}catch{return NextResponse.json({message:"اطلاعات ارسالی معتبر نیست."},{status:400})}
  const title=String(body.title??"").trim(),text=String(body.body??"").trim();
  if(!title||!text)return NextResponse.json({message:"عنوان و متن گزارش الزامی است."},{status:400});
  if(title.length>18000||text.length>100000)return NextResponse.json({message:"حجم متن گزارش بیش از حد مجاز است."},{status:400});
  const admin=db();
  const{data:existing}=await admin.from("reports").select("id,title,body").eq("id",id).is("deleted_at",null).maybeSingle();
  if(!existing)return NextResponse.json({message:"گزارش پیدا نشد یا حذف شده است."},{status:404});
  const now=new Date().toISOString();
  const{error}=await admin.from("reports").update({title,body:text,updated_at:now}).eq("id",id).is("deleted_at",null);
  if(error)return NextResponse.json({message:"ویرایش گزارش انجام نشد."},{status:500});
  await admin.from("audit_logs").insert({user_id:ctx.user.id,action:"report.update",entity_type:"report",entity_id:id,metadata:{previous_title:existing.title,title}});
  return NextResponse.json({ok:true,message:"گزارش با موفقیت ویرایش شد."});
}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(!managerRoles.includes(ctx.profile.role))return NextResponse.json({message:"فقط مدیر اصلی، معاون و فرمانده گردان اجازه حذف گزارش‌ها را دارند."},{status:403});
  const{id}=await params,admin=db();
  const{data:report}=await admin.from("reports").select("id,title").eq("id",id).is("deleted_at",null).maybeSingle();
  if(!report)return NextResponse.json({message:"گزارش پیدا نشد یا قبلاً حذف شده است."},{status:404});
  const now=new Date().toISOString();
  const{error}=await admin.from("reports").update({deleted_at:now,updated_at:now}).eq("id",id).is("deleted_at",null);
  if(error)return NextResponse.json({message:"حذف گزارش انجام نشد."},{status:500});
  await admin.from("audit_logs").insert({user_id:ctx.user.id,action:"report.delete",entity_type:"report",entity_id:id,metadata:{title:report.title,soft_delete:true}});
  return NextResponse.json({ok:true,message:"گزارش از فهرست حذف شد."});
}
