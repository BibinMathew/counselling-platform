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
  title: "littlehello | Mental health counseling",
  description: "Find a counselor and book a one-to-one online session.",
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
          <span>littlehello</span>
          <span>One-to-one sessions online · Asia/Kolkata</span>
          <Link href="/counselors">Browse counselor directory</Link>
        </footer>
      </body>
    </html>
  );
}
