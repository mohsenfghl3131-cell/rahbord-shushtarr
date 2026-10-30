import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const empty={deputy_user_id:"",successor_user_id:"",commanders:[{user_id:"",sections:[]},{user_id:"",sections:[]}]};
export async function GET(){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"ابتدا وارد سامانه شوید."},{status:401});
 const d=db();const [{data:users,error:u},{data:groups,error:g},{data:setting}]=await Promise.all([
 d.from("profiles").select("id,display_name,role,is_active").eq("is_active",true).order("display_name"),
 d.from("category_groups").select("id,name,sort_order,is_active").eq("is_active",true).order("sort_order"),
 d.from("site_settings").select("value").eq("key","organization_chart").maybeSingle()]);
 if(u||g)return NextResponse.json({message:"دریافت اطلاعات چارت انجام نشد."},{status:500});
 const activeUsers=users??[];const initial=setting?.value??{...empty,deputy_user_id:activeUsers.find((u:any)=>u.role==="deputy")?.id??"",commanders:[{user_id:activeUsers.find((u:any)=>u.role==="battalion_commander")?.id??"",sections:[]},{user_id:"",sections:[]}]};\n return NextResponse.json({users:activeUsers,groups:groups??[],chart:initial,can_edit:ctx.profile.role==="main_admin"});
}
export async function PATCH(req:Request){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"ابتدا وارد سامانه شوید."},{status:401});
 if(ctx.profile.role!=="main_admin")return NextResponse.json({message:"فقط مدیر اصلی می‌تواند چارت را تغییر دهد."},{status:403});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({message:"اطلاعات نامعتبر است."},{status:400})}
 const c=b?.chart;if(!c||!Array.isArray(c.commanders)||c.commanders.length!==2||c.commanders.some((x:any)=>!Array.isArray(x.sections)))return NextResponse.json({message:"ساختار چارت معتبر نیست."},{status:400});
 const ids=[c.deputy_user_id,c.successor_user_id,...c.commanders.map((x:any)=>x.user_id),...c.commanders.flatMap((x:any)=>x.sections.map((s:any)=>s.user_id))].filter((x:any)=>typeof x==="string"&&x);
 const gids=[...new Set<string>(c.commanders.flatMap((x:any)=>x.sections.map((s:any)=>String(s.group_id||"")).filter(Boolean)))];
 const d=db();
 if(ids.length){const {data}=await d.from("profiles").select("id").eq("is_active",true).in("id",[...new Set(ids)]);if((data?.length??0)!==new Set(ids).size)return NextResponse.json({message:"کاربر انتخاب‌شده معتبر نیست."},{status:400})}
 if(gids.length){const {data}=await d.from("category_groups").select("id").eq("is_active",true).in("id",gids);if((data?.length??0)!==gids.length)return NextResponse.json({message:"بخش انتخاب‌شده معتبر نیست."},{status:400})}
 const clean={deputy_user_id:c.deputy_user_id||"",successor_user_id:c.successor_user_id||"",commanders:c.commanders.map((x:any)=>({user_id:x.user_id||"",sections:x.sections.map((s:any)=>({group_id:String(s.group_id),user_id:s.user_id||""}))}))};
 const {error}=await d.from("site_settings").upsert({key:"organization_chart",value:clean,updated_by:ctx.user.id,updated_at:new Date().toISOString()},{onConflict:"key"});
 if(error)return NextResponse.json({message:"ذخیره چارت انجام نشد."},{status:500});
 await d.from("audit_logs").insert({user_id:ctx.user.id,action:"organization_chart.update",entity_type:"site_settings",metadata:{updated:true}});
 return NextResponse.json({ok:true,chart:clean});
}