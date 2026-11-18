import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import {
  getPublicAvailability,
  getPublicSessionSettings,
} from "@/modules/availability/server/availability";
import { getPublicCounselor } from "@/modules/catalog/server/catalog";

export default function CounselorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reschedule?: string }>;
}) {
  return (
    <main className="catalog-page">
      <Link href="/counselors">All counselors</Link>
      <Suspense fallback={<p>Loading profile...</p>}>
        <CounselorContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CounselorContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reschedule?: string }>;
}) {
  await connection();
  const { id } = await params;
  const reschedule = z
    .string()
    .uuid()
    .safeParse((await searchParams).reschedule);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const counselor = await getPublicCounselor(id);
  if (!counselor) notFound();
  const [slots, settings] = await Promise.all([
    getPublicAvailability(id),
    getPublicSessionSettings(),
  ]);
  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
  const groupedSlots = new Map<string, typeof slots>();
  for (const slot of slots) {
    const date = dateFormatter.format(new Date(slot.start_at));
    groupedSlots.set(date, [...(groupedSlots.get(date) ?? []), slot]);
  }
  return (
    <article className="counselor-detail">
      <Image
        className="counselor-photo"
        src={counselor.photo_url}
        alt={`Portrait of ${counselor.display_name}`}
        width={160}
        height={180}
        unoptimized
      />
      <div>
        <h1>{counselor.display_name}</h1>
        <p>{counselor.qualifications}</p>
        <p>{counselor.experience}</p>
        <p>{settings.session_minutes}-minute session · ₹699</p>
      </div>
      <div className="counselor-about">
        <h2>About</h2>
        <p>{counselor.bio}</p>
        <h2>Specializations</h2>
        <p>{counselor.specialties}</p>
        <h2>Languages</h2>
        <p>{counselor.languages}</p>
        <h2>Available times</h2>
        <p>Asia/Kolkata</p>
        {slots.length === 0 && <p>No available times in the current booking window.</p>}
        {[...groupedSlots].map(([date, daySlots]) => (
          <section key={date} className="available-day">
            <h3>{date}</h3>
            <ul>
              {daySlots.map((slot) => (
                <li key={slot.start_at}>
                  <Link
                    href={`/book?${new URLSearchParams({ counselor: id, start: slot.start_at, ...(reschedule.success ? { reschedule: reschedule.data } : {}) })}`}
                  >
                    <time dateTime={slot.start_at}>
                      {timeFormatter.format(new Date(slot.start_at))}
                    </time>
                    –
                    <time dateTime={slot.end_at}>
                      {timeFormatter.format(new Date(slot.end_at))}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
