import type { ReactNode } from "react";
export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-intro">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Notice({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <p className={`notice${warning ? " notice-warning" : ""}`}>{children}</p>;
}
export function StatusBadge({ status, children }: { status: string; children: ReactNode }) {
  return <span className={`status-badge status-${status}`}>{children}</span>;
}
export function DateTile({ value }: { value: string }) {
  const date = new Date(value);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "Asia/Kolkata" }).format(date);
  return (
    <div className="date-tile" aria-hidden="true">
      {format({ month: "short" }).toUpperCase()}
      <strong>{format({ day: "2-digit" })}</strong>
      {format({ weekday: "short" }).toUpperCase()}
    </div>
  );
}
