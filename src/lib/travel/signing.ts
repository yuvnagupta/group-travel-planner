import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { Signed } from "./types";

function getSecret() {
  const secret = process.env.SUGGESTION_SIGNING_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUGGESTION_SIGNING_SECRET must be set in production.");
  }
  // Development fallback: results stop verifying when the dev server restarts.
  return (globalThis.__devSigningSecret ??= randomBytes(32).toString("hex"));
}

declare global {
  var __devSigningSecret: string | undefined;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function signOption<T>(kind: string, option: T): Signed<T> {
  const payload = JSON.stringify({ kind, option });
  return { option, payload, signature: sign(payload) };
}

/** Returns the option if the payload was signed by this server for that kind, otherwise null. */
export function verifyOption<T>(
  kind: string,
  payload: string,
  signature: string,
): T | null {
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;

  const parsed = JSON.parse(payload) as { kind: string; option: T };
  return parsed.kind === kind ? parsed.option : null;
}
