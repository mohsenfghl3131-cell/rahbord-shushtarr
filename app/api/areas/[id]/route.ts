import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

const managers=["main_admin","deputy","battalion_commander"];
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(!managers.includes(ctx.profile.role))return NextResponse.json({message:"دسترسی مدیریت حوزه‌ها ندارید."},{status:403});
  const {id}=await params;
  let body:any;try{body=await request.json()}catch{return NextResponse.json({message:"درخواست نامعتبر است."},{status:400})}
  const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
  if(typeof body.name==="string"&&body.name.trim())patch.name=body.name.trim();
  if(typeof body.code==="string")patch.code=body.code.trim()||null;
  if(typeof body.description==="string")patch.description=body.description.trim()||null;
  if(typeof body.is_active==="boolean")patch.is_active=body.is_active;
  if(Object.keys(patch).length===1)return NextResponse.json({message:"تغییری برای ذخیره وجود ندارد."},{status:400});
  const {data,error}=await db().from("areas").update(patch).eq("id",id).select("id").maybeSingle();
  if(error)return NextResponse.json({message:"ویرایش حوزه انجام نشد."},{status:400});
  if(!data)return NextResponse.json({message:"حوزه پیدا نشد."},{status:404});
  await db().from("audit_logs").insert({user_id:ctx.user.id,action:"area.update",entity_type:"area",entity_id:id,metadata:patch});
  return NextResponse.json({ok:true});
}
