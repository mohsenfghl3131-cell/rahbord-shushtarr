import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext,canUseArea} from "@/lib/auth";

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
  let query=db.from("reports")
    .select("id,title,body,status,rejection_reason,created_at,area_id,category_id,creator_id,areas(name),categories(name,group_id,category_groups(id,name,responsible_user_id))")
    .is("deleted_at",null)
    .order("created_at",{ascending:false})
    .limit(100);

  if(mine)query=query.eq("creator_id",ctx.user.id);
  if(q)query=query.or("title.ilike.%"+q+"%,body.ilike.%"+q+"%");
  if(status)query=query.eq("status",status);
  if(category)query=query.eq("category_id",category);
  const sectionScoped=ctx.responsibleGroupIds.length>0 && !["main_admin","deputy","battalion_commander"].includes(ctx.profile.role);
  if(area){
    if(!sectionScoped && !canUseArea(ctx,area) && ctx.profile.role!=="main_admin"&&ctx.profile.role!=="deputy"&&ctx.profile.role!=="battalion_commander")
      return NextResponse.json({message:"دسترسی به این حوزه مجاز نیست."},{status:403});
    query=query.eq("area_id",area);
  }else if(!sectionScoped && (ctx.profile.role==="area_manager"||ctx.profile.role==="area_force")){
    query=query.in("area_id",ctx.areaIds.length?ctx.areaIds:["00000000-0000-0000-0000-000000000000"]);
  }

  const {data,error}=await query;
  if(error)return NextResponse.json({message:"خطا در دریافت گزارش‌ها."},{status:500});

  let reports=data??[];
  if(ctx.responsibleGroupIds.length && !["main_admin","deputy","battalion_commander"].includes(ctx.profile.role)){
    reports=reports.filter((r:any)=>ctx.responsibleGroupIds.includes(r.categories?.category_groups?.id));
  }

  return NextResponse.json({reports});
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
  const {data:category}=await db.from("categories").select("id,group_id,category_groups!inner(id,is_active)").eq("id",categoryId).eq("is_active",true).maybeSingle();
  if(!category)return NextResponse.json({message:"دسته‌بندی معتبر نیست."},{status:400});
  const {data,error}=await db.from("reports").insert({title,body:text,area_id:areaId,category_id:categoryId,creator_id:ctx.user.id,status:"pending"}).select("id").single();
  if(error||!data)return NextResponse.json({message:"ثبت گزارش انجام نشد."},{status:500});
  await db.from("audit_logs").insert({user_id:ctx.user.id,action:"report.create",entity_type:"report",entity_id:data.id,metadata:{area_id:areaId,category_id:categoryId}});
  return NextResponse.json({id:data.id},{status:201});
}