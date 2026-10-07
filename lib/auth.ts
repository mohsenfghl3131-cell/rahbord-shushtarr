import{createClient as createAdminClient}from"@supabase/supabase-js";
import{createServerClient}from"@/lib/supabase/server";
import type{AppRole,Profile}from"@/lib/types";

const reviewRoles:AppRole[]=["main_admin","deputy","battalion_commander","area_manager"];

export async function getCurrentContext(){
  const supabase=await createServerClient();
  const{data:claimsData}=await supabase.auth.getClaims();
  const userId=claimsData?.claims?.sub;
  if(!userId)return null;

  const admin=createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const{data:profile}=await admin.from("profiles").select("*").eq("id",userId).maybeSingle();
  if(!profile?.is_active)return null;

  const{data:access}=await admin.from("user_area_access").select("area_id").eq("user_id",userId);

  return{
    user:{id:userId},
    profile:profile as Profile,
    areaIds:(access??[]).map((x:{area_id:string})=>x.area_id),
    canReview:reviewRoles.includes(profile.role as AppRole)
  };
}

export function canUseArea(ctx:Awaited<ReturnType<typeof getCurrentContext>>,areaId:string){
  if(!ctx)return false;
  return ctx.profile.role!=="area_manager"&&ctx.profile.role!=="area_force"?true:ctx.areaIds.includes(areaId)
}