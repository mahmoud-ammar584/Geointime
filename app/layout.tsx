import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"GeoInTime | Commercial Studio",description:"عروض الأسعار والتارجت والعمولات الخاصة بمحمود",robots:{index:false,follow:false},icons:{icon:"/geointime-logo.png"}};
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>){return <html lang="ar" dir="rtl"><body style={{margin:0}}>{children}</body></html>;}
