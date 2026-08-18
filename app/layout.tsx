import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://z-xq7.github.io/guangzhou-day-trip-0820/"),
  title: "一日广州｜路线与 30 个广州精选",
  description: "深圳出发的一日路线，加上 30 个广州景点与粤味：实景照片、透明评分、广州核心城区与全域景点分布图。",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    title: "一日广州｜路线与 30 个广州精选",
    description: "深圳出发的一日路线，加上 30 个广州景点与粤味：实景照片、透明评分、广州核心城区与全域景点分布图。",
    images: [{ url: "og.png", width: 1200, height: 630, alt: "发现广州 30 个地方导览" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "一日广州｜路线与 30 个广州精选",
    description: "深圳出发的一日路线，加上 30 个广州景点与粤味：实景照片、透明评分、广州核心城区与全域景点分布图。",
    images: ["og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3ecdf",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
