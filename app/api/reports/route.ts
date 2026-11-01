import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext,canUseArea} from "@/lib/auth";
import {sendTelegramAnnouncement} from "@/lib/telegram-notifications";

function admin(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!)}

function scopeReports(query:any,ctx:Awaited<ReturnType<typeof getCurrentContext>>){
  if(!ctx)return query;
  if(ctx.profile.role==="area_manager"||ctx.profile.role==="area_force"){
    return query.in("area_id",ctx.areaIds.length?ctx.areaIds:["00000000-0000-0000-0000-000000000000"]);
  }
  if(ctx.responsibleGroupIds.length){
    return query.in("category_id",[]);
  }
  return query;
}

export async function GET(request:Request){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  const url=new URL(request.url);
  const q=url.searchParams.get("q")?.trim();
  const status=url.searchParams.get("status");
  const area=url.searchParams.get("area_id");
  const category=url.searchParams.get("category_id");
  const mine=url.searchParams.get("mine")==="1";

  const db=admin();
  const privileged=["main_admin","deputy","battalion_commander"].includes(ctx.profile.role);
  const sectionScoped=!privileged && ctx.responsibleGroupIds.length>0;
  let responsibleCategoryIds:string[]=[];
  if(sectionScoped){
    const {data:sectionCategories}=await db.from("categories").select("id").in("group_id",ctx.responsibleGroupIds).eq("is_active",true);
    responsibleCategoryIds=(sectionCategories??[]).map((x:{id:string})=>x.id);
  }
  let query=db.from("reports")
    .select("id,title,body,status,rejection_reason,created_at,area_id,category_id,creator_id,areas(name),categories(name,group_id,category_groups(id,name,responsible_user_id))")
    .is("deleted_at",null)
    .order("created_at",{ascending:false})
    .limit(100);

  if(mine)query=query.eq("creator_id",ctx.user.id);
  if(q)query=query.or("title.ilike.%"+q+"%,body.ilike.%"+q+"%");
  if(status)query=query.eq("status",status);
  if(category)query=query.eq("category_id",category);
  if(sectionScoped && category && !responsibleCategoryIds.includes(category)) return NextResponse.json({message:"دسترسی به گزارش این بخش مجاز نیست."},{status:403});

  if(!privileged && !mine){
    if(area){
      if(sectionScoped && !responsibleCategoryIds.length) return NextResponse.json({reports:[]});
      if((ctx.profile.role==="area_manager"||ctx.profile.role==="area_force") && !canUseArea(ctx,area)){
        return NextResponse.json({message:"دسترسی به این حوزه مجاز نیست."},{status:403});
      }
      query=query.eq("area_id",area);
      if(sectionScoped) query=query.in("category_id",responsibleCategoryIds.length ? responsibleCategoryIds : ["00000000-0000-0000-0000-000000000000"]);
    }else{
      const areaScoped=ctx.profile.role==="area_manager"||ctx.profile.role==="area_force";
      const hasAreas=areaScoped && ctx.areaIds.length>0;
      const hasGroups=sectionScoped && responsibleCategoryIds.length>0;
      if(hasAreas && hasGroups){
        query=query.or(`area_id.in.(${ctx.areaIds.join(",")}),category_id.in.(${responsibleCategoryIds.join(",")})`);
      }else if(hasAreas){
        query=query.in("area_id",ctx.areaIds);
      }else if(hasGroups){
        query=query.in("category_id",responsibleCategoryIds);
      }else{
        query=query.eq("creator_id",ctx.user.id);
      }
    }
  }

  const {data,error}=await query;
  if(error)return NextResponse.json({message:"خطا در دریافت گزارش‌ها."},{status:500});

  return NextResponse.json({reports:data??[]});
}

export async function POST(request:Request){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  const body=await request.json();
  const title=String(body.title??"").trim();
  const text=String(body.body??"").trim();
  const areaId=String(body.area_id??"");
  const categoryId=String(body.category_id??"");
  if(!title||!text||!areaId||!categoryId)return NextResponse.json({message:"عنوان، متن، حوزه و دسته‌بندی الزامی است."},{status:400});
  if(!canUseArea(ctx,areaId))return NextResponse.json({message:"شما به این حوزه دسترسی ندارید."},{status:403});
  const db=admin();
  const {data:category}=await db.from("categories").select("id,name,group_id,category_groups!inner(id,name,is_active)").eq("id",categoryId).eq("is_active",true).maybeSingle();
  if(!category)return NextResponse.json({message:"دسته‌بندی معتبر نیست."},{status:400});
  if(ctx.responsibleGroupIds.length>0 && !["main_admin","deputy","battalion_commander"].includes(ctx.profile.role) && !ctx.responsibleGroupIds.includes(category.group_id)){
    return NextResponse.json({message:"شما فقط مجاز به ثبت گزارش در بخش مسئولیت خود هستید."},{status:403});
  }
  const {data,error}=await db.from("reports").insert({title,body:text,area_id:areaId,category_id:categoryId,creator_id:ctx.user.id,status:"pending"}).select("id").single();
  if(error||!data)return NextResponse.json({message:"ثبت گزارش انجام نشد."},{status:500});
  await db.from("audit_logs").insert({user_id:ctx.user.id,action:"report.create",entity_type:"report",entity_id:data.id,metadata:{area_id:areaId,category_id:categoryId}});
  let telegramSent=false;
  let telegramReason="not_configured";
  try{
    const {data:settings}=await db.from("telegram_integration_settings")
      .select("chat_id,topic_map,reports_enabled").eq("id",true).maybeSingle();
    if(!settings?.reports_enabled) telegramReason="reports_disabled";
    else if(!settings.chat_id) telegramReason="group_not_configured";
    else {
      const group:any=Array.isArray((category as any).category_groups)?(category as any).category_groups[0]:(category as any).category_groups;
      const sectionName=String(group?.name||"");
      const threadId=Number(settings.topic_map?.[sectionName]);
      if(!threadId) telegramReason="topic_not_bound";
      else {
        const {data:area}=await db.from("areas").select("name").eq("id",areaId).maybeSingle();
        const message=[
          "🆕 گزارش جدید ثبت شد",
          "🏷 بخش: "+(sectionName||"نامشخص"),
          "📂 موضوع: "+String((category as any).name||"نامشخص"),
          "📍 حوزه: "+String(area?.name||"نامشخص"),
          "📝 عنوان: "+title,
          "",
          text.length>3200?text.slice(0,3200)+"…":text,
          "",
          "وضعیت: در انتظار بررسی",
          "سامانه راهبرد شوشتر"
        ].join("\n");
        const response=await fetch("https://api.telegram.org/bot"+process.env.TELEGRAM_BOT_TOKEN+"/sendMessage",{
          method:"POST",headers:{"content-type":"application/json"},
          body:JSON.stringify({chat_id:settings.chat_id,message_thread_id:threadId,text:message,disable_web_page_preview:true})
        });
        const result=await response.json().catch(()=>({}));
        telegramSent=!!(response.ok&&result.ok);
        telegramReason=telegramSent?"sent":"telegram_api_error";
      }
    }
  }catch{telegramReason="telegram_send_failed";}
  return NextResponse.json({id:data.id,telegram_sent:telegramSent,telegram_reason:telegramReason},{status:201});
}