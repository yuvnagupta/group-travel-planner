import { CircleCheck } from "lucide-react";

import type { SuggestionView } from "@/lib/suggestions";

import { SuggestionCard } from "./suggestion-card";

type SuggestionsSectionProps = {
  id: string;
  /** Singular noun for this kind, e.g. "flight". */
  noun: string;
  suggestions: SuggestionView[];
  userId: string;
  isOwner: boolean;
  /** The search form for finding more options. */
  search: React.ReactNode;
};

/**
 * One tab of the trip plan: the option the owner chose, then everything the
 * group suggested, then a search for more.
 */
export function SuggestionsSection({
  id,
  noun,
  suggestions,
  userId,
  isOwner,
  search,
}: SuggestionsSectionProps) {
  const chosen = suggestions.find((s) => s.chosen);
  const others = suggestions.filter((s) => !s.chosen);

  return (
    <div className="grid gap-8">
      <section aria-labelledby={`${id}-chosen-heading`} className="grid gap-3">
        <h2
          id={`${id}-chosen-heading`}
          className="flex items-center gap-2 text-xl font-semibold"
        >
          <CircleCheck className="size-5 text-primary" aria-hidden />
          Chosen {noun}
        </h2>
        {chosen ? (
          <SuggestionCard
            suggestion={chosen}
            userId={userId}
            canChoose={isOwner}
          />
        ) : (
          <p className="rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
            No {noun} chosen yet.{" "}
            {isOwner
              ? `Pick one of the suggestions below with “Choose for the trip”.`
              : `The trip owner picks one from the suggestions below.`}
          </p>
        )}
      </section>

      <section
        aria-labelledby={`${id}-suggested-heading`}
        className="grid gap-3"
      >
        <h2 id={`${id}-suggested-heading`} className="text-xl font-semibold">
          Suggested {noun}s{" "}
          <span className="text-muted-foreground">({others.length})</span>
        </h2>
        {others.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {suggestions.length === 0
              ? `No ${noun}s suggested yet. Search below and suggest one to the group.`
              : `No other ${noun}s suggested. Search below for more options.`}
          </p>
        ) : (
          <div className="grid gap-3">
            {others.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                userId={userId}
                canChoose={isOwner}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby={`${id}-search-heading`} className="grid gap-3">
        <div className="grid gap-1">
          <h2 id={`${id}-search-heading`} className="text-xl font-semibold">
            Find more {noun}s
          </h2>
          <p className="text-sm text-muted-foreground">
            Search, then suggest the options you like. Everyone on the trip can
            vote and comment.
          </p>
        </div>
        {search}
      </section>
    </div>
  );
}
