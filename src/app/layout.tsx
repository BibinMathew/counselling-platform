import { Suspense } from "react";
import Link from "next/link";
import {
  SessionNavigation,
  NavigationFallback,
} from "@/modules/identity/components/session-navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Counseling Platform",
  description: "A counseling appointment platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <Suspense fallback={<NavigationFallback />}>
          <SessionNavigation />
        </Suspense>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer">
          <span>Counseling Platform</span>
          <span>One-to-one sessions online · Asia/Kolkata</span>
          <Link href="/counselors">Browse counselor directory</Link>
        </footer>
      </body>
    </html>
  );
}
