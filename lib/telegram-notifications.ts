import {createClient} from "@supabase/supabase-js";

export async function sendTelegramAnnouncement(text:string){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)return false;
  const database=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const {data:settings}=await database.from("telegram_integration_settings")
    .select("chat_id,announcements_topic_id,announcements_enabled").eq("id",true).maybeSingle();
  if(!settings?.announcements_enabled||!settings.chat_id)return false;
  const threadId=Number(settings.announcements_topic_id)||undefined;
  const response=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({
      chat_id:settings.chat_id,
      ...(threadId?{message_thread_id:threadId}:{}),
      text:text+"\n\nسامانه راهبرد شوشتر",
      disable_web_page_preview:true
    })
  });
  const result=await response.json().catch(()=>({}));
  return !!(response.ok&&result.ok);
}
