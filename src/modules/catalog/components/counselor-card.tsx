import Link from "next/link";
import { Suspense } from "react";
import { CounselorPortrait } from "@/modules/catalog/components/counselor-portrait";
import { getCounselorCategoryLabel } from "@/modules/catalog/categories";
import { SessionFacts } from "@/modules/home/session-facts";
import type { PublicCounselor } from "@/modules/catalog/demo";

export function CounselorCard({
  counselor,
  variant = "directory",
  demoMode = false,
}: {
  counselor: PublicCounselor;
  variant?: "directory" | "home";
  demoMode?: boolean;
}) {
  if (variant === "home") {
    const profileUrl = `/counselors/${counselor.id}`;
    return (
      <article className="counselor-card home-profile">
        <div className="home-profile-top">
          <CounselorPortrait src={counselor.photo_url} name={counselor.display_name} />
          <div>
            {demoMode && <span className="home-profile-demo">Fictional sample</span>}
            <h3>
              <Link href={profileUrl}>{counselor.display_name}</Link>
            </h3>
            <p className="counselor-card-category">
              {getCounselorCategoryLabel(counselor.category)}
            </p>
            <p className="counselor-qualification">{counselor.qualifications}</p>
            <p>{counselor.experience}</p>
            <p>
              <strong>Languages:</strong> {counselor.languages}
            </p>
          </div>
        </div>
        <p className="home-profile-specialty">
          <strong>Areas of practice:</strong> {counselor.specialties}
        </p>
        {!demoMode && (
          <p className="home-profile-price">
            <Suspense fallback={<span>Loading session details…</span>}>
              <SessionFacts />
            </Suspense>
          </p>
        )}
        <div className="home-profile-actions">
          <Link href={profileUrl} className="home-button home-button-outline">
            View profile
          </Link>
          {!demoMode && (
            <Link href={`${profileUrl}#available-times`} className="home-button">
              Book session
            </Link>
          )}
        </div>
      </article>
    );
  }
  return (
    <article className="counselor-card">
      <CounselorPortrait src={counselor.photo_url} name={counselor.display_name} />
      <div>
        <p className="counselor-card-category">{getCounselorCategoryLabel(counselor.category)}</p>
        <h3>
          <Link href={`/counselors/${counselor.id}`}>{counselor.display_name}</Link>
        </h3>
        <p className="counselor-qualification">{counselor.qualifications}</p>
        <p>{counselor.experience}</p>
        <p>
          <strong>Areas of practice:</strong> {counselor.specialties}
        </p>
        <p>
          <strong>Languages:</strong> {counselor.languages}
        </p>
        <Link href={`/counselors/${counselor.id}`}>View profile</Link>
      </div>
    </article>
  );
}
