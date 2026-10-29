"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  hashPassword,
  verifyAgainstDummy,
  verifyPassword,
} from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import {
  fieldErrorsOf,
  loginSchema,
  signupSchema,
  type FormState,
} from "@/lib/validation";

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed/.test(String(error.cause ?? error.message))
  );
}

export async function signup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { username: String(formData.get("username") ?? "") };
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const { username, password } = parsed.data;
  let userId: string;
  try {
    const [user] = await db
      .insert(users)
      .values({ username, passwordHash: await hashPassword(password) })
      .returning({ id: users.id });
    userId = user.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { fieldErrors: { username: ["That username is taken."] }, values };
    }
    throw error;
  }

  await createSession(userId);
  redirect("/trips");
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { username: String(formData.get("username") ?? "") };
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const { username, password } = parsed.data;
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.username, username));

  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyAgainstDummy(password);
  if (!user || !valid)
    return { error: "Incorrect username or password.", values };

  await createSession(user.id);
  redirect("/trips");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
