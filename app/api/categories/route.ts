import{NextResponse}from"next/server";
import{getCurrentContext}from"@/lib/auth";
import{createClient}from"@supabase/supabase-js";

const managers=["main_admin","deputy","battalion_commander"];
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(){
  const c=await getCurrentContext();
  if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  const admin=db();
  const{data,error}=await admin.from("category_groups")
    .select("id,name,sort_order,is_active,responsible_user_id,responsible:profiles!category_groups_responsible_user_id_fkey(id,user_code,display_name)")
    .eq("is_active",true).order("sort_order");
  if(error)return NextResponse.json({message:"خطا در دریافت بخش‌ها."},{status:500});
  const groupIds=(data??[]).map((g:any)=>g.id);
  const {data:assignments}=groupIds.length
    ? await admin.from("category_group_responsibles").select("group_id,user_id,profiles(id,user_code,display_name)").in("group_id",groupIds)
    : {data:[]};
  const groups=(data??[]).map((g:any)=>{
    const links=(assignments??[]).filter((x:any)=>x.group_id===g.id);
    const legacy=Array.isArray(g.responsible)?g.responsible[0]:g.responsible;
    const ids=links.length?links.map((x:any)=>x.user_id):(g.responsible_user_id?[g.responsible_user_id]:[]);
    const users=links.length?links.map((x:any)=>Array.isArray(x.profiles)?x.profiles[0]:x.profiles).filter(Boolean):(legacy?[legacy]:[]);
    return {...g,responsible_user_ids:ids,responsible_users:users};
  });
  const{data:categories,error:categoryError}=await db().from("categories")
    .select("id,name,group_id,sort_order,is_active,category_groups(id,name,responsible_user_id)")
    .order("sort_order");
  if(categoryError)return NextResponse.json({message:"خطا در دریافت دسته‌بندی‌ها."},{status:500});
  return NextResponse.json({groups,categories:categories??[]});
}

export async function POST(req:Request){
  const c=await getCurrentContext();
  if(!c)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(!managers.includes(c.profile.role))return NextResponse.json({message:"دسترسی مدیریت دسته‌بندی‌ها ندارید."},{status:403});
  const b=await req.json();
  const name=String(b.name??"").trim(),group_id=String(b.group_id??"");
  const sort_order=Number.isInteger(b.sort_order)?b.sort_order:0;
  if(!name||!group_id)return NextResponse.json({message:"نام و گروه دسته‌بندی الزامی است."},{status:400});
  const{data,error}=await db().from("categories").insert({name,group_id,sort_order,is_active:true}).select("id").single();
  if(error)return NextResponse.json({message:"ثبت دسته‌بندی انجام نشد."},{status:500});
  await db().from("audit_logs").insert({user_id:c.user.id,action:"category.create",entity_type:"category",entity_id:data.id,metadata:{name,group_id,sort_order}});
  return NextResponse.json({id:data.id},{status:201});
}