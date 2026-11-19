import Link from "next/link";
import { Suspense } from "react";
import { HomeAccount } from "@/modules/identity/components/home-account";
import { SessionFacts } from "@/modules/home/session-facts";
export default function Home() {
  return (
    <div className="page-main home-page">
      <section className="home-hero">
        <div>
          <span className="eyebrow">One-to-one. At your pace.</span>
          <h1>Space to pause. Someone to talk to.</h1>
          <p>
            Find a counselor you feel comfortable with. Choose a time that works for you, and meet
            online.
          </p>
          <div className="home-actions">
            <Link href="/counselors" className="button-primary">
              Find a counselor <span aria-hidden="true">↗</span>
            </Link>
            <Suspense
              fallback={
                <span className="session-facts">Explore session details in the directory.</span>
              }
            >
              <SessionFacts />
            </Suspense>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="hero-orbit" />
          <p>
            A little space
            <br />
            for yourself.
          </p>
        </div>
      </section>
      <section className="home-steps" aria-label="How booking works">
        <div className="home-step">
          <span className="step-number" aria-hidden="true">
            1
          </span>
          <div>
            <h2>Choose your counselor</h2>
            <p>Explore profiles, languages and available times.</p>
          </div>
        </div>
        <div className="home-step">
          <span className="step-number" aria-hidden="true">
            2
          </span>
          <div>
            <h2>Book your session</h2>
            <p>Verify your phone and pay to confirm your selected time.</p>
          </div>
        </div>
        <div className="home-step">
          <span className="step-number" aria-hidden="true">
            3
          </span>
          <div>
            <h2>Meet one-to-one online</h2>
            <p>Join through your assigned Google Meet link when it is available.</p>
          </div>
        </div>
      </section>
      <section className="home-discover">
        <div>
          <h2>Start with a conversation.</h2>
          <p>Read about each counselor and choose who you would like to speak with.</p>
        </div>
        <Link href="/counselors" className="button-secondary">
          Explore counselor profiles
        </Link>
      </section>
      <Suspense fallback={<p className="muted">Loading account…</p>}>
        <HomeAccount />
      </Suspense>
    </div>
  );
}
