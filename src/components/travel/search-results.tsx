import type { Signed } from "@/lib/travel/types";

import { SuggestForm } from "./suggest-form";

type SearchResultsProps<T> = {
  tripId: string;
  kind: "flight" | "hotel";
  results: Signed<T>[];
  renderOption: (option: T) => React.ReactNode;
  emptyText: string;
};

export function SearchResults<T>({
  tripId,
  kind,
  results,
  renderOption,
  emptyText,
}: SearchResultsProps<T>) {
  if (results.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <section className="grid gap-3" aria-label="Search results">
      <p className="text-sm text-muted-foreground">
        {results.length} result{results.length > 1 ? "s" : ""}, cheapest first.
        Prices can change until booked.
      </p>
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
    </section>
  );
}
