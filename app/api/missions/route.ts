import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const leaders=["main_admin","deputy","battalion_commander"];
const canEnter=(ctx:any)=>leaders.includes(ctx.profile.role)||ctx.profile.role==="area_manager";

export async function GET(){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const admin=db();
 const isLeader=leaders.includes(ctx.profile.role);
 const groupIds=ctx.responsibleGroupIds??[];
 let q=admin.from("missions").select("id,group_id,title,description,target_value,unit,is_active,created_at,category_groups(id,name,responsible_user_id)").order("created_at",{ascending:false});
 if(!isLeader&&groupIds.length)q=q.in("group_id",groupIds);
 else if(!isLeader&&!groupIds.length&&ctx.profile.role!=="area_manager")return NextResponse.json({message:"دسترسی به بخش نمره‌دهی ندارید."},{status:403});
 const {data:missions,error}=await q;
 if(error)return NextResponse.json({message:"دریافت مأموریت‌ها ناموفق بود."},{status:500});
 const {data:areas}=await admin.from("areas").select("id,name").eq("is_active",true).order("name");
 const {data:scores}=await admin.from("mission_scores").select("id,mission_id,area_id,actual_value,notes,entered_by,updated_at,areas(name),profiles:profiles!mission_scores_entered_by_fkey(display_name)");
 const missionIds=new Set((missions??[]).map((m:any)=>m.id));
 const visibleScores=(scores??[]).filter((s:any)=>missionIds.has(s.mission_id)&&(isLeader||ctx.profile.role!=="area_manager"||ctx.areaIds.includes(s.area_id)));
 return NextResponse.json({missions:missions??[],areas:(areas??[]).filter((a:any)=>isLeader||ctx.profile.role!=="area_manager"||ctx.areaIds.includes(a.id)),scores:visibleScores,can_create:groupIds.length>0||isLeader,can_enter:canEnter(ctx),is_leader:isLeader,role:ctx.profile.role});
}

export async function POST(request:Request){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const b=await request.json();
 const groupId=String(b.group_id??"");
 const title=String(b.title??"").trim();
 const description=String(b.description??"").trim();
 const unit=String(b.unit??"عدد").trim()||"عدد";
 const target=Number(b.target_value);
 if(!groupId||!title||!Number.isFinite(target)||target<=0)return NextResponse.json({message:"بخش، عنوان مأموریت و سهمیه معتبر الزامی است."},{status:400});
 const admin=db();
 const {data:group}=await admin.from("category_groups").select("id,name").eq("id",groupId).eq("is_active",true).maybeSingle();
 if(!group)return NextResponse.json({message:"بخش انتخاب‌شده معتبر نیست."},{status:400});
 if(!leaders.includes(ctx.profile.role)&&!ctx.responsibleGroupIds.includes(groupId))return NextResponse.json({message:"فقط مسئول همان بخش یا مدیران ارشد می‌توانند سهمیه تعیین کنند."},{status:403});
 const {data,error}=await admin.from("missions").insert({group_id:groupId,title,description,target_value:target,unit,created_by:ctx.user.id}).select("id").single();
 if(error)return NextResponse.json({message:"ثبت مأموریت انجام نشد."},{status:500});
 await admin.from("audit_logs").insert({user_id:ctx.user.id,action:"mission.create",entity_type:"mission",entity_id:data.id,metadata:{group_id:groupId,title,target_value:target,unit}});
 return NextResponse.json({id:data.id},{status:201});
}

export async function PATCH(request:Request){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 if(!canEnter(ctx))return NextResponse.json({message:"دسترسی ثبت عملکرد ندارید."},{status:403});
 const b=await request.json();
 const missionId=String(b.mission_id??"");
 const areaId=String(b.area_id??"");
 const actual=Number(b.actual_value);
 const notes=String(b.notes??"").trim();
 if(!missionId||!areaId||!Number.isFinite(actual)||actual<0)return NextResponse.json({message:"مأموریت، حوزه و عدد عملکرد معتبر الزامی است."},{status:400});
 if(ctx.profile.role==="area_manager"&&!ctx.areaIds.includes(areaId))return NextResponse.json({message:"فقط برای حوزه‌های تخصیص‌یافته می‌توانید عدد ثبت کنید."},{status:403});
 const admin=db();
 const {data:mission}=await admin.from("missions").select("id,group_id,title,target_value").eq("id",missionId).eq("is_active",true).maybeSingle();
 if(!mission)return NextResponse.json({message:"مأموریت فعال پیدا نشد."},{status:404});
 const {data:area}=await admin.from("areas").select("id").eq("id",areaId).eq("is_active",true).maybeSingle();
 if(!area)return NextResponse.json({message:"حوزه معتبر نیست."},{status:400});
 const {data,error}=await admin.from("mission_scores").upsert({mission_id:missionId,area_id:areaId,actual_value:actual,notes,entered_by:ctx.user.id,updated_at:new Date().toISOString()},{onConflict:"mission_id,area_id"}).select("id").single();
 if(error)return NextResponse.json({message:"ثبت عملکرد انجام نشد."},{status:500});
 await admin.from("audit_logs").insert({user_id:ctx.user.id,action:"mission.score",entity_type:"mission",entity_id:missionId,metadata:{area_id:areaId,actual_value:actual,target_value:mission.target_value}});
 return NextResponse.json({ok:true,id:data.id});
}
