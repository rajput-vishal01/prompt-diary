import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/Toast";
import { DialogHost } from "@/components/Dialog";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

const display = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["500", "600"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Prompt Diary",
  description:
    "A password-manager-style vault for your best AI prompts. Save, organize, sync, and share.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${mono.variable} ${display.variable} font-sans`}
      >
        {children}
        <Toaster />
        <DialogHost />
      </body>
    </html>
  );
}
