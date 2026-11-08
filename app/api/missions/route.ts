import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";
import {sendTelegramAnnouncement} from "@/lib/telegram-notifications";

const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const leaders=["main_admin","deputy","battalion_commander"];
const canEnter=(ctx:any)=>leaders.includes(ctx.profile.role)||ctx.profile.role==="area_manager";
const isSenior=(ctx:any)=>["main_admin","deputy"].includes(ctx.profile.role);
const canManage=(ctx:any,groupId:string)=>isSenior(ctx)||(ctx.responsibleGroupIds??[]).includes(groupId);
const canEditMission=(ctx:any,groupId:string)=>canManage(ctx,groupId)||ctx.profile.role==="battalion_commander";
const canCreateMission=(ctx:any)=>isSenior(ctx)||ctx.profile.role==="battalion_commander"||(ctx.responsibleGroupIds??[]).length>0;

export async function GET(){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const admin=db(),isLeader=leaders.includes(ctx.profile.role),isSenior=["main_admin","deputy"].includes(ctx.profile.role),groupIds=ctx.responsibleGroupIds??[];
 let commanderAreaIds:string[]=[],commanderBattalionId:string|null=null;
 if(ctx.profile.role==="battalion_commander"){
  const {data:assignment}=await admin.from("battalion_commander_assignments").select("battalion_id").eq("user_id",ctx.user.id).maybeSingle();
  if(!assignment?.battalion_id)return NextResponse.json({message:"برای این فرمانده گردانی تعیین نشده است."},{status:403});
  commanderBattalionId=assignment.battalion_id;
  const {data:mapped}=await admin.from("battalion_areas").select("area_id").eq("battalion_id",assignment.battalion_id);
  commanderAreaIds=(mapped??[]).map((x:any)=>x.area_id);
  if(!commanderAreaIds.length)return NextResponse.json({message:"برای گردان شما حوزه‌ای ثبت نشده است."},{status:403});
 }
 let q=admin.from("missions").select("id,group_id,title,description,target_value,unit,is_active,created_at,deadline_at,category_groups(id,name,responsible_user_id)").order("created_at",{ascending:false});
 if(!isLeader&&groupIds.length)q=q.in("group_id",groupIds);
 else if(!isLeader&&!groupIds.length&&ctx.profile.role!=="area_manager")return NextResponse.json({message:"دسترسی به بخش جلسه ندارید."},{status:403});
 let {data:missions,error}=await q;
 if(error&&String(error.message??"").includes("deadline_at")){
  const fallback=await admin.from("missions").select("id,group_id,title,description,target_value,unit,is_active,created_at,category_groups(id,name,responsible_user_id)").order("created_at",{ascending:false});
  missions=(fallback.data??[]).map((m:any)=>({...m,deadline_at:null}));error=fallback.error;
 }
 if(error)return NextResponse.json({message:"دریافت مأموریت‌ها ناموفق بود: "+error.message},{status:500});
 const {data:allAreas}=await admin.from("areas").select("id,name,code").eq("is_active",true).order("code");
 const allowedAreaIds=ctx.profile.role==="battalion_commander"?commanderAreaIds:ctx.profile.role==="area_manager"?ctx.areaIds:null;
 const areaOrder=["urban-1","urban-2","urban-3","rural-1","rural-2","rural-3","rural-4","rural-5","special-zainab","special-fatemeh"];
 const areas=(allAreas??[]).filter((a:any)=>!allowedAreaIds||allowedAreaIds.includes(a.id)).sort((a:any,b:any)=>areaOrder.indexOf(a.code)-areaOrder.indexOf(b.code));
 const {data:scores}=await admin.from("mission_scores").select("id,mission_id,area_id,actual_value,notes,entered_by,updated_at,areas(name),profiles:profiles!mission_scores_entered_by_fkey(display_name)");
 const ids=new Set((missions??[]).map((m:any)=>m.id));
 const visibleScores=(scores??[]).filter((s:any)=>ids.has(s.mission_id)&&(!allowedAreaIds||allowedAreaIds.includes(s.area_id)));
 const {data:quotaRows, error:quotaError}=await admin.from("mission_area_quotas").select("mission_id,area_id,quota_value").in("mission_id",[...(ids)]);
 if(quotaError)return NextResponse.json({message:"دریافت سهمیه حوزه‌ها ناموفق بود."},{status:500});
 const visibleQuotas=(quotaRows??[]).filter((q:any)=>areas.some((a:any)=>a.id===q.area_id));
 const {data:battalionQuotas}=await admin.from("mission_battalion_quotas").select("mission_id,battalion_id,quota_value").in("mission_id",[...(ids)]);
 const visibleBattalionQuotas=(battalionQuotas??[]).filter((q:any)=>!commanderBattalionId||q.battalion_id===commanderBattalionId);
 return NextResponse.json({
  missions:missions??[],areas,scores:visibleScores,area_quotas:visibleQuotas,battalion_quotas:visibleBattalionQuotas,
  can_create:canCreateMission(ctx),can_delete:isSenior,can_enter:canEnter(ctx),is_leader:isLeader,role:ctx.profile.role,assigned_battalion_id:commanderBattalionId
 });
}

export async function POST(request:Request){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 if(!canCreateMission(ctx))return NextResponse.json({message:"اجازه تعریف مأموریت ندارید."},{status:403});
 const b=await request.json(),groupId=String(b.group_id??""),title=String(b.title??"").trim(),description=String(b.description??"").trim(),unit=String(b.unit??"عدد").trim()||"عدد",target=Number(b.target_value);
 const deadlineAt=b.deadline_at?new Date(b.deadline_at):null;
 if(!groupId||!title||!Number.isFinite(target)||target<=0)return NextResponse.json({message:"بخش، عنوان مأموریت و سهمیه معتبر الزامی است."},{status:400});
 if(b.deadline_at&&(!deadlineAt||Number.isNaN(deadlineAt.getTime())||deadlineAt.getTime()<=Date.now()))return NextResponse.json({message:"مهلت باید در آینده باشد."},{status:400});
 const admin=db(),{data:group}=await admin.from("category_groups").select("id,name").eq("id",groupId).eq("is_active",true).maybeSingle();
 if(!group)return NextResponse.json({message:"بخش انتخاب‌شده معتبر نیست."},{status:400});
 let commanderBattalionId:string|null=null;
 if(ctx.profile.role==="battalion_commander"){
  const {data:assignment}=await admin.from("battalion_commander_assignments").select("battalion_id").eq("user_id",ctx.user.id).maybeSingle();
  commanderBattalionId=assignment?.battalion_id??null;
  if(!commanderBattalionId)return NextResponse.json({message:"گردان این فرمانده مشخص نشده است؛ امکان ثبت مأموریت وجود ندارد."},{status:403});
 }
 if(!canManage(ctx,groupId)&&!commanderBattalionId)return NextResponse.json({message:"فقط مسئول همان بخش، فرمانده گردان یا مدیران ارشد می‌توانند مأموریت تعریف کنند."},{status:403});
 let {data,error}=await admin.from("missions").insert({group_id:groupId,title,description,target_value:target,unit,deadline_at:deadlineAt?.toISOString()??null,created_by:ctx.user.id}).select("id").single();
 if(error&&String(error.message??"").includes("deadline_at")){
  if(deadlineAt)return NextResponse.json({message:"برای ثبت مأموریت دارای مهلت، ابتدا ستون مهلت در پایگاه‌داده باید فعال شود. فعلاً مهلت را خالی بگذارید."},{status:503});
  const fallback=await admin.from("missions").insert({group_id:groupId,title,description,target_value:target,unit,created_by:ctx.user.id}).select("id").single();
  data=fallback.data;error=fallback.error;
 }
 if(error||!data)return NextResponse.json({message:"ثبت مأموریت انجام نشد: "+(error?.message??"پاسخ پایگاه‌داده خالی بود.")},{status:500});
 // The entered target is the same total quota for EACH battalion.
 // Split 100 as 12.5 across 8 brother areas and 50 across 2 sister areas.
 const {data:battalionRows}=await admin.from("battalion_areas").select("battalion_id,area_id");
 const battalionsToInitialize=commanderBattalionId?[commanderBattalionId]:["brothers","sisters"];
 for(const battalionId of battalionsToInitialize){
  const areaRows=(battalionRows??[]).filter((x:any)=>x.battalion_id===battalionId);
  const {error:quotaError}=await admin.from("mission_battalion_quotas").upsert({mission_id:data.id,battalion_id:battalionId,quota_value:target,updated_by:ctx.user.id},{onConflict:"mission_id,battalion_id"});
  if(quotaError)return NextResponse.json({message:"ثبت سهمیه کل گردان ناموفق بود: "+quotaError.message},{status:500});
  if(areaRows.length){
   const totalCents=Math.round(target*100),baseCents=Math.floor(totalCents/areaRows.length),extraCents=totalCents-baseCents*areaRows.length;
   const {error:areaQuotaError}=await admin.from("mission_area_quotas").upsert(areaRows.map((x:any,index:number)=>({mission_id:data.id,area_id:x.area_id,quota_value:(baseCents+(index<extraCents?1:0))/100,updated_by:ctx.user.id})),{onConflict:"mission_id,area_id"});
   if(areaQuotaError)return NextResponse.json({message:"تقسیم سهمیه بین حوزه‌ها ناموفق بود: "+areaQuotaError.message},{status:500});
  }
 }
 await admin.from("audit_logs").insert({user_id:ctx.user.id,action:"mission.create",entity_type:"mission",entity_id:data.id,metadata:{group_id:groupId,title,target_value:target,unit,deadline_at:deadlineAt?.toISOString()??null}});
 try{await sendTelegramAnnouncement("🎯 مأموریت جدید تعریف شد\nبخش: "+group.name+"\nعنوان: "+title+"\nسهمیه: "+target+" "+unit);}catch{}
 return NextResponse.json({id:data.id},{status:201});
}

export async function PATCH(request:Request){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const b=await request.json(),admin=db();
 if(b.action==="edit_mission"){
  const missionId=String(b.mission_id??""),title=String(b.title??"").trim(),description=String(b.description??"").trim(),unit=String(b.unit??"عدد").trim()||"عدد";
  const deadlineAt=b.deadline_at?new Date(b.deadline_at):null;
  if(!missionId||!title)return NextResponse.json({message:"عنوان مأموریت الزامی است."},{status:400});
  if(b.deadline_at&&(!deadlineAt||Number.isNaN(deadlineAt.getTime())))return NextResponse.json({message:"مهلت واردشده معتبر نیست."},{status:400});
  const {data:mission}=await admin.from("missions").select("id,group_id,title,target_value").eq("id",missionId).maybeSingle();
  if(!mission)return NextResponse.json({message:"مأموریت پیدا نشد."},{status:404});
  let commanderBattalionId:string|null=null;
  if(ctx.profile.role==="battalion_commander"){
   const {data:assignment}=await admin.from("battalion_commander_assignments").select("battalion_id").eq("user_id",ctx.user.id).maybeSingle();
   commanderBattalionId=assignment?.battalion_id??null;
   if(!commanderBattalionId)return NextResponse.json({message:"گردان این فرمانده مشخص نشده است."},{status:403});
  }
  if(!canEditMission(ctx,mission.group_id))return NextResponse.json({message:"اجازه ویرایش این مأموریت را ندارید."},{status:403});
  const targetValue=Number(b.target_value??mission.target_value);
  if(!Number.isFinite(targetValue)||targetValue<=0)return NextResponse.json({message:"سهمیه پایه مأموریت معتبر نیست."},{status:400});
  const battalionTarget=Number(b.battalion_target);
  if(commanderBattalionId&&(!Number.isFinite(battalionTarget)||battalionTarget<=0))return NextResponse.json({message:"سهمیه گردان شما باید عددی معتبر و بزرگ‌تر از صفر باشد."},{status:400});
  const brothersTarget=Number(b.brothers_target),sistersTarget=Number(b.sisters_target);
  if(isSenior(ctx)&&[brothersTarget,sistersTarget].some(v=>!Number.isFinite(v)||v<=0))return NextResponse.json({message:"سهمیه هر دو گردان باید عددی معتبر و بزرگ‌تر از صفر باشد."},{status:400});
  const update={title,description,target_value:targetValue,unit,deadline_at:deadlineAt?.toISOString()??null};
  let {error}=await admin.from("missions").update(update).eq("id",missionId);
  if(error&&String(error.message??"").includes("deadline_at")){
   const fallback=await admin.from("missions").update({title,description,target_value:targetValue,unit}).eq("id",missionId);error=fallback.error;
   if(!error&&b.deadline_at)return NextResponse.json({message:"ستون مهلت در پایگاه‌داده فعال نیست؛ سایر تغییرات ذخیره شد اما مهلت تغییر نکرد."},{status:200});
  }
  if(error)return NextResponse.json({message:"ویرایش مشخصات مأموریت ناموفق بود: "+error.message},{status:500});
  const {data:battalionRows}=await admin.from("battalion_areas").select("battalion_id,area_id");
  const quotaChanges:[string,number][]=isSenior(ctx)?[["brothers",brothersTarget],["sisters",sistersTarget]]:commanderBattalionId?[[commanderBattalionId,battalionTarget]]:[];
  for(const [battalionId,quotaTarget] of quotaChanges){
   const areaRows=(battalionRows??[]).filter((x:any)=>x.battalion_id===battalionId);
   const {error:batchError}=await admin.from("mission_battalion_quotas").upsert({mission_id:missionId,battalion_id:battalionId,quota_value:quotaTarget,updated_by:ctx.user.id},{onConflict:"mission_id,battalion_id"});
   if(batchError)return NextResponse.json({message:"ذخیره سهمیه گردان ناموفق بود: "+batchError.message},{status:500});
   if(areaRows.length){
    const totalCents=Math.round(quotaTarget*100),baseCents=Math.floor(totalCents/areaRows.length),extraCents=totalCents-baseCents*areaRows.length;
    const {error:areaError}=await admin.from("mission_area_quotas").upsert(areaRows.map((x:any,index:number)=>({mission_id:missionId,area_id:x.area_id,quota_value:(baseCents+(index<extraCents?1:0))/100,updated_by:ctx.user.id})),{onConflict:"mission_id,area_id"});
    if(areaError)return NextResponse.json({message:"به‌روزرسانی سهمیه حوزه‌ها ناموفق بود: "+areaError.message},{status:500});
   }
  }
  await admin.from("audit_logs").insert({user_id:ctx.user.id,action:"mission.update",entity_type:"mission",entity_id:missionId,metadata:{title,brothers_target:isSenior(ctx)?brothersTarget:undefined,sisters_target:isSenior(ctx)?sistersTarget:undefined,battalion_id:commanderBattalionId??undefined,battalion_target:commanderBattalionId?battalionTarget:undefined,unit,deadline_at:deadlineAt?.toISOString()??null}});
  return NextResponse.json({ok:true,message:isSenior(ctx)?"مشخصات مأموریت و سهمیه مستقل هر دو گردان ذخیره شد.":commanderBattalionId?"مشخصات مأموریت و سهمیه گردان شما ذخیره شد.":"مشخصات مأموریت ذخیره شد."});
 }
 if(!canEnter(ctx))return NextResponse.json({message:"دسترسی ثبت عملکرد ندارید."},{status:403});
 const missionId=String(b.mission_id??""),areaId=String(b.area_id??""),actual=Number(b.actual_value),notes=String(b.notes??"").trim();
 if(!missionId||!areaId||!Number.isFinite(actual)||actual<0)return NextResponse.json({message:"مأموریت، حوزه و عدد عملکرد معتبر الزامی است."},{status:400});
 if(ctx.profile.role==="area_manager"&&!ctx.areaIds.includes(areaId))return NextResponse.json({message:"فقط برای حوزه‌های تخصیص‌یافته می‌توانید عدد ثبت کنید."},{status:403});
 if(ctx.profile.role==="battalion_commander"){
  const {data:assignment}=await admin.from("battalion_commander_assignments").select("battalion_id").eq("user_id",ctx.user.id).maybeSingle();
  const {data:mapping}=assignment?.battalion_id?await admin.from("battalion_areas").select("area_id").eq("battalion_id",assignment.battalion_id).eq("area_id",areaId).maybeSingle():{data:null};
  if(!mapping)return NextResponse.json({message:"فرمانده فقط برای حوزه‌های گردان خودش می‌تواند نمره ثبت کند."},{status:403});
 }
 const {data:mission}=await admin.from("missions").select("id,group_id,title,target_value,deadline_at").eq("id",missionId).eq("is_active",true).maybeSingle();
 if(!mission)return NextResponse.json({message:"مأموریت فعال پیدا نشد."},{status:404});
 if(ctx.profile.role==="area_manager"&&mission.deadline_at&&new Date(mission.deadline_at).getTime()<=Date.now())return NextResponse.json({message:"مهلت ثبت این مأموریت به پایان رسیده است."},{status:403});
 const {data:area}=await admin.from("areas").select("id").eq("id",areaId).eq("is_active",true).maybeSingle();
 if(!area)return NextResponse.json({message:"حوزه معتبر نیست."},{status:400});
 const {data,error}=await admin.from("mission_scores").upsert({mission_id:missionId,area_id:areaId,actual_value:actual,notes,entered_by:ctx.user.id,updated_at:new Date().toISOString()},{onConflict:"mission_id,area_id"}).select("id").single();
 if(error)return NextResponse.json({message:"ثبت عملکرد انجام نشد."},{status:500});
 await admin.from("audit_logs").insert({user_id:ctx.user.id,action:"mission.score",entity_type:"mission",entity_id:missionId,metadata:{area_id:areaId,actual_value:actual,target_value:mission.target_value}});
 try{await sendTelegramAnnouncement("📊 عملکرد مأموریت ثبت شد\nمأموریت: "+mission.title+"\nمقدار ثبت‌شده: "+actual);}catch{}
 return NextResponse.json({ok:true,id:data.id});
}

export async function DELETE(request:Request){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const {mission_id}=await request.json(),id=String(mission_id??"");
 if(!id)return NextResponse.json({message:"شناسه مأموریت معتبر نیست."},{status:400});
 const admin=db(),{data:mission}=await admin.from("missions").select("id,group_id,title").eq("id",id).maybeSingle();
 if(!mission)return NextResponse.json({message:"مأموریت پیدا نشد."},{status:404});
 if(!canManage(ctx,mission.group_id))return NextResponse.json({message:"اجازه حذف این مأموریت را ندارید."},{status:403});
 const {error}=await admin.from("missions").delete().eq("id",id);
 if(error)return NextResponse.json({message:"حذف مأموریت انجام نشد."},{status:500});
 await admin.from("audit_logs").insert({user_id:ctx.user.id,action:"mission.delete",entity_type:"mission",entity_id:id,metadata:{title:mission.title,group_id:mission.group_id}});
 return NextResponse.json({ok:true});
}
