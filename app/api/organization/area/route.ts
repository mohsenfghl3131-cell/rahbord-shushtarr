import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const units=["رصد","تولید محتوا","شبکه انتشار","خبر رسانه، رسانه محله","آموزش و مقابله با شایعه"];
const personnelRoles=["main_admin","deputy","battalion_commander","area_manager"];
const viewRoles=[...personnelRoles,"area_force"];
const norm=(value:string)=>String(value||"").normalize("NFKC").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[\u200c\u200f\u200e]/g,"").replace(/\([^)]*\)/g," ").replace(/^حوزه\s*/,"").replace(/[،,؛;:_-]/g," ").replace(/\s+/g," ").trim();
function locate(chart:any,name:string){const target=norm(name);const list=Array.isArray(chart.areas)?chart.areas:[];let a=list.find((x:any)=>norm(x.title)===target);if(a)return a;const compact=(s:string)=>norm(s).replace(/\s/g,"");a=list.find((x:any)=>compact(x.title)===compact(name));if(a)return a;if(target.includes("امام صادق"))return list.find((x:any)=>norm(x.title).includes("امام جعفر صادق"));return list.find((x:any)=>{const candidate=norm(x.title);return candidate.includes(target)||target.includes(candidate)});}
function shape(a:any){return {...a,successor_name:typeof a.successor_name==="string"?a.successor_name:"",bases:(Array.isArray(a.bases)?a.bases:[]).map((b:any)=>({...b,leader_name:b.leader_name||"",personnel:Array.isArray(b.personnel)?b.personnel.filter((p:any)=>typeof p==="string").slice(0,200):[],units:units.map(title=>{const old=(b.units||[]).find((u:any)=>u.title===title);return {title,leader_name:old?.leader_name||""}})}))};}
async function resolveArea(ctx:any,id:string,chart:any){
 const privileged=["main_admin","deputy","battalion_commander"].includes(ctx.profile.role);
 if(privileged){
   const direct=(chart.areas||[]).find((x:any)=>x.id===id);
   if(direct)return {area:direct,dbArea:null};
 }
 const {data:dbArea}=await db().from("areas").select("id,name").eq("id",id).maybeSingle();
 if(!dbArea)return {area:null,dbArea:null};
 if(!privileged&&!ctx.areaIds.includes(dbArea.id))return {area:null,dbArea,forbidden:true};
 return {area:locate(chart,dbArea.name),dbArea};
}
export async function GET(req:Request){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"ابتدا وارد سامانه شوید."},{status:401});
 if(!viewRoles.includes(ctx.profile.role))return NextResponse.json({message:"دسترسی مشاهده این ساختار را ندارید."},{status:403});
 const id=new URL(req.url).searchParams.get("areaId");if(!id)return NextResponse.json({message:"شناسه حوزه مشخص نیست."},{status:400});
 const {data:setting,error}=await db().from("site_settings").select("value").eq("key","organization_chart").maybeSingle();
 if(error||!setting?.value)return NextResponse.json({message:"چارت سازمانی پیدا نشد."},{status:404});
 const found=await resolveArea(ctx,id,setting.value);
 if(found.forbidden)return NextResponse.json({message:"به این حوزه دسترسی ندارید."},{status:403});
 if(!found.area)return NextResponse.json({message:"حوزه موردنظر در چارت پیدا نشد."},{status:404});
 return NextResponse.json({area:shape(found.area),can_edit:ctx.profile.role==="area_manager",can_manage_personnel:personnelRoles.includes(ctx.profile.role),db_area_id:found.dbArea?.id||id});
}
export async function PATCH(req:Request){
 const ctx=await getCurrentContext();if(!ctx)return NextResponse.json({message:"ابتدا وارد سامانه شوید."},{status:401});
 if(!personnelRoles.includes(ctx.profile.role))return NextResponse.json({message:"شما مجاز به ویرایش نیروهای پایگاه نیستید."},{status:403});
 let body:any;try{body=await req.json()}catch{return NextResponse.json({message:"اطلاعات نامعتبر است."},{status:400})}
 const id=String(body.areaId||"");
 const d=db();const {data:setting,error:settingError}=await d.from("site_settings").select("value").eq("key","organization_chart").maybeSingle();
 if(settingError||!setting?.value)return NextResponse.json({message:"چارت سازمانی پیدا نشد."},{status:404});
 const chart=setting.value;
 let dbArea:any=null,index=-1;
 if(ctx.profile.role==="area_manager"){
   if(!ctx.areaIds.includes(id))return NextResponse.json({message:"اجازه ویرایش این حوزه را ندارید."},{status:403});
   const result=await d.from("areas").select("id,name").eq("id",id).maybeSingle();dbArea=result.data;
   if(!dbArea)return NextResponse.json({message:"حوزه پیدا نشد."},{status:404});
   index=(chart.areas||[]).findIndex((x:any)=>locate({areas:[x]},dbArea.name));
 }else{
   index=(chart.areas||[]).findIndex((x:any)=>x.id===id);
   if(index<0){const result=await d.from("areas").select("id,name").eq("id",id).maybeSingle();dbArea=result.data;if(dbArea)index=(chart.areas||[]).findIndex((x:any)=>locate({areas:[x]},dbArea.name));}
 }
 if(index<0)return NextResponse.json({message:"این حوزه در چارت پیدا نشد."},{status:404});
 const old=shape(chart.areas[index]);const input=body.area||{};const valid=(v:any)=>typeof v==="string"&&v.length<=100;
 let next:any;
 if(ctx.profile.role==="area_manager"){
   if(!valid(input.leader_name)||!valid(input.successor_name)||!Array.isArray(input.bases)||input.bases.length>100)return NextResponse.json({message:"اطلاعات حوزه معتبر نیست."},{status:400});
   const bases=[];for(let i=0;i<input.bases.length;i++){const b=input.bases[i];if(!valid(b.title)||!valid(b.leader_name)||!Array.isArray(b.units)||b.units.length!==units.length||b.units.some((u:any)=>!units.includes(u.title)||!valid(u.leader_name))||!Array.isArray(b.personnel||[])||(b.personnel||[]).length>200||(b.personnel||[]).some((p:any)=>!valid(p)))return NextResponse.json({message:"اطلاعات پایگاه، نیروها یا مسئولان زیرمجموعه معتبر نیست."},{status:400});bases.push({id:String(b.id||old.bases[i]?.id||"base"+i).slice(0,40),title:b.title.trim(),leader_name:b.leader_name.trim(),personnel:(b.personnel||[]).map((p:string)=>p.trim()).filter(Boolean),units:units.map(title=>({title,leader_name:b.units.find((u:any)=>u.title===title).leader_name.trim()}))});}
   next={...old,leader_name:input.leader_name.trim(),successor_name:input.successor_name.trim(),bases};
 }else{
   if(!Array.isArray(input.bases)||input.bases.length>100)return NextResponse.json({message:"فهرست پایگاه‌ها معتبر نیست."},{status:400});
   const updates=new Map<string,string[]>();
   for(const b of input.bases){if(!b||typeof b.id!=="string"||!Array.isArray(b.personnel)||b.personnel.length>200||b.personnel.some((p:any)=>!valid(p)))return NextResponse.json({message:"فهرست نیروها معتبر نیست."},{status:400});if(!old.bases.some((base:any)=>base.id===b.id)||updates.has(b.id))return NextResponse.json({message:"پایگاه انتخاب‌شده معتبر نیست."},{status:400});updates.set(b.id,b.personnel.map((p:string)=>p.trim()).filter(Boolean));}
   next={...old,bases:old.bases.map((b:any)=>updates.has(b.id)?{...b,personnel:updates.get(b.id)}:b)};
 }
 const areas=[...chart.areas];areas[index]=next;
 const {error}=await d.from("site_settings").update({value:{...chart,version:3,areas},updated_by:ctx.user.id,updated_at:new Date().toISOString()}).eq("key","organization_chart");
 if(error)return NextResponse.json({message:"ذخیره اطلاعات انجام نشد."},{status:500});
 await d.from("audit_logs").insert({user_id:ctx.user.id,action:ctx.profile.role==="area_manager"?"organization.area.update":"organization.base_personnel.update",entity_type:"organization_chart",metadata:{area_id:dbArea?.id||id,area_name:next.title}});
 return NextResponse.json({ok:true,area:shape(next)});
}
