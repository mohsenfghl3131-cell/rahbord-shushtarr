import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{getCurrentContext}from"@/lib/auth";

const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const broadcastRoles=["main_admin","deputy","battalion_commander"];

export async function GET(){
 const c=await getCurrentContext();if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const admin=db();
 const{data,error}=await admin.from("messages").select("id,sender_id,recipient_id,parent_id,subject,body,read_at,created_at,sender:profiles!messages_sender_id_fkey(id,user_code,display_name,role),recipient:profiles!messages_recipient_id_fkey(id,user_code,display_name,role)").or("and(sender_id.eq."+c.user.id+",sender_deleted_at.is.null),and(recipient_id.eq."+c.user.id+",recipient_deleted_at.is.null)").order("created_at",{ascending:false}).limit(150);
 if(error)return NextResponse.json({message:"خطا در دریافت پیام‌ها."},{status:500});
 const isBroadcaster=broadcastRoles.includes(c.profile.role);
 const{data:groupRows}=await admin.from("category_groups").select("responsible_user_id").not("responsible_user_id","is",null);
 const targetIds=Array.from(new Set((groupRows??[]).map((g:any)=>g.responsible_user_id).filter(Boolean)));
 let recipientQuery=admin.from("profiles").select("id,user_code,display_name,role").eq("is_active",true).neq("id",c.user.id);
 if(!isBroadcaster){
  if(targetIds.length)recipientQuery=recipientQuery.or("role.in.(main_admin,deputy,battalion_commander,area_manager),id.in.("+targetIds.join(",")+")");
  else recipientQuery=recipientQuery.in("role",["main_admin","deputy","battalion_commander","area_manager"]);
 }
 const{data:recipients}=await recipientQuery.order("display_name");
 const messages=(data??[]).map((m:any)=>({...m,is_sender:m.sender_id===c.user.id}));
 return NextResponse.json({messages,recipients:recipients??[],can_write:true,can_broadcast:isBroadcaster});
}

export async function POST(req:Request){
 const c=await getCurrentContext();if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({message:"اطلاعات پیام معتبر نیست."},{status:400})}
 const recipientId=String(b.recipient_id??"");const subject=String(b.subject??"").trim();const body=String(b.body??"").trim();const parentId=b.parent_id?String(b.parent_id):null;
 if(!recipientId||!subject||!body)return NextResponse.json({message:"گیرنده، موضوع و متن پیام الزامی است."},{status:400});
 const admin=db();const isBroadcaster=broadcastRoles.includes(c.profile.role);
 if(recipientId==="all"){
  if(!isBroadcaster||parentId)return NextResponse.json({message:"ارسال همگانی فقط برای مدیر اصلی، معاون و فرمانده گردان فعال است."},{status:403});
  const{data:targets,error:targetError}=await admin.from("profiles").select("id").eq("is_active",true).neq("id",c.user.id);
  if(targetError)return NextResponse.json({message:"دریافت فهرست گیرندگان انجام نشد."},{status:500});
  if(!targets?.length)return NextResponse.json({message:"گیرنده فعالی برای ارسال وجود ندارد."},{status:400});
  const rows=targets.map((u:any)=>({sender_id:c.user.id,recipient_id:u.id,subject,body}));
  const{error}=await admin.from("messages").insert(rows);
  if(error)return NextResponse.json({message:"ارسال همگانی نامه انجام نشد."},{status:500});
  await admin.from("audit_logs").insert({user_id:c.user.id,action:"message.broadcast",entity_type:"message",metadata:{recipient_count:rows.length,subject}});
  return NextResponse.json({ok:true,count:rows.length},{status:201});
 }
 const{data:groupRows}=await admin.from("category_groups").select("responsible_user_id").not("responsible_user_id","is",null);
 const targetIds=(groupRows??[]).map((g:any)=>g.responsible_user_id).filter(Boolean);
 let allowedQuery=admin.from("profiles").select("id,is_active,role").eq("id",recipientId).eq("is_active",true);
 if(!isBroadcaster){
  if(targetIds.length)allowedQuery=allowedQuery.or("role.in.(main_admin,deputy,battalion_commander,area_manager),id.in.("+targetIds.join(",")+")");
  else allowedQuery=allowedQuery.in("role",["main_admin","deputy","battalion_commander","area_manager"]);
 }
 const{data:recipient}=await allowedQuery.maybeSingle();
 if(!recipient||recipientId===c.user.id)return NextResponse.json({message:"گیرنده انتخاب‌شده مجاز نیست."},{status:400});
 if(parentId){
  const{data:parent}=await admin.from("messages").select("id,sender_id,recipient_id").eq("id",parentId).maybeSingle();
  if(!parent||parent.recipient_id!==c.user.id||parent.sender_id!==recipientId)return NextResponse.json({message:"پاسخ باید به فرستنده همان نامه دریافتی ارسال شود."},{status:403});
 }
 const{data,error}=await admin.from("messages").insert({sender_id:c.user.id,recipient_id:recipientId,parent_id:parentId,subject,body}).select("id").single();
 if(error)return NextResponse.json({message:"ارسال پیام انجام نشد."},{status:500});
 await admin.from("audit_logs").insert({user_id:c.user.id,action:parentId?"message.reply":"message.create",entity_type:"message",entity_id:data.id,metadata:{recipient_id:recipientId,subject,parent_id:parentId}});
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