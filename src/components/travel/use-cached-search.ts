"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useState,
} from "react";

import type { SearchState } from "@/app/actions/suggestions";

// How often an open page asks the server for newer results. The server only
// calls the API when its copy is older than its own 5 minute limit.
const CHECK_EVERY_MS = 5 * 60_000;
// When the server said it was already refreshing, look again soon.
const CHECK_REFRESHING_MS = 15_000;

/** What the search is doing: a new search hides old results, the rest don't. */
export type SearchMode = "search" | "page" | "refresh" | "check";

/**
 * A search form's state plus paging, the refresh button, and a periodic check
 * for new results while the page is open.
 */
export function useCachedSearch<T>(
  action: (
    state: SearchState<T>,
    formData: FormData,
  ) => Promise<SearchState<T>>,
) {
  const [state, dispatch, pending] = useActionState(action, {});
  const [mode, setMode] = useState<SearchMode>("search");

  const run = useCallback(
    (values: Record<string, string>, next: SearchMode) => {
      const formData = new FormData();
      for (const [key, value] of Object.entries(values))
        formData.set(key, value);
      setMode(next);
      startTransition(() => dispatch(formData));
    },
    [dispatch],
  );

  const { values, results, page = 1, refreshing } = state;
  useEffect(() => {
    if (!values || !results || pending) return;
    const timer = setTimeout(
      () => run({ ...values, page: String(page) }, "check"),
      refreshing ? CHECK_REFRESHING_MS : CHECK_EVERY_MS,
    );
    return () => clearTimeout(timer);
  }, [values, results, page, refreshing, pending, run]);

  return {
    state,
    pending,
    mode,
    /** For the form's `action`. */
    search: (formData: FormData) => {
      setMode("search");
      dispatch(formData);
    },
    /** Runs a search from values, e.g. the trip's defaults on load. */
    searchWith: (values: Record<string, string>) => run(values, "search"),
    goToPage: (next: number) =>
      values && run({ ...values, page: String(next) }, "page"),
    refresh: () =>
      values && run({ ...values, page: String(page), force: "1" }, "refresh"),
  };
}
