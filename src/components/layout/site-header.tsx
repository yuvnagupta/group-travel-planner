import { Plane } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ThemeToggle } from "@/components/theme/theme-toggle";

import { UserNav } from "./user-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Plane className="size-5" aria-hidden />
          <span>Group Travel Planner</span>
        </Link>
        <div className="flex items-center gap-1">
          {/* Reads the session, so it streams in after the static shell. */}
          <Suspense fallback={null}>
            <UserNav />
          </Suspense>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
