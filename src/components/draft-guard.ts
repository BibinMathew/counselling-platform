"use client";
import { useEffect, useRef } from "react";
import { BEFORE_LEAVE_EVENT } from "@/lib/navigation-events";
export function useDraftGuard(dirty: boolean) {
  const leaving = useRef(false);
  useEffect(() => {
    leaving.current = false;
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      if (!leaving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (
        !(a instanceof HTMLAnchorElement) ||
        a.download ||
        (a.target && a.target !== "_self") ||
        a.href === window.location.href
      )
        return;
      const target = new URL(a.href),
        current = new URL(window.location.href);
      if (
        target.hash &&
        target.origin === current.origin &&
        target.pathname === current.pathname &&
        target.search === current.search
      )
        return;
      if (!window.confirm("Discard your unsaved draft and leave this page?")) {
        e.preventDefault();
        e.stopPropagation();
      } else leaving.current = true;
    };
    const beforeLeave = (event: Event) => {
      if (event.defaultPrevented) return;
      if (!window.confirm("Discard your unsaved draft and sign out?")) event.preventDefault();
      else leaving.current = true;
    };
    window.addEventListener(BEFORE_LEAVE_EVENT, beforeLeave);
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener(BEFORE_LEAVE_EVENT, beforeLeave);
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  return () => {
    if (!dirty || window.confirm("Reload saved information? This replaces your unsaved draft.")) {
      leaving.current = true;
      window.location.reload();
    }
  };
}
