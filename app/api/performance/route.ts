import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

const leaders=["main_admin","deputy","battalion_commander"];
const EMPTY="00000000-0000-0000-0000-000000000000";

export async function GET(){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
 const privileged=leaders.includes(ctx.profile.role);
 if(!privileged&&!["area_manager","area_force"].includes(ctx.profile.role))return NextResponse.json({message:"دسترسی مشاهده ارزیابی عملکرد ندارید."},{status:403});
 const {data:areas,error:areaError}=await db.from("areas").select("id,name").eq("is_active",true).order("name");
 if(areaError)return NextResponse.json({message:"دریافت حوزه‌ها ناموفق بود."},{status:500});
 const visibleAreas=(areas??[]).filter((a:any)=>privileged||(ctx.areaIds??[]).includes(a.id));
 const ids=visibleAreas.map((a:any)=>a.id);
 if(!ids.length)return NextResponse.json({rankings:[],missions:[],summary:{areas:0,missions:0,average:0}});
 const [{data:missions,error:missionError},{data:scores,error:scoreError},{data:reports,error:reportError}]=await Promise.all([
  db.from("missions").select("id,title,target_value,unit,group_id,is_active,category_groups(name)").eq("is_active",true).order("created_at",{ascending:false}),
  db.from("mission_scores").select("mission_id,area_id,actual_value,updated_at").in("area_id",ids),
  db.from("reports").select("area_id,status").in("area_id",ids).is("deleted_at",null)
 ]);
 if(missionError||scoreError||reportError)return NextResponse.json({message:"محاسبه رتبه‌بندی با خطا روبه‌رو شد."},{status:500});
 const activeMissions=missions??[],scoreRows=scores??[],reportRows=reports??[];
 const rankings=visibleAreas.map((area:any)=>{
  const own=scoreRows.filter((s:any)=>s.area_id===area.id);
  const missionResults=activeMissions.map((m:any)=>{
   const score=own.find((s:any)=>s.mission_id===m.id);
   const target=Number(m.target_value)||0,actual=Number(score?.actual_value)||0;
   return {id:m.id,title:m.title,unit:m.unit,target,actual,percent:target>0?Math.min(100,Math.round(actual/target*100)):0,submitted:Boolean(score)};
  });
  const missionAverage=missionResults.length?Math.round(missionResults.reduce((n:number,m:any)=>n+m.percent,0)/missionResults.length):0;
  const ownReports=reportRows.filter((r:any)=>r.area_id===area.id);
  const approved=ownReports.filter((r:any)=>r.status==="approved").length;
  const reviewed=ownReports.filter((r:any)=>r.status==="approved"||r.status==="rejected").length;
  const reviewQuality=reviewed?Math.round(approved/reviewed*100):0;
  const score=missionResults.length?Math.round(missionAverage*.8+reviewQuality*.2):reviewQuality;
  return {id:area.id,name:area.name,score,missionAverage,reviewQuality,missionsCompleted:missionResults.filter((m:any)=>m.submitted).length,missionCount:missionResults.length,reportCount:ownReports.length,approved,pending:ownReports.filter((r:any)=>r.status==="pending").length,rejected:ownReports.filter((r:any)=>r.status==="rejected").length,missionResults};
 }).sort((a:any,b:any)=>b.score-a.score||b.missionAverage-a.missionAverage||a.name.localeCompare(b.name));
 return NextResponse.json({rankings,missions:activeMissions.map((m:any)=>({id:m.id,title:m.title,target_value:m.target_value,unit:m.unit,group_name:m.category_groups?.name??"بخش"})),summary:{areas:rankings.length,missions:activeMissions.length,average:rankings.length?Math.round(rankings.reduce((n:number,a:any)=>n+a.score,0)/rankings.length):0},scoring:"میانگین تحقق مأموریت‌ها ۸۰٪ + کیفیت رسیدگی گزارش‌ها ۲۰٪؛ در نبود مأموریت فعال، فقط کیفیت رسیدگی گزارش‌ها محاسبه می‌شود."});
}
