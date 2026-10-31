import{NextResponse}from"next/server";
import{getCurrentContext}from"@/lib/auth";
import{createClient}from"@supabase/supabase-js";

const managers=["main_admin","deputy","battalion_commander"];
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const c=await getCurrentContext();
  if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(!managers.includes(c.profile.role))return NextResponse.json({message:"فقط مدیران سامانه می‌توانند مسئولان بخش را تعیین کنند."},{status:403});
  const{id}=await params;
  let b:any;try{b=await req.json()}catch{return NextResponse.json({message:"درخواست نامعتبر است."},{status:400})}
  const ids:string[]=Array.isArray(b.responsible_user_ids)
    ? Array.from(new Set(b.responsible_user_ids.filter((x:any)=>typeof x==="string"&&x.trim()).map((x:string)=>x.trim())))
    : b.responsible_user_id?[String(b.responsible_user_id)]:[];
  if(ids.length>20)return NextResponse.json({message:"برای هر بخش حداکثر ۲۰ مسئول می‌توان تعیین کرد."},{status:400});
  const admin=db();
  const {data:group}=await admin.from("category_groups").select("id").eq("id",id).maybeSingle();
  if(!group)return NextResponse.json({message:"بخش موردنظر پیدا نشد."},{status:404});
  if(ids.length){
    const{data:users,error}=await admin.from("profiles").select("id").in("id",ids).eq("is_active",true);
    if(error||(users??[]).length!==ids.length)return NextResponse.json({message:"یک یا چند کاربر انتخاب‌شده فعال یا معتبر نیستند."},{status:400});
  }
  const {data:previous}=await admin.from("category_group_responsibles").select("user_id").eq("group_id",id);
  const {error:deleteError}=await admin.from("category_group_responsibles").delete().eq("group_id",id);
  if(deleteError)return NextResponse.json({message:"حذف مسئولان قبلی انجام نشد؛ ابتدا به‌روزرسانی ساختار دسترسی را اجرا کنید."},{status:500});
  if(ids.length){
    const{error:insertError}=await admin.from("category_group_responsibles").insert(ids.map(user_id=>({group_id:id,user_id})));
    if(insertError){
      if(previous?.length)await admin.from("category_group_responsibles").insert(previous.map((x:any)=>({group_id:id,user_id:x.user_id})));
      return NextResponse.json({message:"ثبت مسئولان جدید انجام نشد."},{status:500});
    }
  }
  const {error:updateError}=await admin.from("category_groups").update({responsible_user_id:ids[0]??null}).eq("id",id);
  if(updateError)return NextResponse.json({message:"همگام‌سازی مسئول اصلی بخش انجام نشد."},{status:500});
  await admin.from("audit_logs").insert({user_id:c.user.id,action:"category_group.responsibles.update",entity_type:"category_group",entity_id:id,metadata:{responsible_user_ids:ids}});
  return NextResponse.json({ok:true,responsible_user_ids:ids});
}
