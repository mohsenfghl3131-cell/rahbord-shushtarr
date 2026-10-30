import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const areaNames=["حوزه یک شهری محمد رسول الله (ص)","حوزه دو شهری امام حسین (ع)","حوزه سه شهری امام رضا (ع)","حوزه یک روستایی امام باقر (ع)","حوزه دو روستایی امام سجاد (ع)","حوزه سه روستایی علی بن ابی طالب (ع)","حوزه چهار روستایی امام جعفر صادق (ع)","حوزه پنج روستایی امام موسی کاظم (ع)","حوزه حضرت زینب (س)","حوزه حضرت فاطمه (س)"];
const empty=()=>({version:3,deputy_title:"معاونت",deputy_name:"",successor_title:"جانشین معاونت",successor_name:"",commanders:[{id:"c1",title:"فرمانده گردان ۱",name:"",sections:["شمسا","متنا","مپتا","نسرا"].map((title,i)=>({id:"s"+i,title,name:""}))},{id:"c2",title:"فرمانده گردان ۲",name:"",sections:["شمسا","متنا","مپتا","نسرا"].map((title,i)=>({id:"t"+i,title,name:""}))}],areas:areaNames.map((title,i)=>({id:"a"+i,title,leader_name:"",bases:[]}))});
export async function GET(){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"ابتدا وارد سامانه شوید."},{status:401});
 const {data:setting,error}=await db().from("site_settings").select("value").eq("key","organization_chart").maybeSingle();
 if(error)return NextResponse.json({message:"دریافت چارت انجام نشد."},{status:500});
 let chart=setting?.value;if(!chart||chart.version!==2&&chart.version!==3)chart=empty();
 if(!Array.isArray(chart.areas))chart={...chart,version:3,areas:areaNames.map((title,i)=>({id:"a"+i,title,leader_name:"",bases:[]}))};
 chart={...chart,version:3,areas:chart.areas.map((a:any)=>({...a,leader_name:typeof a.leader_name==="string"?a.leader_name:"",bases:(Array.isArray(a.bases)?a.bases:[]).map((v:any)=>({...v,leader_name:typeof v.leader_name==="string"?v.leader_name:""}))}))};
 return NextResponse.json({chart,can_edit:ctx.profile.role==="main_admin"});
}
export async function PATCH(req:Request){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"ابتدا وارد سامانه شوید."},{status:401});
 if(ctx.profile.role!=="main_admin")return NextResponse.json({message:"فقط مدیر اصلی می‌تواند چارت را تغییر دهد."},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({message:"اطلاعات نامعتبر است."},{status:400})}
 const c=b?.chart;const validText=(v:any)=>typeof v==="string"&&v.length<=100;
 const validSections=(x:any)=>Array.isArray(x.sections)&&x.sections.length<=30&&x.sections.every((s:any)=>validText(s.title)&&validText(s.name));
 if(!c||!Array.isArray(c.commanders)||c.commanders.length<1||c.commanders.length>12||!Array.isArray(c.areas)||c.areas.length>30||!validText(c.deputy_title)||!validText(c.deputy_name)||!validText(c.successor_title)||!validText(c.successor_name)||c.commanders.some((x:any)=>!validText(x.title)||!validText(x.name)||!validSections(x))||c.areas.some((a:any)=>!validText(a.title)||!Array.isArray(a.bases)||a.bases.length>100||a.bases.some((v:any)=>!validText(v.title)||!validText(v.leader_name))||!validText(a.leader_name)))return NextResponse.json({message:"اطلاعات چارت معتبر نیست. حداکثر ۱۲ گردان، ۳۰ حوزه و ۱۰۰ پایگاه برای هر حوزه مجاز است."},{status:400});
 const clean={version:3,deputy_title:c.deputy_title.trim()||"معاونت",deputy_name:c.deputy_name.trim(),successor_title:c.successor_title.trim()||"جانشین معاونت",successor_name:c.successor_name.trim(),commanders:c.commanders.map((x:any,i:number)=>({id:String(x.id||"c"+i).slice(0,40),title:x.title.trim()||"عنوان گردان",name:x.name.trim(),sections:x.sections.map((s:any,j:number)=>({id:String(s.id||"s"+j).slice(0,40),title:s.title.trim()||"بخش جدید",name:s.name.trim()}))})),areas:c.areas.map((a:any,i:number)=>({id:String(a.id||"a"+i).slice(0,40),title:a.title.trim()||"حوزه جدید",leader_name:a.leader_name.trim(),bases:a.bases.map((v:any,j:number)=>({id:String(v.id||"b"+j).slice(0,40),title:v.title.trim()||"پایگاه جدید",leader_name:v.leader_name.trim()}))}))};
 const d=db();const {error}=await d.from("site_settings").upsert({key:"organization_chart",value:clean,updated_by:ctx.user.id,updated_at:new Date().toISOString()},{onConflict:"key"});
 if(error)return NextResponse.json({message:"ذخیره چارت انجام نشد."},{status:500});
 await d.from("audit_logs").insert({user_id:ctx.user.id,action:"organization_chart.update",entity_type:"site_settings",metadata:{updated:true}});
 return NextResponse.json({ok:true,chart:clean});
}