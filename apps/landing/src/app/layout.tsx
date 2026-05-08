import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yishan — Workspace layer for agent-driven development",
  description:
    "A desktop workspace for modern dev flow. Keep context, execution, and agent workflows in one place.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
