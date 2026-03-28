import type { Metadata } from "next";
import { Geist, Geist_Mono, Jua } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** 둥근 톤의 주제·타이틀용 (한글 지원) */
const fontTopic = Jua({
  weight: "400",
  variable: "--font-topic-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Team 메뉴 정하기",
  description: "팀원과 함께 메뉴를 제안하고 투표해 정해 보세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${fontTopic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-transparent text-foreground font-sans">
        <SiteHeader />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
