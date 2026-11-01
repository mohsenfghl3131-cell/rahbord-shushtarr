import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime = "edge";
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(request:Request){
  const expected=process.env.TELEGRAM_WEBHOOK_SECRET;
  const supplied=request.headers.get("x-telegram-bot-api-secret-token");
  if(!expected||!supplied||supplied!==expected)return NextResponse.json({ok:false},{status:401});
  let update:any;try{update=await request.json()}catch{return NextResponse.json({ok:false},{status:400})}
  const msg=update?.message??update?.channel_post;
  if(msg?.chat?.id!==undefined){
    const text=String(msg.text??"");
    const match=text.match(/^\/bind(?:@\w+)?\s*$/i);
    if(match){
      const chatId=String(msg.chat.id),topicId=msg.message_thread_id?String(msg.message_thread_id):"";
      await db().from("telegram_integration_settings").upsert({
        id:true,chat_id:chatId,updated_at:new Date().toISOString()
      },{onConflict:"id"});
      const token=process.env.TELEGRAM_BOT_TOKEN;
      if(token)await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({chat_id:chatId,message_thread_id:msg.message_thread_id,text:"اتصال گروه ثبت شد. شناسه موضوع: "+(topicId||"موضوع عمومی")})
      });
    }
  }
  return NextResponse.json({ok:true});
}
