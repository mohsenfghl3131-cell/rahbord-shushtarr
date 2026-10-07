export type AppRole="main_admin"|"deputy"|"battalion_commander"|"area_manager"|"area_force";
export type ReportStatus="pending"|"approved"|"rejected";
export type Profile={id:string;user_code:string;display_name:string;role:AppRole;is_active:boolean;avatar_path:string|null;created_at:string;updated_at:string};
export type Area={id:string;name:string;code?:string|null;description?:string|null;is_active:boolean};
export type Category={id:string;group_id:string;name:string;sort_order:number;is_active:boolean};