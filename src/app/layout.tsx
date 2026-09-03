import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = {
  title: { default: "King’s Accounting", template: "%s | King’s Accounting" },
  description: "Accounting and trucking operations in one secure workspace.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#092d3d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<ServiceWorker/></body></html>;
}
