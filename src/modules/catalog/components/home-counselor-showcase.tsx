import Link from "next/link";
import { connection } from "next/server";
import { COUNSELOR_CATEGORIES, isCounselorCategory } from "@/modules/catalog/categories";
import { CounselorCard } from "@/modules/catalog/components/counselor-card";
import { isCatalogDemoMode } from "@/modules/catalog/demo";
import { getPublicCounselors } from "@/modules/catalog/server/catalog";

export async function HomeCounselorShowcase({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  await connection();
  const [counselors, query] = await Promise.all([getPublicCounselors(), searchParams]);
  const selectedCategory =
    typeof query.category === "string" && isCounselorCategory(query.category)
      ? query.category
      : null;
  const visibleCounselors = selectedCategory
    ? counselors.filter((counselor) => counselor.category === selectedCategory)
    : counselors;
  const demoMode = isCatalogDemoMode();

  return (
    <section
      id="counsellors"
      className="home-counselors home-panel"
      aria-labelledby="home-counselors-title"
    >
      <div className="home-counselors-intro">
        <div className="home-counselors-heading home-intro">
          <span className="home-eyebrow">Find your fit</span>
          <h2 id="home-counselors-title">Meet our counselors</h2>
          <p>Find someone you feel comfortable talking to.</p>
          <Link href={selectedCategory ? "/#counsellors" : "/counselors"}>
            {selectedCategory ? "All counselors" : "Explore counselors →"}
          </Link>
        </div>
        {demoMode && (
          <p className="catalog-demo-notice" role="note">
            UX preview only: these profiles are fictional and do not represent real therapists.
          </p>
        )}
        <nav className="counselor-categories" aria-label="Counselor categories">
          {COUNSELOR_CATEGORIES.map((category) => (
            <Link
              href={`/?category=${category.value}#counsellors`}
              aria-current={selectedCategory === category.value ? "page" : undefined}
              key={category.value}
            >
              <span className="category-icon" aria-hidden="true">
                {category.icon}
              </span>
              {category.label}
            </Link>
          ))}
        </nav>
      </div>
      {visibleCounselors.length ? (
        <div className="counselor-list">
          {visibleCounselors.map((counselor) => (
            <CounselorCard
              counselor={counselor}
              variant="home"
              demoMode={demoMode}
              key={counselor.id}
            />
          ))}
        </div>
      ) : (
        <p className="catalog-empty">
          {selectedCategory
            ? "No counselor profiles are available in this category yet."
            : "No counselor profiles are available yet."}
        </p>
      )}
    </section>
  );
}
