import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HemoLens — Preliminary Anemia Screening",
  description:
    "Check your anemia risk using a non-invasive smartphone image of your lower eyelid. Get calibrated clinical wellness guidance in minutes with AI-powered analysis.",
};

import { SidebarProvider } from "./context/SidebarContext";
import { LanguageProvider } from "./context/LanguageContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
