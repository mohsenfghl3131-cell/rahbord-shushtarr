import type {Metadata,Viewport} from "next";
import "./globals.css";
import "./rahbord-neon.css";
export const metadata:Metadata={
 title:{default:"سامانه راهبرد شوشتر",template:"%s | سامانه راهبرد شوشتر"},
 description:"مرکز یکپارچه مدیریت، گزارش‌دهی، پایش و تحلیل راهبرد شوشتر",
 applicationName:"سامانه راهبرد شوشتر",
 manifest:"/manifest.webmanifest?v=5",
 icons:{
  icon:[{url:"/app-icon.svg?v=5",type:"image/svg+xml",sizes:"512x512"}],
  shortcut:[{url:"/app-icon.svg?v=5",type:"image/svg+xml"}],
  apple:[{url:"/apple-touch-icon.png?v=5",sizes:"192x192",type:"image/png"}]
 },
 appleWebApp:{capable:true,title:"راهبرد شوشتر",statusBarStyle:"default"}
};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#061426"};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="fa" dir="rtl"><body>{children}</body></html>
}
