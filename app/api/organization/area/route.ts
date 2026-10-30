import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const units=["رصد","تولید محتوا","شبکه انتشار","خبر رسانه، رسانه محله","آموزش و مقابله با شایعه"];
const norm=(s:string)=>s.replace(/^حوزه\s*/,"").replace(/\s+/g," ").replace(/\s*\([^)]*\)/g,"").trim();
function locate(chart:any, name:string){let a=(chart.areas||[]).find((x:any)=>norm(x.title)===norm(name));if(!a&&name.includes("امام صادق"))a=(chart.areas||[]).find((x:any)=>x.title.includes("امام جعفر صادق"));return a;}
function shape(a:any){return {...a,successor_name:typeof a.successor_name==="string"?a.successor_name:"",bases:(Array.isArray(a.bases)?a.bases:[]).map((b:any)=>({...b,leader_name:b.leader_name||"",units:units.map(title=>{const old=(b.units||[]).find((u:any)=>u.title===title);return {title,leader_name:old?.leader_name||""}})}))};}
export async function GET(req:Request){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"ابتدا وارد سامانه شوید."},{status:401});
 const privileged=["main_admin","deputy","battalion_commander"].includes(ctx.profile.role);
 if(!privileged&&ctx.profile.role!=="area_manager")return NextResponse.json({message:"دسترسی مشاهده این ساختار را ندارید."},{status:403});
 const id=new URL(req.url).searchParams.get("areaId");if(!id)return NextResponse.json({message:"شناسه حوزه مشخص نیست."},{status:400});
 const d=db();const {data:setting,error}=await d.from("site_settings").select("value").eq("key","organization_chart").maybeSingle();
 if(error||!setting?.value)return NextResponse.json({message:"چارت سازمانی پیدا نشد."},{status:404});
 const chart=setting.value;
 const {data:assigned}=await d.from("areas").select("id,name").in("id",ctx.areaIds.length?ctx.areaIds:["00000000-0000-0000-0000-000000000000"]);
 const allowed=privileged?assigned||[]:(assigned||[]);
 let area:any=null,dbArea:any=null;
 if(privileged){
   area=(chart.areas||[]).find((x:any)=>x.id===id);
   if(!area){dbArea=(await d.from("areas").select("id,name").eq("id",id).maybeSingle()).data; if(dbArea)area=locate(chart,dbArea.name);}
 }else{
   dbArea=allowed.find((x:any)=>x.id===id)||null;
   if(!dbArea)return NextResponse.json({message:"به این حوزه دسترسی ندارید."},{status:403});
   area=locate(chart,dbArea.name);
 }
 if(!area)return NextResponse.json({message:"حوزه موردنظر در چارت پیدا نشد."},{status:404});
 return NextResponse.json({area:shape(area),can_edit:ctx.profile.role==="area_manager"||privileged,db_area_id:dbArea?.id||id});
}
export async function PATCH(req:Request){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"ابتدا وارد سامانه شوید."},{status:401});
 if(ctx.profile.role!=="area_manager")return NextResponse.json({message:"فقط مسئول حوزه می‌تواند این بخش را ویرایش کند."},{status:403});
 let body:any;try{body=await req.json()}catch{return NextResponse.json({message:"اطلاعات نامعتبر است."},{status:400})}
 const id=String(body.areaId||"");if(!ctx.areaIds.includes(id))return NextResponse.json({message:"اجازه ویرایش این حوزه را ندارید."},{status:403});
 const d=db();const [{data:dbArea},{data:setting}]=await Promise.all([d.from("areas").select("id,name").eq("id",id).maybeSingle(),d.from("site_settings").select("value").eq("key","organization_chart").maybeSingle()]);
 if(!dbArea||!setting?.value)return NextResponse.json({message:"حوزه یا چارت پیدا نشد."},{status:404});
 const chart=setting.value;const index=(chart.areas||[]).findIndex((x:any)=>locate({areas:[x]},dbArea.name));
 if(index<0)return NextResponse.json({message:"این حوزه هنوز به چارت اصلی متصل نشده است."},{status:404});
 const old=shape(chart.areas[index]);const input=body.area||{};
 const valid=(v:any)=>typeof v==="string"&&v.length<=100;
 if(!valid(input.leader_name)||!valid(input.successor_name)||!Array.isArray(input.bases)||input.bases.length>100)return NextResponse.json({message:"اطلاعات حوزه معتبر نیست."},{status:400});
 const bases=[];for(let i=0;i<input.bases.length;i++){const b=input.bases[i];if(!valid(b.title)||!valid(b.leader_name)||!Array.isArray(b.units)||b.units.length!==units.length||b.units.some((u:any)=>!units.includes(u.title)||!valid(u.leader_name)))return NextResponse.json({message:"اطلاعات پایگاه یا مسئولان زیرمجموعه معتبر نیست."},{status:400});bases.push({id:String(b.id||old.bases[i]?.id||"base"+i).slice(0,40),title:b.title.trim(),leader_name:b.leader_name.trim(),units:units.map(title=>({title,leader_name:b.units.find((u:any)=>u.title===title).leader_name.trim()}))});}
 const next={...old,leader_name:input.leader_name.trim(),successor_name:input.successor_name.trim(),bases};
 const areas=[...chart.areas];areas[index]=next;
 const {error}=await d.from("site_settings").update({value:{...chart,version:3,areas},updated_by:ctx.user.id,updated_at:new Date().toISOString()}).eq("key","organization_chart");
 if(error)return NextResponse.json({message:"ذخیره اطلاعات انجام نشد."},{status:500});
 await d.from("audit_logs").insert({user_id:ctx.user.id,action:"organization.area.update",entity_type:"organization_chart",metadata:{area_id:id,area_name:dbArea.name}});
 return NextResponse.json({ok:true,area:shape(next)});
}
