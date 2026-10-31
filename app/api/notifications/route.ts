import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getCurrentContext} from "@/lib/auth";

const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
const leaders=["main_admin","deputy","battalion_commander"];
const labels:Record<string,string>={
 "message.create":"نامه جدید ارسال شد","message.broadcast":"نامه همگانی ارسال شد","message.reply":"پاسخ نامه ارسال شد",
 "report.create":"گزارش جدید ثبت شد","report.update":"گزارش ویرایش شد","report.approved":"گزارش تأیید شد","report.rejected":"گزارش رد شد",
 "mission.create":"مأموریت جدید تعریف شد","mission.score":"عملکرد مأموریت ثبت شد","user.create":"کاربر جدید ایجاد شد"
};
export async function GET(){
 const ctx=await getCurrentContext();
 if(!ctx)return NextResponse.json({message:"احراز هویت لازم است."},{status:401});
 const admin=db(),role=ctx.profile.role,isLeader=leaders.includes(role),isArea=role==="area_manager"||role==="area_force";
 const [{count:unreadCount},{data:unreadMessages},{data:logs},{data:missions}] = await Promise.all([
  admin.from("messages").select("id",{count:"exact",head:true}).eq("recipient_id",ctx.user.id).is("read_at",null).is("recipient_deleted_at",null),
  admin.from("messages").select("id,subject,created_at,sender:profiles!messages_sender_id_fkey(display_name)").eq("recipient_id",ctx.user.id).is("read_at",null).is("recipient_deleted_at",null).order("created_at",{ascending:false}).limit(4),
  isLeader?admin.from("audit_logs").select("id,action,entity_type,entity_id,metadata,created_at,user_id,profiles(display_name)").in("action",Object.keys(labels)).order("created_at",{ascending:false}).limit(18):Promise.resolve({data:[] as any[]}),
  isArea?admin.from("missions").select("id,title,description,deadline_at,category_groups(name)").eq("is_active",true).order("created_at",{ascending:false}).limit(20):Promise.resolve({data:[] as any[]})
 ]);
 const activity=(logs??[]).map((x:any)=>({id:x.id,action:x.action,title:labels[x.action]??"فعالیت جدید",detail:(x.profiles?.display_name??"کاربر")+" · "+String(x.metadata?.title??x.metadata?.subject??x.metadata?.area_name??""),created_at:x.created_at,entity_type:x.entity_type,entity_id:x.entity_id}));
 const activeMissions=(missions??[]).filter((m:any)=>!m.deadline_at||new Date(m.deadline_at).getTime()>Date.now()).map((m:any)=>({id:m.id,title:m.title,group:m.category_groups?.name??"مأموریت",deadline_at:m.deadline_at}));
 return NextResponse.json({unread_count:unreadCount??0,unread_messages:unreadMessages??[],activity,active_missions:activeMissions,is_leader:isLeader,is_area:isArea});
}