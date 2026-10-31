import{NextResponse}from"next/server";
import{createClient}from"@supabase/supabase-js";
import{getCurrentContext}from"@/lib/auth";

const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const{id}=await params,admin=db();
 const{data:message,error:readError}=await admin.from("messages").select("id,sender_id,recipient_id,subject").eq("id",id).maybeSingle();
 if(readError||!message)return NextResponse.json({message:"نامه پیدا نشد."},{status:404});
 const isSender=message.sender_id===ctx.user.id,isRecipient=message.recipient_id===ctx.user.id;
 if(!isSender&&!isRecipient)return NextResponse.json({message:"فقط می‌توانید نامه‌های صندوق خودتان را حذف کنید."},{status:403});
 const column=isSender?"sender_deleted_at":"recipient_deleted_at";
 const patch:any={[column]:new Date().toISOString(),updated_at:new Date().toISOString()};
 const{error}=await admin.from("messages").update(patch).eq("id",id);
 if(error)return NextResponse.json({message:"حذف نامه انجام نشد."},{status:500});
 await admin.from("audit_logs").insert({user_id:ctx.user.id,action:"message.delete",entity_type:"message",entity_id:id,metadata:{subject:message.subject,mailbox:isSender?"sent":"inbox",soft_delete:true}});
 return NextResponse.json({ok:true,message:"نامه از صندوق شما حذف شد."});
}
