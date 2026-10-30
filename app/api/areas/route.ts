import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

const managers=["main_admin","deputy","battalion_commander"];
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  const manager=managers.includes(ctx.profile.role);
  let query=db().from("areas").select("id,name,code,description,is_active,created_at,updated_at").order("name");
  if(!manager)query=query.eq("is_active",true).in("id",ctx.areaIds.length?ctx.areaIds:["00000000-0000-0000-0000-000000000000"]);
  const {data,error}=await query;
  if(error)return NextResponse.json({message:"خطا در دریافت حوزه‌ها."},{status:500});
  return NextResponse.json({areas:data??[],can_manage:manager});
}

export async function POST(request:Request){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(!managers.includes(ctx.profile.role))return NextResponse.json({message:"دسترسی مدیریت حوزه‌ها ندارید."},{status:403});
  let body:any;try{body=await request.json()}catch{return NextResponse.json({message:"اطلاعات ارسالی معتبر نیست."},{status:400})}
  const name=String(body.name??"").trim();
  const code=String(body.code??"").trim()||null;
  const description=String(body.description??"").trim()||null;
  if(!name)return NextResponse.json({message:"نام حوزه الزامی است."},{status:400});
  const {data,error}=await db().from("areas").insert({name,code,description,is_active:true}).select("id").single();
  if(error)return NextResponse.json({message:"ایجاد حوزه انجام نشد. نام یا کد را بررسی کنید."},{status:400});
  await db().from("audit_logs").insert({user_id:ctx.user.id,action:"area.create",entity_type:"area",entity_id:data.id,metadata:{name,code}});
  return NextResponse.json({id:data.id},{status:201});
}
