import { Notice } from "@/components/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import type { QueryInput } from "./model";
export const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
export const statusLabel = (value: string) =>
  value === "in_progress"
    ? "In progress"
    : value === "open"
      ? "Open"
      : value === "closed"
        ? "Closed"
        : value;
export function LocalNotice() {
  return (
    <Notice>
      Local test features. Use fictional content only. Times are shown in Asia/Kolkata.
    </Notice>
  );
}
export function Filters({
  base,
  views,
  current,
  input,
}: {
  base: string;
  views: readonly string[];
  current: string;
  input?: QueryInput;
}) {
  return (
    <nav className="portal-filters" aria-label="List views">
      {views.map((view) => {
        const q = new URLSearchParams();
        q.set("view", view);
        for (const key of ["counselor", "booking"])
          if (typeof input?.[key] === "string" && input[key]) q.set(key, input[key]);
        return (
          <Link
            key={view}
            href={`${base}?${q}`}
            aria-current={current === view ? "page" : undefined}
          >
            {statusLabel(
              view === "all"
                ? "All"
                : view === "unreviewed"
                  ? "Unreviewed"
                  : view === "reviewed"
                    ? "Reviewed"
                    : view === "upcoming"
                      ? "Upcoming"
                      : view === "past"
                        ? "Past"
                        : view === "holds"
                          ? "Holds"
                          : view === "expired"
                            ? "Expired"
                            : view,
            )}
          </Link>
        );
      })}
    </nav>
  );
}
export function Pages({
  base,
  page,
  hasMore,
  input,
}: {
  base: string;
  page: number;
  hasMore: boolean;
  input: QueryInput;
}) {
  const url = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(input)) if (typeof v === "string" && v) q.set(k, v);
    q.set("page", String(n));
    return `${base}?${q}`;
  };
  return (
    <nav className="portal-pagination" aria-label="List pages">
      <p>Page {page + 1}</p>
      {page > 0 && <Link href={url(page - 1)}>Previous page</Link>}
      {hasMore && <Link href={url(page + 1)}>Next page</Link>}
    </nav>
  );
}
export function FilterForm({ booking = false, view }: { booking?: boolean; view: string }) {
  return (
    <form className="booking-form" method="get">
      <input type="hidden" name="view" value={view} />
      <label>
        Counselor ID (optional)
        <input name="counselor" />
      </label>
      {booking && (
        <label>
          Booking ID (optional)
          <input name="booking" />
        </label>
      )}
      <button>Apply filters</button>
    </form>
  );
}
export function OperationsShell({ children }: { children: ReactNode }) {
  return (
    <div className="page-main catalog-page booking-page operations-page">
      <Link href="/admin">Admin area</Link>
      {children}
    </div>
  );
}
export function Disabled() {
  return <p>Local feedback and administration are disabled.</p>;
}
