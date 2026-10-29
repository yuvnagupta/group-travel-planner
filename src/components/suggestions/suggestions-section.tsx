import { Plus } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { SuggestionView } from "@/lib/suggestions";

import { SuggestionCard } from "./suggestion-card";

type SuggestionsSectionProps = {
  id: string;
  title: string;
  addLabel: string;
  addHref: string;
  emptyText: string;
  suggestions: SuggestionView[];
  userId: string;
};

export function SuggestionsSection({
  id,
  title,
  addLabel,
  addHref,
  emptyText,
  suggestions,
  userId,
}: SuggestionsSectionProps) {
  return (
    <section
      id={id}
      className="grid scroll-mt-20 gap-3"
      aria-labelledby={`${id}-heading`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-heading`} className="text-xl font-semibold">
          {title}{" "}
          <span className="text-muted-foreground">({suggestions.length})</span>
        </h2>
        <Link
          href={addHref}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Plus aria-hidden />
          {addLabel}
        </Link>
      </div>
      {suggestions.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="grid gap-3">
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} userId={userId} />
          ))}
        </div>
      )}
    </section>
  );
}
