import {NextResponse} from "next/server";
import {getCurrentContext} from "@/lib/auth";

export async function POST(){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 if(!["main_admin","deputy"].includes(ctx.profile.role))return NextResponse.json({message:"فقط ادمین اصلی یا معاون دسترسی دارد."},{status:403});
 const token=process.env.TELEGRAM_BOT_TOKEN;
 const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
 if(!token||!secret)return NextResponse.json({message:"توکن یا Secret وب‌هوک در Cloudflare تنظیم نشده است."},{status:503});
 if(!/^[A-Za-z0-9_-]{1,256}$/.test(secret))return NextResponse.json({message:"Secret وب‌هوک باید فقط شامل حروف، عدد، خط تیره یا زیرخط باشد."},{status:400});
 const url="https://rahbar-shushtar.pages.dev/api/telegram/webhook";
 const response=await fetch("https://api.telegram.org/bot"+token+"/setWebhook",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({url,secret_token:secret,allowed_updates:["message","channel_post"],drop_pending_updates:false})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)return NextResponse.json({message:"ثبت وب‌هوک در تلگرام ناموفق بود. تنظیمات ربات را بررسی کنید."},{status:502});
 return NextResponse.json({ok:true,message:"وب‌هوک ربات با موفقیت ثبت شد.",url});
}
