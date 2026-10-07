import{NextResponse}from"next/server";
import{getCurrentContext}from"@/lib/auth";
import{createClient}from"@supabase/supabase-js";

const managers=["main_admin","deputy","battalion_commander"];
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const c=await getCurrentContext();
  if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(!managers.includes(c.profile.role))return NextResponse.json({message:"فقط مدیران سامانه می‌توانند مسئول بخش را تعیین کنند."},{status:403});
  const{id}=await params;
  const b=await req.json();
  const responsibleUserId=b.responsible_user_id?String(b.responsible_user_id):null;
  if(responsibleUserId){
    const{data:user}=await db().from("profiles").select("id,is_active").eq("id",responsibleUserId).maybeSingle();
    if(!user?.is_active)return NextResponse.json({message:"کاربر مسئول معتبر یا فعال نیست."},{status:400});
  }
  const{error}=await db().from("category_groups").update({responsible_user_id:responsibleUserId}).eq("id",id);
  if(error)return NextResponse.json({message:"تغییر مسئول بخش انجام نشد."},{status:500});
  await db().from("audit_logs").insert({user_id:c.user.id,action:"category_group.responsible.update",entity_type:"category_group",entity_id:id,metadata:{responsible_user_id:responsibleUserId}});
  return NextResponse.json({ok:true});
}