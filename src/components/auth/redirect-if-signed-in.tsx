import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

/** Sends signed-in users away from the login and sign-up pages. Render inside <Suspense>. */
export async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/trips");
  return null;
}
