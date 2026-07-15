import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/Toast";
import { DialogHost } from "@/components/Dialog";

// Inter is the brand's UI/body face (DESIGN.md) — the shadcn init swapped in
// Geist as a template side effect; restored here.
const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

// display serif stays at weight 300 — the editorial signature. Never bold.
// (Newsreader Light is the open substitute for the licensed Waldenburg.)
const display = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["300", "400"],
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
