import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AdminSessionWatcher from "@/components/admin/AdminSessionWatcher";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "출근 체크",
  description: "직원 출퇴근 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className={inter.className}>
        <AdminSessionWatcher />
        {children}
      </body>
    </html>
  );
}
