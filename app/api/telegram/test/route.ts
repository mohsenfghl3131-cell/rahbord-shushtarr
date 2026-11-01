import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";
export async function POST(){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 if(!["main_admin","deputy","battalion_commander"].includes(ctx.profile.role))return NextResponse.json({message:"دسترسی ندارید."},{status:403});
 const token=process.env.TELEGRAM_BOT_TOKEN;if(!token)return NextResponse.json({message:"توکن ربات در Cloudflare تنظیم نشده است."},{status:503});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
 const{data}=await db.from("telegram_integration_settings").select("chat_id").eq("id",true).maybeSingle();
 if(!data?.chat_id)return NextResponse.json({message:"ابتدا ربات را به گروه اضافه و شناسه گروه را ثبت کنید."},{status:400});
 const response=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:data.chat_id,text:"✅ اتصال سامانه راهبرد شوشتر به ربات تلگرام برقرار است."})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)return NextResponse.json({message:"ارسال آزمایشی ناموفق بود. دسترسی ارسال ربات و شناسه گروه را بررسی کنید."},{status:502});
 return NextResponse.json({ok:true,message:"پیام آزمایشی با موفقیت ارسال شد."});
}
