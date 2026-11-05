import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: { default: "RepresENT Portal", template: "%s · RepresENT" },
  description: "Crew portal for RepresENT, a K-pop dance cover crew",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b10",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("dark h-full antialiased", inter.variable, display.variable)}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
