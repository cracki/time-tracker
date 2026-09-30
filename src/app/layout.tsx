import type { Metadata, Viewport } from "next";
import "./globals.css";
import "vazirmatn/Vazirmatn-font-face.css";
import { AppProviders } from "@/providers/app-providers";
import { AmbientBackground } from "@/components/shared/ambient-background";

export const metadata: Metadata = {
  title: "زمان‌سنج — ثبت سریع زمان کاری",
  description:
    "وب‌اپلیکیشن سبک ثبت، بررسی و تأیید زمان کاری تیم — موبایل‌اول، فارسی و PWA.",
  applicationName: "زمان‌سنج",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "زمان‌سنج",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7FAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#101820" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <AmbientBackground />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
