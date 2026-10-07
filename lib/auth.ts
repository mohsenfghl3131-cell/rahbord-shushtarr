import {createServerClient} from "@/lib/supabase/server";
import type {AppRole,Profile} from "@/lib/types";
const reviewRoles:AppRole[]=["main_admin","deputy","battalion_commander","area_manager"];
export async function getCurrentContext(){
 const supabase=await createServerClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return null;
 const {data:profile}=await supabase.from("profiles").select("*").eq("id",user.id).maybeSingle();
 if(!profile?.is_active)return null;
 const {data:access}=await supabase.from("user_area_access").select("area_id").eq("user_id",user.id);
 return {user,profile:profile as Profile,areaIds:(access??[]).map(x=>x.area_id),canReview:reviewRoles.includes(profile.role)};
}
export function canUseArea(ctx:Awaited<ReturnType<typeof getCurrentContext>>,areaId:string){
 if(!ctx)return false;
 return ctx.profile.role!=="area_manager"&&ctx.profile.role!=="area_force" ? true : ctx.areaIds.includes(areaId);
}