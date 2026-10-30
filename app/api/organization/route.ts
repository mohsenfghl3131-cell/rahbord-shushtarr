import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const empty=()=>({version:2,deputy_title:"معاونت",deputy_name:"",successor_title:"جانشین معاونت",successor_name:"",commanders:[{id:"c1",title:"فرمانده گردان ۱",name:"",sections:[{id:"s1",title:"شمسا",name:""},{id:"s2",title:"متنا",name:""},{id:"s3",title:"مپتا",name:""},{id:"s4",title:"نسرا",name:""}]},{id:"c2",title:"فرمانده گردان ۲",name:"",sections:[{id:"s5",title:"شمسا",name:""},{id:"s6",title:"متنا",name:""},{id:"s7",title:"مپتا",name:""},{id:"s8",title:"نسرا",name:""}]}]});
export async function GET(){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"ابتدا وارد سامانه شوید."},{status:401});
 const {data:setting,error}=await db().from("site_settings").select("value").eq("key","organization_chart").maybeSingle();
 if(error)return NextResponse.json({message:"دریافت چارت انجام نشد."},{status:500});
 let chart=setting?.value;
 if(!chart||chart.version!==2) chart=empty();
 return NextResponse.json({chart,can_edit:ctx.profile.role==="main_admin"});
}
export async function PATCH(req:Request){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"ابتدا وارد سامانه شوید."},{status:401});
 if(ctx.profile.role!=="main_admin")return NextResponse.json({message:"فقط مدیر اصلی می‌تواند چارت را تغییر دهد."},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({message:"اطلاعات نامعتبر است."},{status:400})}
 const c=b?.chart;
 const validText=(v:any)=>typeof v==="string"&&v.length<=100;
 if(!c||!Array.isArray(c.commanders)||c.commanders.length<1||c.commanders.length>12||!validText(c.deputy_title)||!validText(c.deputy_name)||!validText(c.successor_title)||!validText(c.successor_name)||c.commanders.some((x:any)=>!validText(x.title)||!validText(x.name)||!Array.isArray(x.sections)||x.sections.length>30||x.sections.some((s:any)=>!validText(s.title)||!validText(s.name))))return NextResponse.json({message:"اطلاعات چارت معتبر نیست. حداکثر ۱۲ گردان و ۳۰ بخش برای هر گردان مجاز است."},{status:400});
 const clean={version:2,deputy_title:c.deputy_title.trim()||"معاونت",deputy_name:c.deputy_name.trim(),successor_title:c.successor_title.trim()||"جانشین معاونت",successor_name:c.successor_name.trim(),commanders:c.commanders.map((x:any,i:number)=>({id:String(x.id||"c"+i).slice(0,40),title:x.title.trim()||"عنوان گردان",name:x.name.trim(),sections:x.sections.map((s:any,j:number)=>({id:String(s.id||"s"+j).slice(0,40),title:s.title.trim()||"بخش جدید",name:s.name.trim()}))}))};
 const d=db();const {error}=await d.from("site_settings").upsert({key:"organization_chart",value:clean,updated_by:ctx.user.id,updated_at:new Date().toISOString()},{onConflict:"key"});
 if(error)return NextResponse.json({message:"ذخیره چارت انجام نشد."},{status:500});
 await d.from("audit_logs").insert({user_id:ctx.user.id,action:"organization_chart.update",entity_type:"site_settings",metadata:{updated:true}});
 return NextResponse.json({ok:true,chart:clean});
}