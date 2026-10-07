import{NextResponse,type NextRequest}from"next/server";
import{createServerClient}from"@supabase/ssr";

export async function middleware(request:NextRequest){
  let response=NextResponse.next({request});
  const supabase=createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies:{
        getAll(){return request.cookies.getAll()},
        setAll(cookiesToSet){
          cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
          response=NextResponse.next({request});
          cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
        }
      }
    }
  );
  const{data:claimsData}=await supabase.auth.getClaims();
  const claims=claimsData?.claims;
  const path=request.nextUrl.pathname;
  const isApi=path.startsWith("/api/");
  const isPublic=path==="/"||path==="/login"||path==="/setup";
  if(!claims&&!isPublic&&!isApi)return NextResponse.redirect(new URL("/login",request.url));
  if(claims&&path==="/setup")return NextResponse.redirect(new URL("/dashboard",request.url));
  response.headers.set("Cache-Control","private, no-store");
  return response;
}

export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};