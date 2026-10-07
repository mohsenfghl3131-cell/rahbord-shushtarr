import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

const roles=["main_admin","deputy","battalion_commander","area_manager","area_force"];
const managerRoles=["main_admin","deputy","battalion_commander"];

function db(){
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function canManage(role:string){
  return managerRoles.includes(role);
}

export async function GET(){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(!canManage(ctx.profile.role))return NextResponse.json({message:"دسترسی مدیریت کاربران ندارید."},{status:403});

  const {data,error}=await db()
    .from("profiles")
    .select("id,user_code,display_name,role,is_active,created_at,user_area_access(area_id,areas(id,name))")
    .order("created_at",{ascending:false});

  if(error)return NextResponse.json({message:"خطا در دریافت کاربران."},{status:500});
  return NextResponse.json({users:data??[]});
}

export async function POST(request:Request){
  const ctx=await getCurrentContext();
  if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
  if(!canManage(ctx.profile.role))return NextResponse.json({message:"دسترسی مدیریت کاربران ندارید."},{status:403});

  let b:any;
  try{
    b=await request.json();
  }catch{
    return NextResponse.json({message:"اطلاعات ارسالی معتبر نیست."},{status:400});
  }

  const userCode=String(b.user_code??"").trim();
  const displayName=String(b.display_name??"").trim();
  const password=String(b.password??"");
  const role=String(b.role??"area_force");
  const areaIds=Array.isArray(b.area_ids)
    ? [...new Set(b.area_ids.filter((x:any)=>typeof x==="string"&&x.trim()).map((x:string)=>x.trim()))]
    : [];

  if(!userCode||!displayName||password.length<8||!roles.includes(role)){
    return NextResponse.json({message:"کد کاربری، نام، رمز عبور یا نقش معتبر نیست."},{status:400});
  }

  if(!/^[A-Za-z0-9._-]+$/.test(userCode)){
    return NextResponse.json({message:"کد کاربری فقط می‌تواند شامل حروف انگلیسی، عدد، نقطه، خط تیره و زیرخط باشد."},{status:400});
  }

  if(ctx.profile.role!=="main_admin"&&role==="main_admin"){
    return NextResponse.json({message:"ایجاد مدیر اصلی فقط توسط مدیر اصلی مجاز است."},{status:403});
  }

  const admin=db();

  const {data:existingProfile}=await admin
    .from("profiles")
    .select("id")
    .eq("user_code",userCode)
    .maybeSingle();

  if(existingProfile){
    return NextResponse.json({message:"این کد کاربری قبلاً ثبت شده است."},{status:409});
  }

  const email=userCode.toLowerCase()+"@rahbord-shushtar.local";
  const {data:created,error:authError}=await admin.auth.admin.createUser({
    email,
    password,
    email_confirm:true,
    user_metadata:{
      user_code:userCode,
      display_name:displayName,
      role
    }
  });

  if(authError||!created.user){
    const message=authError?.message?.toLowerCase().includes("already")
      ?"این کد کاربری قبلاً استفاده شده است."
      :"ایجاد حساب کاربری انجام نشد. لطفاً اطلاعات را بررسی کنید.";
    return NextResponse.json({message},{status:400});
  }

  const userId=created.user.id;

  const {error:profileError}=await admin
    .from("profiles")
    .upsert(
      {
        id:userId,
        user_code:userCode,
        display_name:displayName,
        role,
        is_active:true
      },
      {onConflict:"id"}
    );

  if(profileError){
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({message:"پروفایل کاربر ایجاد نشد و عملیات لغو شد."},{status:500});
  }

  const {error:deleteAccessError}=await admin
    .from("user_area_access")
    .delete()
    .eq("user_id",userId);

  if(deleteAccessError){
    await admin.from("profiles").delete().eq("id",userId);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({message:"دسترسی حوزه‌ای کاربر ثبت نشد و عملیات لغو شد."},{status:500});
  }

  if(areaIds.length){
    const {error:accessError}=await admin
      .from("user_area_access")
      .insert(areaIds.map((area_id:string)=>({user_id:userId,area_id})));

    if(accessError){
      await admin.from("user_area_access").delete().eq("user_id",userId);
      await admin.from("profiles").delete().eq("id",userId);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({message:"دسترسی حوزه‌ای کاربر ثبت نشد و عملیات لغو شد."},{status:500});
    }
  }

  const {error:auditError}=await admin
    .from("audit_logs")
    .insert({
      user_id:ctx.user.id,
      action:"user.create",
      entity_type:"profile",
      entity_id:userId,
      metadata:{user_code:userCode,role,area_ids:areaIds}
    });

  if(auditError){
    console.error("user.create audit log failed:",auditError);
  }

  return NextResponse.json({id:userId},{status:201});
}
