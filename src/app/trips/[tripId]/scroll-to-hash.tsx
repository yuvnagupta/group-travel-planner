"use client";

import { useEffect } from "react";

/**
 * Scrolls to the URL's #section once the trip streams in. Links like
 * `/trips/:id#expenses` otherwise land at the top, because the target
 * doesn't exist yet when the navigation finishes.
 */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return null;
}
