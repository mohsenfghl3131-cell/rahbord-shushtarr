import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

const allowed=["main_admin","deputy","battalion_commander"];
const defaults={title:"قدم‌های کوچک و پیوسته، مسیرهای بزرگ را می‌سازند.",body:"با دقت، همدلی و مسئولیت‌پذیری، هر روز می‌توانیم یک گام بهتر از دیروز باشیم."};
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const {data,error}=await db().from("site_settings").select("key,value").in("key",["daily_message_title","daily_message_body"]);
 if(error){console.error("daily message get",error);return NextResponse.json({message:"دریافت پیام انجام نشد."},{status:500});}
 const values=new Map((data??[]).map((x:any)=>[x.key,x.value]));
 return NextResponse.json({title:values.get("daily_message_title")??defaults.title,body:values.get("daily_message_body")??defaults.body,canEdit:allowed.includes(ctx.profile.role)});
}
export async function PATCH(request:Request){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 if(!allowed.includes(ctx.profile.role))return NextResponse.json({message:"فقط مدیران مجاز به تغییر پیام روز هستند."},{status:403});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({message:"اطلاعات ارسالی نامعتبر است."},{status:400})}
 const title=typeof body?.title==="string"?body.title.trim():"";
 const message=typeof body?.body==="string"?body.body.trim():"";
 if(!title||title.length>180||message.length>400)return NextResponse.json({message:"عنوان الزامی است و متن باید حداکثر ۴۰۰ نویسه باشد."},{status:400});
 const d=db();const timestamp=new Date().toISOString();
 for(const [key,value] of [["daily_message_title",title],["daily_message_body",message]] as const){
  const {error}=await d.from("site_settings").upsert({key,value,updated_by:ctx.user.id,updated_at:timestamp},{onConflict:"key"});
  if(error){console.error("daily message save",error);return NextResponse.json({message:"ذخیره پیام انجام نشد."},{status:500});}
 }
 await d.from("audit_logs").insert({user_id:ctx.user.id,action:"settings.update",entity_type:"daily_message",entity_id:null,metadata:{title,body:message}});
 return NextResponse.json({ok:true,title,body:message});
}
