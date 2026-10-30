import { CircleCheck, MessageSquare, Trash2, Undo2 } from "lucide-react";
import { cn } from "cn";

import {
  chooseSuggestionAction,
  deleteCommentAction,
  deleteSuggestionAction,
} from "@/app/actions/suggestions";
import { FlightSummary } from "@/components/travel/flight-summary";
import { HotelSummary } from "@/components/travel/hotel-summary";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import type { SuggestionView } from "@/lib/suggestions";
import type { FlightOption, HotelOption } from "@/lib/travel/types";

import { CommentForm } from "./comment-form";
import { VoteButtons } from "./vote-buttons";

export function SuggestionCard({
  suggestion,
  userId,
  canChoose,
}: {
  suggestion: SuggestionView;
  userId: string;
  /** Whether this user decides the plan (the trip owner). */
  canChoose: boolean;
}) {
  const s = suggestion;

  return (
    <article
      className={cn(
        "flex gap-3 rounded-xl border bg-card p-4",
        s.chosen && "border-primary/40 ring-1 ring-primary/20",
      )}
    >
      <VoteButtons suggestionId={s.id} score={s.score} myVote={s.myVote} />

      <div className="grid min-w-0 flex-1 gap-3">
        {s.kind === "flight" ? (
          <FlightSummary flight={s.details as FlightOption} />
        ) : (
          <HotelSummary hotel={s.details as HotelOption} />
        )}

        {s.note && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">“{s.note}”</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Suggested by @{s.author.username} {formatRelative(s.createdAt)} ·{" "}
            {s.upvotes} up, {s.downvotes} down
          </span>
          <div className="flex items-center gap-1">
            {canChoose && (
              <form action={chooseSuggestionAction}>
                <input type="hidden" name="id" value={s.id} />
                <input
                  type="hidden"
                  name="chosen"
                  value={s.chosen ? "0" : "1"}
                />
                <Button
                  type="submit"
                  variant={s.chosen ? "ghost" : "outline"}
                  size="xs"
                  className={cn(s.chosen && "text-muted-foreground")}
                >
                  {s.chosen ? (
                    <>
                      <Undo2 aria-hidden />
                      Unchoose
                    </>
                  ) : (
                    <>
                      <CircleCheck aria-hidden />
                      Choose for the trip
                    </>
                  )}
                </Button>
              </form>
            )}
            {s.author.id === userId && (
              <form action={deleteSuggestionAction}>
                <input type="hidden" name="id" value={s.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                >
                  <Trash2 aria-hidden />
                  Remove
                </Button>
              </form>
            )}
          </div>
        </div>

        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <MessageSquare className="size-4" aria-hidden />
            {s.comments.length === 0
              ? "Comment"
              : `${s.comments.length} comment${s.comments.length > 1 ? "s" : ""}`}
          </summary>
          <div className="grid gap-3 border-t p-3">
            {s.comments.length > 0 && (
              <ul className="grid gap-3">
                {s.comments.map((c) => (
                  <li key={c.id} className="grid gap-0.5 text-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        @{c.author.username}
                      </span>
                      <span>{formatRelative(c.createdAt)}</span>
                      {c.author.id === userId && (
                        <form action={deleteCommentAction} className="ml-auto">
                          <input type="hidden" name="id" value={c.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Delete comment"
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </form>
                      )}
                    </div>
                    <p className="break-words whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <CommentForm suggestionId={s.id} />
          </div>
        </details>
      </div>
    </article>
  );
}
