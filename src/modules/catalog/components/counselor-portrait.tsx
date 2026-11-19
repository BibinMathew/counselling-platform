"use client";
import Image from "next/image";
import { useState } from "react";
export function CounselorPortrait({ src, name }: { src: string; name: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src)
    return (
      <div
        className="counselor-photo portrait-fallback"
        role="img"
        aria-label={`Portrait unavailable for ${name}`}
      >
        {name.trim().charAt(0).toUpperCase() || "C"}
      </div>
    );
  return (
    <Image
      className="counselor-photo"
      src={src}
      alt={`Portrait of ${name}`}
      width={170}
      height={204}
      unoptimized
      onError={() => setFailedSource(src)}
    />
  );
}
