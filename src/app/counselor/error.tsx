"use client";

export default function CounselorError({ retry }: { retry: () => void }) {
  return (
    <div className="page-main catalog-page booking-page">
      <h1>Counselor workspace unavailable</h1>
      <p>Your appointments could not be loaded. Please try again.</p>
      <button onClick={retry}>Try again</button>
    </div>
  );
}
