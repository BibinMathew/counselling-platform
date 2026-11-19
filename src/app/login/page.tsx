import type { Metadata } from "next";
import { Suspense } from "react";
import { safeBookingReturn } from "@/modules/booking/return-path";
import { LoginForm } from "@/modules/identity/components/login-form";

export const metadata: Metadata = {
  title: "Phone sign-in | Counseling Platform",
};

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <div className="page-main auth-page">
      <h1>Phone sign-in</h1>
      <p>Use your Indian mobile number to access your account.</p>
      <Suspense fallback={<p>Loading sign-in...</p>}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginContent({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm next={safeBookingReturn(next)} />;
}
