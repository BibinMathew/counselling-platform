"use client";
import { BEFORE_LEAVE_EVENT } from "@/lib/navigation-events";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { signOut } from "../actions";
import type { ProfileRole } from "../roles";
import {
  navigationLinks,
  activeNavigation,
  isWorkspacePath,
  authenticationHref,
} from "../navigation";
const query = "(min-width: 1080px)";
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;
export function AppNavigation({
  role,
  complete,
  phase9Enabled,
}: {
  role: ProfileRole | null;
  complete: boolean;
  phase9Enabled: boolean;
}) {
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--header-height",
        `${element.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, []);
  const path = usePathname();
  const search = useSearchParams();
  const selected = path === "/book" ? `/book?${search}` : search.get("next");
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const open = openedFor === path;
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLElement>(null);
  const subscribe = useCallback((listener: () => void) => {
    const media = window.matchMedia(query);
    const change = () => {
      if (!media.matches && panel.current?.contains(document.activeElement)) {
        if (trigger.current) {
          trigger.current.hidden = false;
          trigger.current.focus();
        }
      } else if (media.matches && document.activeElement === trigger.current) {
        if (panel.current) {
          panel.current.hidden = false;
          panel.current.querySelector<HTMLAnchorElement>("a")?.focus();
        }
      }
      listener();
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const wide = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const links = role && complete ? navigationLinks(role, phase9Enabled) : [];
  const workspace = role && complete && isWorkspacePath(path, role);
  const active = activeNavigation(path, links);
  const home = role === "admin" ? "/admin" : role === "counselor" ? "/counselor" : "/customer";
  return (
    <>
      <header ref={header} className="site-header">
        <Link href="/" className="site-brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 28 28" fill="none">
              <path
                d="M20 7a9 9 0 1 0 0 14M21 7h-6v6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="21" cy="19" r="3" fill="currentColor" />
            </svg>
          </span>
          <span>Counseling Platform</span>
        </Link>
        <nav aria-label="Primary navigation" className="header-links">
          <Link href="/counselors">Counselors</Link>
          {role ? (
            <>
              {complete ? (
                <>
                  <Link href={home}>Workspace</Link>
                  <Link href="/profile" className="header-profile">
                    Account
                  </Link>
                </>
              ) : (
                <Link href={authenticationHref("/complete-profile", selected)}>
                  Complete profile
                </Link>
              )}
              <form
                action={signOut}
                onSubmit={(event) => {
                  if (!window.dispatchEvent(new Event(BEFORE_LEAVE_EVENT, { cancelable: true })))
                    event.preventDefault();
                }}
              >
                <button className="button-quiet" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href={authenticationHref("/login", selected)} className="button-primary">
              Sign in with phone
            </Link>
          )}
        </nav>
      </header>
      {workspace && (
        <aside
          className="workspace-sidebar"
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) {
              e.preventDefault();
              setOpenedFor(null);
              trigger.current?.focus();
            }
          }}
        >
          <div className="workspace-label">
            <span>
              {role === "admin"
                ? "Administration"
                : role === "counselor"
                  ? "Counselor workspace"
                  : "Your workspace"}
            </span>
            <button
              ref={trigger}
              hidden={wide}
              aria-expanded={open}
              aria-controls="workspace-links"
              onClick={() => setOpenedFor(open ? null : path)}
              className="button-secondary"
            >
              Menu
            </button>
          </div>
          <nav
            ref={panel}
            id="workspace-links"
            aria-label="Workspace navigation"
            hidden={!wide && !open}
          >
            {links.map((l) => (
              <div key={l.href}>
                {l.group && <p className="nav-group">{l.group}</p>}
                <Link
                  href={l.href}
                  aria-current={active === l.href ? "page" : undefined}
                  onClick={(e) => {
                    if (
                      !e.defaultPrevented &&
                      !e.metaKey &&
                      !e.ctrlKey &&
                      !e.shiftKey &&
                      !e.altKey &&
                      e.button === 0 &&
                      !wide
                    ) {
                      setOpenedFor(null);
                      trigger.current?.focus();
                    }
                  }}
                >
                  <span className="nav-marker" aria-hidden="true" />
                  {l.label}
                </Link>
              </div>
            ))}
          </nav>
          <p className="sidebar-foot">
            One-to-one.
            <br />
            At your pace.
          </p>
        </aside>
      )}
    </>
  );
}
