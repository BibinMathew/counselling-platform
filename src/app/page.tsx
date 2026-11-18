import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Counseling Platform</h1>
      <p>Book a confidential one-to-one counseling session.</p>
      <p>
        <Link href="/counselors">Find a counselor</Link>
      </p>
      <p>
        <a href="/login">Sign in with phone</a>
      </p>
    </main>
  );
}
