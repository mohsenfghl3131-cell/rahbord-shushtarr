import type {Metadata,Viewport} from "next";
import "./globals.css";
import "./rahbord-neon.css";
export const metadata:Metadata={
 title:{default:"راهبرد شوشتر | مرکز عملیات",template:"%s | راهبرد شوشتر"},
 description:"مرکز یکپارچه مدیریت، گزارش‌دهی، پایش و تحلیل راهبرد شوشتر",
 applicationName:"راهبرد شوشتر",
 manifest:"/manifest.webmanifest",
 appleWebApp:{capable:true,title:"راهبرد شوشتر",statusBarStyle:"default"}
};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#102d45"};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="fa" dir="rtl"><body>{children}</body></html>
}