"use client";

import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { startTransition, useOptimistic } from "react";

import { voteAction } from "@/app/actions/suggestions";
import { Button } from "@/components/ui/button";

type Vote = -1 | 0 | 1;

export function VoteButtons({
  suggestionId,
  score,
  myVote,
}: {
  suggestionId: string;
  score: number;
  myVote: Vote;
}) {
  // Show the vote immediately; the server result replaces it once the action finishes.
  const [optimistic, setOptimistic] = useOptimistic(
    { score, myVote },
    (current, value: 1 | -1) => {
      const next: Vote = current.myVote === value ? 0 : value;
      return { myVote: next, score: current.score - current.myVote + next };
    },
  );

  function cast(value: 1 | -1) {
    const formData = new FormData();
    formData.set("suggestionId", suggestionId);
    formData.set("value", String(value));
    startTransition(async () => {
      setOptimistic(value);
      await voteAction(formData);
    });
  }

  return (
    <div className="flex flex-col items-center" aria-label="Votes">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Upvote"
        aria-pressed={optimistic.myVote === 1}
        onClick={() => cast(1)}
        className="aria-pressed:text-primary"
      >
        <ArrowBigUp
          className={optimistic.myVote === 1 ? "fill-current" : undefined}
        />
      </Button>
      <span className="text-sm font-semibold tabular-nums" aria-live="polite">
        {optimistic.score}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Downvote"
        aria-pressed={optimistic.myVote === -1}
        onClick={() => cast(-1)}
        className="aria-pressed:text-destructive"
      >
        <ArrowBigDown
          className={optimistic.myVote === -1 ? "fill-current" : undefined}
        />
      </Button>
    </div>
  );
}
