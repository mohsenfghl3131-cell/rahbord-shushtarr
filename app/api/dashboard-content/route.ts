import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{getCurrentContext}from"@/lib/auth";
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
export async function GET(){
 const c=await getCurrentContext();if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const{data,error}=await db().from("site_settings").select("key,value,updated_at").eq("key","dashboard_quran").maybeSingle();
 if(error)return NextResponse.json({message:"خطا در دریافت متن داشبورد."},{status:500});
 return NextResponse.json({content:data?.value??{ayah:"",text:"",reference:""},can_edit:c.profile.role==="main_admin"});
}
export async function PATCH(req:Request){
 const c=await getCurrentContext();if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 if(c.profile.role!=="main_admin")return NextResponse.json({message:"فقط مدیر اصلی می‌تواند متن داشبورد را تغییر دهد."},{status:403});
 const b=await req.json();const ayah=String(b.ayah??"").trim(),text=String(b.text??"").trim(),reference=String(b.reference??"").trim();
 if(!ayah||!text||!reference)return NextResponse.json({message:"آیه، ترجمه/متن و مرجع الزامی است."},{status:400});
 const{error}=await db().from("site_settings").upsert({key:"dashboard_quran",value:{ayah,text,reference},updated_by:c.user.id,updated_at:new Date().toISOString()},{onConflict:"key"});
 if(error)return NextResponse.json({message:"بروزرسانی متن انجام نشد."},{status:500});
 await db().from("audit_logs").insert({user_id:c.user.id,action:"settings.update",entity_type:"site_settings",entity_id:null,metadata:{key:"dashboard_quran"}});
 return NextResponse.json({ok:true});
}