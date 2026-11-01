import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime = "nodejs";
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const sectionNames=["شمسا","متنا","مپتا","نسرا"];

async function reply(token:string,chatId:string,text:string,threadId?:number){
  await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({chat_id:chatId,...(threadId?{message_thread_id:threadId}:{}),text})
  });
}

export async function POST(request:Request){
  const expected=process.env.TELEGRAM_WEBHOOK_SECRET;
  const supplied=request.headers.get("x-telegram-bot-api-secret-token");
  if(!expected||!supplied||supplied!==expected)return NextResponse.json({ok:false},{status:401});
  let update:any;try{update=await request.json()}catch{return NextResponse.json({ok:false},{status:400})}
  const msg=update?.message??update?.channel_post;
  if(!msg?.chat?.id||!msg?.text)return NextResponse.json({ok:true});
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)return NextResponse.json({ok:true});
  const chatId=String(msg.chat.id);
  const threadId=Number(msg.message_thread_id)||undefined;
  const text=String(msg.text).trim();
  const match=text.match(/^\/bind(?:@\w+)?(?:\s+(.+))?$/i);
  if(!match)return NextResponse.json({ok:true});
  if(!["group","supergroup"].includes(String(msg.chat.type))){
    await reply(token,chatId,"برای اتصال، ربات را به گروه موضوع‌بندی‌شده اضافه کن و دستور را داخل همان گروه بفرست.");
    return NextResponse.json({ok:true});
  }
  const section=(match[1]||"").trim();
  if(!section){
    const {error}=await db().from("telegram_integration_settings").upsert({
      id:true,chat_id:chatId,updated_at:new Date().toISOString()
    },{onConflict:"id"});
    if(error){await reply(token,chatId,"ذخیره شناسه گروه انجام نشد؛ تنظیمات پایگاه داده را بررسی کنید.");return NextResponse.json({ok:true});}
    await reply(token,chatId,"✅ گروه سامانه راهبرد شوشتر ثبت شد. حالا در هر تاپیک، دستور /bind نام‌بخش را بفرست. نمونه: /bind شمسا");
    return NextResponse.json({ok:true});
  }
  if(!sectionNames.includes(section)){
    await reply(token,chatId,"نام بخش معتبر نیست. یکی از این نام‌ها را دقیقاً بفرست: "+sectionNames.join("، "),threadId);
    return NextResponse.json({ok:true});
  }
  if(!threadId){
    await reply(token,chatId,"این دستور را داخل خودِ تاپیک موردنظر بفرست تا شناسه موضوع ثبت شود.");
    return NextResponse.json({ok:true});
  }
  const {data:settings,error:readError}=await db().from("telegram_integration_settings").select("chat_id,topic_map").eq("id",true).maybeSingle();
  if(readError||!settings?.chat_id){
    await reply(token,chatId,"ابتدا در گفت‌وگوی عمومی گروه دستور /bind را بفرست تا گروه ثبت شود.",threadId);
    return NextResponse.json({ok:true});
  }
  if(String(settings.chat_id)!==chatId){
    await reply(token,chatId,"این گروه با گروه ثبت‌شده در سامانه متفاوت است. برای تغییر گروه، از تنظیمات تلگرام سامانه اقدام کنید.",threadId);
    return NextResponse.json({ok:true});
  }
  const topicMap={...(settings.topic_map||{}),[section]:String(threadId)};
  const {error}=await db().from("telegram_integration_settings").update({topic_map:topicMap,updated_at:new Date().toISOString()}).eq("id",true);
  if(error){await reply(token,chatId,"ذخیره شناسه تاپیک انجام نشد.",threadId);return NextResponse.json({ok:true});}
  await reply(token,chatId,"✅ تاپیک «"+section+"» برای ارسال گزارش‌ها ثبت شد.",threadId);
  return NextResponse.json({ok:true});
}
