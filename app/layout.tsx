import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import { AppProvider } from "@/components/app-context";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Operációs Optimalizáló · Demo v0.1",
  description:
    "Temetkezési szolgáltató napi diszpécseri irányítópultja — demó. Az optimalizáló javasol, a diszpécser dönt.",
};

export const viewport: Viewport = {
  themeColor: "#f4f3ef",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hu">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
