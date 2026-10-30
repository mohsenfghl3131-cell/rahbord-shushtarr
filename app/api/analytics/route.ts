import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

const EMPTY_ID="00000000-0000-0000-0000-000000000000";

export async function GET(request:Request){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);\n  const url=new URL(request.url);\n  const from=url.searchParams.get("from");\n  const to=url.searchParams.get("to");
  const privileged=["main_admin","deputy","battalion_commander"].includes(ctx.profile.role);
  let areaIds:string[]=[];
  let categoryIds:string[]=[];

  if(!privileged){
    areaIds=ctx.areaIds??[];
    if((ctx.responsibleGroupIds??[]).length){
      const {data:categories,error:categoryError}=await db.from("categories")
        .select("id").in("group_id",ctx.responsibleGroupIds);
      if(categoryError)return NextResponse.json({message:"محدودیت دسترسی آمار اعمال نشد."},{status:500});
      categoryIds=(categories??[]).map((x:{id:string})=>x.id);
    }
  }

  let base=db.from("reports")
    .select("id,status,area_id,category_id,created_at,areas(name),categories(name)")
    .is("deleted_at",null);\n\n  if(from && /^\\d{4}-\\d{2}-\\d{2}$/.test(from))base=base.gte("created_at",from+"T00:00:00.000Z");\n  if(to && /^\\d{4}-\\d{2}-\\d{2}$/.test(to))base=base.lt("created_at",new Date(new Date(to+"T00:00:00.000Z").getTime()+86400000).toISOString());

  if(!privileged){
    if(areaIds.length&&categoryIds.length){
      base=base.or(`area_id.in.(${areaIds.join(",")}),category_id.in.(${categoryIds.join(",")})`);
    }else if(areaIds.length){
      base=base.in("area_id",areaIds);
    }else if(categoryIds.length){
      base=base.in("category_id",categoryIds);
    }else{
      base=base.eq("area_id",EMPTY_ID);
    }
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
