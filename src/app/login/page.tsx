import type { Metadata } from "next";
import { LoginForm } from "@/modules/identity/components/login-form";

export const metadata: Metadata = {
  title: "Phone sign-in | Counseling Platform",
};

export default function LoginPage() {
  return (
    <main>
      <h1>Phone sign-in</h1>
      <p>Use your Indian mobile number to access your account.</p>
      <LoginForm />
    </main>
  );
}
