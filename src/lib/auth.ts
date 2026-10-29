import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { validateSession } from "./session";

export type User = { id: string; username: string };

/** The signed-in user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<User | null> =>
  validateSession(),
);

/** The signed-in user; redirects to the login page when signed out. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
