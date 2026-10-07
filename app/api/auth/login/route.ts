import {NextResponse} from "next/server";
import {createClient as createAdminClient} from "@supabase/supabase-js";
import {createServerClient} from "@/lib/supabase/server";

export async function POST(request:Request){
  try{
    const body=await request.json();
    const userCode=String(body.user_code??"").trim();
    const password=String(body.password??"");
    if(!userCode||!password)return NextResponse.json({message:"کد کاربری و رمز عبور الزامی است."},{status:400});
    const admin=createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const {data:profile,error}=await admin.from("profiles").select("id,is_active").eq("user_code",userCode).maybeSingle();
    if(error||!profile?.is_active)return NextResponse.json({message:"اطلاعات ورود نادرست است یا کاربر فعال نیست."},{status:401});
    const {data:authUser}=await admin.auth.admin.getUserById(profile.id);
    if(!authUser.user?.email)return NextResponse.json({message:"حساب کاربری ناقص است."},{status:401});
    const supabase=await createServerClient();
    const {data,error:signInError}=await supabase.auth.signInWithPassword({email:authUser.user.email,password});
    if(signInError||!data.session)return NextResponse.json({message:"کد کاربری یا رمز عبور نادرست است."},{status:401});
    await admin.from("audit_logs").insert({user_id:data.user.id,action:"auth.login",entity_type:"auth",entity_id:data.user.id,metadata:{}});
    return NextResponse.json({user:{id:data.user.id}});
  }catch{return NextResponse.json({message:"خطای داخلی سامانه."},{status:500})}
}