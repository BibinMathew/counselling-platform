import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-main auth-page">
      <span className="eyebrow">Page unavailable</span>
      <h1>404</h1>
      <p>This page could not be found or is not available to this account.</p>
      <Link href="/" className="button-primary">
        Back to home
      </Link>
    </div>
  );
}
