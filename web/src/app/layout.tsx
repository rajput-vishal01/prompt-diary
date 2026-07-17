import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/Toast";
import { DialogHost } from "@/components/Dialog";
import { TipProvider } from "@/components/ui/Tooltip";

// Instrument Sans: the UI/body face — humanist grotesque, deliberately NOT
// Inter (the ubiquitous default is the fastest way to read as template).
const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

// Bricolage Grotesque: the display voice — an editorial grotesque with real
// character at light weights and punch at medium. Display stays 300–500;
// 600+ is off-limits (the system whispers, it doesn't shout).
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-display",
});

const SITE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Prompt Diary — a vault for your best AI prompts",
    template: "%s — Prompt Diary",
  },
  description:
    "A password-manager-style vault for your best AI prompts. Save from any AI site, organize, reuse in one keystroke, and carry whole conversations between models.",
  openGraph: {
    type: "website",
    siteName: "Prompt Diary",
    title: "Prompt Diary — a vault for your best AI prompts",
    description:
      "Save the prompt. Keep the recipe. Carry the context. A vault for your best AI prompts, from any AI site.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prompt Diary — a vault for your best AI prompts",
    description:
      "Save the prompt. Keep the recipe. Carry the context.",
  },
  robots: { index: true, follow: true },
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
        <TipProvider>
          {children}
          <Toaster />
          <DialogHost />
        </TipProvider>
      </body>
    </html>
  );
}
