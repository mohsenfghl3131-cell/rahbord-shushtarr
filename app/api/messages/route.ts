import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{getCurrentContext}from"@/lib/auth";

const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const canWrite=(c:Awaited<ReturnType<typeof getCurrentContext>>)=>!!c&&(["main_admin","area_manager"].includes(c.profile.role)||c.responsibleGroupIds.length>0);

export async function GET(){
 const c=await getCurrentContext();if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const admin=db();
 const{data,error}=await admin.from("messages").select("id,sender_id,recipient_id,parent_id,subject,body,read_at,created_at,sender:profiles!messages_sender_id_fkey(id,user_code,display_name,role),recipient:profiles!messages_recipient_id_fkey(id,user_code,display_name,role)").or("sender_id.eq."+c.user.id+",recipient_id.eq."+c.user.id).order("created_at",{ascending:false}).limit(100);
 if(error)return NextResponse.json({message:"خطا در دریافت پیام‌ها."},{status:500});
 return NextResponse.json({messages:data??[],can_write:canWrite(c)});
}

export async function POST(req:Request){
 const c=await getCurrentContext();if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 if(!canWrite(c))return NextResponse.json({message:"فقط مسئول حوزه و مسئول بخش می‌توانند پیام ارسال کنند."},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({message:"اطلاعات پیام معتبر نیست."},{status:400})}
 const recipientId=String(b.recipient_id??"");const subject=String(b.subject??"").trim();const body=String(b.body??"").trim();const parentId=b.parent_id?String(b.parent_id):null;
 if(!recipientId||!subject||!body)return NextResponse.json({message:"گیرنده، موضوع و متن پیام الزامی است."},{status:400});
 const{data:recipient}=await db().from("profiles").select("id,is_active").eq("id",recipientId).maybeSingle();
 if(!recipient?.is_active)return NextResponse.json({message:"گیرنده انتخاب‌شده فعال نیست."},{status:400});
 const{data,error}=await db().from("messages").insert({sender_id:c.user.id,recipient_id:recipientId,parent_id:parentId,subject,body}).select("id").single();
 if(error)return NextResponse.json({message:"ارسال پیام انجام نشد."},{status:500});
 await db().from("audit_logs").insert({user_id:c.user.id,action:"message.create",entity_type:"message",entity_id:data.id,metadata:{recipient_id:recipientId,subject}});
 return NextResponse.json({id:data.id},{status:201});
}

export async function PATCH(req:Request){
 const c=await getCurrentContext();if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const b=await req.json();const id=String(b.id??"");if(!id)return NextResponse.json({message:"پیام نامعتبر است."},{status:400});
 const{data:message}=await db().from("messages").select("id,recipient_id").eq("id",id).maybeSingle();
 if(!message||message.recipient_id!==c.user.id)return NextResponse.json({message:"دسترسی به این پیام ندارید."},{status:403});
 const{error}=await db().from("messages").update({read_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
 if(error)return NextResponse.json({message:"وضعیت پیام تغییر نکرد."},{status:500});
 return NextResponse.json({ok:true});
}