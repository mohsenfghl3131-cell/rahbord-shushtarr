import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

const reviewRoles=["main_admin","deputy","battalion_commander","area_manager"];
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function sendApprovedReport(database:ReturnType<typeof db>,reportId:string){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)return {sent:false,reason:"bot_not_configured"};
  const {data:settings}=await database.from("telegram_integration_settings")
    .select("chat_id,topic_map,reports_enabled").eq("id",true).maybeSingle();
  if(!settings?.reports_enabled||!settings.chat_id)return {sent:false,reason:"telegram_reports_disabled"};
  const {data:report}=await database.from("reports")
    .select("id,title,body,created_at,areas(name),categories(name,category_groups(name))")
    .eq("id",reportId).maybeSingle();
  if(!report)return {sent:false,reason:"report_not_found"};
  const category:any=Array.isArray((report as any).categories)?(report as any).categories[0]:(report as any).categories;
  const group:any=Array.isArray(category?.category_groups)?category.category_groups[0]:category?.category_groups;
  const area:any=Array.isArray((report as any).areas)?(report as any).areas[0]:(report as any).areas;
  const sectionName=String(group?.name||"");
  const threadId=Number(settings.topic_map?.[sectionName])||undefined;
  const title=String((report as any).title||"گزارش");
  const body=String((report as any).body||"");
  const message=[
    "✅ گزارش تأیید شد",
    "🏷 بخش: "+(sectionName||"نامشخص"),
    "📂 موضوع: "+String(category?.name||"نامشخص"),
    "📍 حوزه: "+String(area?.name||"نامشخص"),
    "📝 عنوان: "+title,
    "",
    body.length>3200?body.slice(0,3200)+"…":body,
    "",
    "سامانه راهبرد شوشتر"
  ].join("\n");
  const response=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({chat_id:settings.chat_id,...(threadId?{message_thread_id:threadId}:{}),text:message,disable_web_page_preview:true})
  });
  const result=await response.json().catch(()=>({}));
  return response.ok&&result.ok?{sent:true}:{sent:false,reason:"telegram_send_failed"};
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(!reviewRoles.includes(ctx.profile.role)&&ctx.responsibleGroupIds.length===0)
    return NextResponse.json({message:"شما مجاز به بررسی گزارش نیستید."},{status:403});

  const {id}=await params;
  const body=await request.json();
  const status=body.status==="approved"||body.status==="rejected"?body.status:null;
  const reason=String(body.rejection_reason??"").trim();
  if(!status)return NextResponse.json({message:"وضعیت بررسی نامعتبر است."},{status:400});
  if(status==="rejected"&&!reason)return NextResponse.json({message:"برای رد گزارش، درج دلیل الزامی است."},{status:400});

  const database=db();
  const {data:report}=await database.from("reports")
    .select("id,area_id,status,category_id,categories(group_id,category_groups(id,responsible_user_id))")
    .eq("id",id).is("deleted_at",null).maybeSingle();
  if(!report)return NextResponse.json({message:"گزارش پیدا نشد."},{status:404});

  const role=ctx.profile.role;
  const privileged=["main_admin","deputy","battalion_commander"].includes(role);
  const sectionId=(report as any).categories?.category_groups?.id;
  const sectionAllowed=!!sectionId&&ctx.responsibleGroupIds.includes(sectionId);
  const areaAllowed=role==="area_manager"&&ctx.areaIds.includes(report.area_id);
  if(!privileged&&!sectionAllowed&&!areaAllowed)
    return NextResponse.json({message:"این گزارش خارج از حوزه یا بخش مسئولیت شماست."},{status:403});

  if(report.status!=="pending")
    return NextResponse.json({message:"این گزارش قبلاً بررسی شده است."},{status:409});

  const {data:updated,error}=await database.from("reports").update({
    status,
    rejection_reason:status==="rejected"?reason:null,
    reviewer_id:ctx.user.id,
    reviewed_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq("id",id).eq("status","pending").select("id").maybeSingle();
  if(error)return NextResponse.json({message:"تغییر وضعیت گزارش انجام نشد."},{status:500});
  if(!updated)return NextResponse.json({message:"این گزارش هم‌زمان توسط کاربر دیگری بررسی شده است."},{status:409});

  await database.from("audit_logs").insert({
    user_id:ctx.user.id,
    action:"report."+status,
    entity_type:"report",
    entity_id:id,
    metadata:{reason:status==="rejected"?reason:null}
  });

  let telegram:{sent:boolean;reason?:string}|undefined;
  if(status==="approved"){
    try{telegram=await sendApprovedReport(database,id);}
    catch{telegram={sent:false,reason:"telegram_send_failed"};}
  }
  return NextResponse.json({ok:true,status,telegram_sent:telegram?.sent??false});
}
