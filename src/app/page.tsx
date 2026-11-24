import Link from "next/link";
import { Suspense } from "react";
import { HomeAccount } from "@/modules/identity/components/home-account";
import { SessionFacts } from "@/modules/home/session-facts";
import { HomeCounselorShowcase } from "@/modules/catalog/components/home-counselor-showcase";

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <p className="home-eyebrow">A space for you</p>
            <h1>A little hello can be the start of feeling better.</h1>
            <p>
              Talk to a counselor about what is on your mind. Choose a time that works for you and
              meet online, at your pace.
            </p>
            <div className="home-actions">
              <Link href="/counselors" className="home-button">
                Find a counselor <span aria-hidden="true">→</span>
              </Link>
              <a href="#how" className="home-button home-button-outline">
                How it works
              </a>
            </div>
            <Suspense fallback={null}>
              <SessionFacts />
            </Suspense>
          </div>
          <div className="home-hero-photo" role="img" aria-label="A peaceful counseling room" />
        </div>
      </section>

      <div className="home-content">
        <div className="home-trust" aria-label="Session details">
          <span>One-to-one sessions</span>
          <span>Online via Google Meet</span>
          <span>Choose your counselor</span>
          <span>Clear session pricing</span>
        </div>

        <section id="how" className="home-panel home-how">
          <div className="home-intro">
            <p className="home-eyebrow">Simple by design</p>
            <h2>How it works</h2>
            <p>Three small steps to getting support.</p>
          </div>
          <div className="home-steps">
            <article className="home-step">
              <span className="step-number" aria-hidden="true">
                1
              </span>
              <div>
                <h3>Choose your counselor</h3>
                <p>Explore profiles, languages and available times.</p>
              </div>
            </article>
            <article className="home-step">
              <span className="step-number" aria-hidden="true">
                2
              </span>
              <div>
                <h3>Book your session</h3>
                <p>Verify your phone and pay to confirm your selected time.</p>
              </div>
            </article>
            <article className="home-step">
              <span className="step-number" aria-hidden="true">
                3
              </span>
              <div>
                <h3>Meet one-to-one online</h3>
                <p>Join through your assigned Google Meet link when it is available.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="home-panel home-concerns">
          <div className="home-intro">
            <h2>Start with what&apos;s on your mind</h2>
            <p>You don&apos;t need the right words to begin.</p>
          </div>
          <p>
            Whether you are navigating stress, relationships, life changes, or are not sure where to
            start, you can explore counselor profiles to find the support that feels right for you.
          </p>
        </section>

        <Suspense fallback={<p className="muted">Loading counselor profiles…</p>}>
          <HomeCounselorShowcase searchParams={searchParams} />
        </Suspense>

        <section id="faq" className="home-panel home-faq">
          <div className="home-intro">
            <h2>Before your first session</h2>
            <p>A few answers to help you feel prepared.</p>
          </div>
          <div className="home-questions">
            <details>
              <summary>What can I expect?</summary>
              <p>
                Your first session is a chance to share what brings you to counseling and ask
                questions at your own pace.
              </p>
            </details>
            <details>
              <summary>How do I join my session?</summary>
              <p>
                Your appointment will show its Google Meet link when it is available. If it is not
                ready yet, the link will follow.
              </p>
            </details>
            <details>
              <summary>Can I reschedule or cancel?</summary>
              <p>
                You may reschedule once, at least 24 hours before the original session.
                Customer-initiated cancellation is not available.
              </p>
            </details>
          </div>
        </section>

        <section className="home-closing">
          <div>
            <h2>Take the first step when you&apos;re ready.</h2>
            <p>Support, at your pace.</p>
          </div>
          <Link href="/counselors" className="home-button home-button-light">
            Explore counselor profiles <span aria-hidden="true">→</span>
          </Link>
        </section>
        <Suspense fallback={<p className="muted">Loading account…</p>}>
          <HomeAccount />
        </Suspense>
      </div>
    </div>
  );
}
