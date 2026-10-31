import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

const leadership=["main_admin","deputy","battalion_commander"];
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(![...leadership,"area_manager"].includes(ctx.profile.role))
    return NextResponse.json({message:"دسترسی مشاهده نیروها ندارید."},{status:403});

  const admin=db();
  let areasQuery=admin.from("areas").select("id,name,code,is_active").order("name");
  if(ctx.profile.role==="area_manager")
    areasQuery=areasQuery.in("id",ctx.areaIds.length?ctx.areaIds:["00000000-0000-0000-0000-000000000000"]);
  const {data:areas,error:areasError}=await areasQuery;
  if(areasError)return NextResponse.json({message:"دریافت حوزه‌ها انجام نشد."},{status:500});
  const ids=(areas??[]).map(a=>a.id);
  if(!ids.length)return NextResponse.json({areas:[],can_create:false});

  const {data:access,error}=await admin.from("user_area_access")
    .select("area_id,user_id,profiles(id,user_code,display_name,role,is_active,created_at)")
    .in("area_id",ids);
  if(error)return NextResponse.json({message:"دریافت فهرست نیروها انجام نشد."},{status:500});

  const forceByArea=new Map<string,any[]>();
  for(const row of access??[]){
    const p=Array.isArray(row.profiles)?row.profiles[0]:row.profiles;
    if(!p||p.role!=="area_force")continue;
    const list=forceByArea.get(row.area_id)??[];
    list.push(p);
    forceByArea.set(row.area_id,list);
  }
  const result=(areas??[]).map(a=>({...a,forces:(forceByArea.get(a.id)??[]).sort((x,y)=>x.display_name.localeCompare(y.display_name,"fa"))}));
  return NextResponse.json({areas:result,can_create:ctx.profile.role==="area_manager"});
}

export async function POST(request:Request){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(ctx.profile.role!=="area_manager")
    return NextResponse.json({message:"فقط مسئول مجازی حوزه می‌تواند نیروی حوزه ایجاد کند."},{status:403});

  let b:any;
  try{b=await request.json()}catch{return NextResponse.json({message:"اطلاعات ارسالی معتبر نیست."},{status:400})}
  const userCode=String(b.user_code??"").trim();
  const displayName=String(b.display_name??"").trim();
  const password=String(b.password??"");
  const areaId=String(b.area_id??"").trim();
  if(!userCode||!displayName||password.length<8||!areaId)
    return NextResponse.json({message:"نام، کد کاربری، رمز حداقل ۸ کاراکتری و حوزه الزامی است."},{status:400});
  if(!/^[A-Za-z0-9._-]+$/.test(userCode))
    return NextResponse.json({message:"کد کاربری فقط شامل حروف انگلیسی، عدد، نقطه، خط تیره و زیرخط باشد."},{status:400});
  if(!ctx.areaIds.includes(areaId))
    return NextResponse.json({message:"شما فقط می‌توانید برای حوزه خودتان نیرو بسازید."},{status:403});

  const admin=db();
  const {data:existing}=await admin.from("profiles").select("id").eq("user_code",userCode).maybeSingle();
  if(existing)return NextResponse.json({message:"این کد کاربری قبلاً ثبت شده است."},{status:409});

  const email=userCode.toLowerCase()+"@rahbord-shushtar.local";
  const {data:created,error:authError}=await admin.auth.admin.createUser({
    email,password,email_confirm:true,
    user_metadata:{user_code:userCode,display_name:displayName,role:"area_force"}
  });
  if(authError||!created.user){
    const message=authError?.message?.toLowerCase().includes("already")?"این کد کاربری قبلاً استفاده شده است.":"ایجاد حساب کاربری انجام نشد.";
    return NextResponse.json({message},{status:400});
  }
  const userId=created.user.id;
  const {error:profileError}=await admin.from("profiles").upsert({
    id:userId,user_code:userCode,display_name:displayName,role:"area_force",is_active:true
  },{onConflict:"id"});
  if(profileError){
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({message:"ثبت مشخصات نیرو انجام نشد."},{status:500});
  }
  const {error:accessError}=await admin.from("user_area_access").insert({user_id:userId,area_id:areaId});
  if(accessError){
    await admin.from("profiles").delete().eq("id",userId);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({message:"اتصال نیرو به حوزه انجام نشد و حساب لغو شد."},{status:500});
  }
  await admin.from("audit_logs").insert({
    user_id:ctx.user.id,action:"force.create",entity_type:"profile",entity_id:userId,
    metadata:{user_code:userCode,role:"area_force",area_id:areaId}
  });
  return NextResponse.json({id:userId},{status:201});
}
