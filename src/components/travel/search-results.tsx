"use client";

import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "cn";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { SEARCH_PAGE_SIZE, type Signed } from "@/lib/travel/types";

import { SuggestForm } from "./suggest-form";
import type { SearchMode } from "./use-cached-search";

type SearchResultsProps<T> = {
  tripId: string;
  kind: "flight" | "hotel";
  results: Signed<T>[];
  renderOption: (option: T) => React.ReactNode;
  emptyText: string;
  page: number;
  pageCount: number;
  total: number;
  fetchedAt?: string;
  /** What's loading right now, if anything. */
  loading: SearchMode | null;
  onPage: (page: number) => void;
  onRefresh: () => void;
};

export function SearchResults<T>({
  tripId,
  kind,
  results,
  renderOption,
  emptyText,
  page,
  pageCount,
  total,
  fetchedAt,
  loading,
  onPage,
  onRefresh,
}: SearchResultsProps<T>) {
  const sectionRef = useRef<HTMLElement>(null);
  // Back to the top of the list once a new page has rendered.
  const shownPage = useRef(page);
  useEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    sectionRef.current?.scrollIntoView({ block: "start" });
  }, [page]);
  const status =
    loading === "refresh"
      ? "Checking for new results…"
      : fetchedAt && `Updated ${formatRelative(new Date(fetchedAt))}`;
  const refreshButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onRefresh}
      disabled={loading !== null}
    >
      <RefreshCw
        className={cn(loading === "refresh" && "animate-spin")}
        aria-hidden
      />
      Refresh
    </Button>
  );

  if (total === 0) {
    return (
      <div className="grid gap-3 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        <p>{emptyText}</p>
        <div className="flex items-center justify-center gap-3 text-sm">
          {status}
          {refreshButton}
        </div>
      </div>
    );
  }

  const first = (page - 1) * SEARCH_PAGE_SIZE + 1;
  return (
    <section
      ref={sectionRef}
      className={cn(
        "grid scroll-mt-20 gap-3 transition-opacity",
        loading === "page" && "opacity-60",
      )}
      aria-label="Search results"
      aria-busy={loading !== null}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {first}–{first + results.length - 1} of {total}, cheapest first.
          Prices can change until booked.
        </p>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span role="status">{status}</span>
          {refreshButton}
        </div>
      </div>
      <ul className="grid gap-3">
        {results.map((r) => (
          <li
            key={r.signature}
            className="grid gap-4 rounded-xl border bg-card p-4"
          >
            {renderOption(r.option)}
            <SuggestForm
              tripId={tripId}
              kind={kind}
              payload={r.payload}
              signature={r.signature}
            />
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <nav
          aria-label="Search result pages"
          className="flex items-center justify-between gap-2"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1 || loading !== null}
          >
            <ChevronLeft aria-hidden />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPage(page + 1)}
            disabled={page >= pageCount || loading !== null}
          >
            Next
            <ChevronRight aria-hidden />
          </Button>
        </nav>
      )}
    </section>
  );
}
