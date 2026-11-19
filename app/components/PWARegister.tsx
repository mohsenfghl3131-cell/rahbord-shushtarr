"use client";
import {useEffect,useState} from "react";
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>};
export default function PWARegister(){
 const [installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null);
 useEffect(()=>{
  if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{});}
  const handler=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);};
  const installed=()=>setInstallEvent(null);
  window.addEventListener("beforeinstallprompt",handler);
  window.addEventListener("appinstalled",installed);
  return ()=>{window.removeEventListener("beforeinstallprompt",handler);window.removeEventListener("appinstalled",installed);};
 },[]);
 if(!installEvent)return null;
 return <button onClick={async()=>{await installEvent.prompt();await installEvent.userChoice;setInstallEvent(null);}} style={{position:"fixed",zIndex:9999,bottom:"18px",left:"18px",border:"1px solid #35d8ff",borderRadius:"14px",padding:"12px 18px",background:"#06213c",color:"#fff",fontSize:"14px",fontWeight:700,boxShadow:"0 6px 24px #00bfff55"}}>نصب اپلیکیشن راهبرد شوشتر</button>;
}
