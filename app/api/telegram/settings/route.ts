import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const roles=["main_admin","deputy","battalion_commander"];
export async function GET(){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 if(!roles.includes(ctx.profile.role))return NextResponse.json({message:"دسترسی ندارید."},{status:403});
 const{data,error}=await db().from("telegram_integration_settings").select("chat_id,topic_map,letters_topic_id,announcements_topic_id,reports_enabled,letters_enabled,announcements_enabled").eq("id",true).maybeSingle();
 if(error&&error.code!=="PGRST116")return NextResponse.json({message:"جدول تنظیمات تلگرام هنوز ایجاد نشده است؛ ابتدا Migration را اجرا کنید."},{status:503});
 return NextResponse.json({settings:data??{chat_id:"",topic_map:{},letters_topic_id:"",announcements_topic_id:"",reports_enabled:true,letters_enabled:false,announcements_enabled:false},bot_configured:!!process.env.TELEGRAM_BOT_TOKEN});
}
export async function PATCH(req:Request){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 if(!roles.includes(ctx.profile.role))return NextResponse.json({message:"دسترسی ندارید."},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({message:"داده نامعتبر است."},{status:400})}
 const chat=String(b.chat_id??"").trim(),map=b.topic_map&&typeof b.topic_map==="object"&&!Array.isArray(b.topic_map)?b.topic_map:{};
 const clean:Record<string,string>={};for(const [k,v] of Object.entries(map)){if(!/^[a-zA-Z0-9_-]{1,80}$/.test(k)||!/^\d{1,30}$/.test(String(v)))return NextResponse.json({message:"شناسه موضوع نامعتبر است."},{status:400});clean[k]=String(v)}
 const letters=String(b.letters_topic_id??"").trim(),ann=String(b.announcements_topic_id??"").trim();
 for(const v of [letters,ann])if(v&&!/^\d{1,30}$/.test(v))return NextResponse.json({message:"شناسه موضوع نامه یا اعلان نامعتبر است."},{status:400});
 if(chat&&!/^-?\d{1,30}$/.test(chat))return NextResponse.json({message:"شناسه گروه نامعتبر است."},{status:400});
 const payload={id:true,chat_id:chat||null,topic_map:clean,letters_topic_id:letters||null,announcements_topic_id:ann||null,reports_enabled:true,letters_enabled:!!b.letters_enabled,announcements_enabled:!!b.announcements_enabled,updated_at:new Date().toISOString(),updated_by:ctx.user.id};
 const{error}=await db().from("telegram_integration_settings").upsert(payload,{onConflict:"id"});
 if(error)return NextResponse.json({message:"ذخیره تنظیمات تلگرام انجام نشد."},{status:500});
 return NextResponse.json({ok:true});
}
