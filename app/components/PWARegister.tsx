"use client";
import {useEffect} from "react";
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>};
export default function PWARegister(){
 useEffect(()=>{
  if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{});}
  const handler=(event:Event)=>{
   event.preventDefault();
   window.dispatchEvent(new CustomEvent("rahbord-install-ready",{detail:event as InstallPromptEvent}));
  };
  window.addEventListener("beforeinstallprompt",handler);
  return ()=>window.removeEventListener("beforeinstallprompt",handler);
 },[]);
 return null;
}
