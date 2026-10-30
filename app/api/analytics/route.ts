import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

export async function GET(){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let base=db.from("reports")
    .select("id,status,area_id,category_id,created_at,areas(name),categories(name)")
    .is("deleted_at",null);

  const privileged=["main_admin","deputy","battalion_commander"].includes(ctx.profile.role);
  if(!privileged&&(ctx.profile.role==="area_manager"||ctx.profile.role==="area_force")){
    base=base.in("area_id",ctx.areaIds.length?ctx.areaIds:["00000000-0000-0000-0000-000000000000"]);
  }
  if(!privileged&&ctx.responsibleGroupIds.length){
    const {data:categories,error:categoryError}=await db.from("categories")
      .select("id").in("group_id",ctx.responsibleGroupIds);
    if(categoryError)return NextResponse.json({message:"محدودیت دسترسی آمار اعمال نشد."},{status:500});
    const ids=(categories??[]).map((x:{id:string})=>x.id);
    base=base.in("category_id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]);
  }

  const {data,error}=await base.order("created_at",{ascending:true});
  if(error)return NextResponse.json({message:"خطا در تحلیل داده‌ها."},{status:500});
  const rows=data??[];
  const byArea:Record<string,number>={};
  const byStatus:Record<string,number>={pending:0,approved:0,rejected:0};
  for(const row of rows){
    byStatus[row.status]=(byStatus[row.status]??0)+1;
    const name=(row as any).areas?.name??"نامشخص";
    byArea[name]=(byArea[name]??0)+1;
  }
  const trend:Record<string,number>={};
  for(const row of rows){
    const day=row.created_at.slice(0,10);
    trend[day]=(trend[day]??0)+1;
  }
  return NextResponse.json({total:rows.length,byStatus,byArea,trend});
}
