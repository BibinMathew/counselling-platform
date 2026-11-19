"use client";
export default function LocalFeatureError({ retry }: { retry: () => void }) {
  return (
    <div className="page-main catalog-page booking-page">
      <h1>Information unavailable</h1>
      <p>Please check the filters or try again. Your access is checked on every request.</p>
      <button onClick={retry}>Try again</button>
    </div>
  );
}
