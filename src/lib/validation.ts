import { z } from "zod";

import {
  MAX_CENTS,
  SPLIT_TYPES,
  formatCents,
  parseBasisPoints,
  parseCents,
} from "./splits";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters.")
  .max(20, "Username must be at most 20 characters.")
  .regex(/^[a-z0-9_]+$/, "Use only letters, numbers and underscores.");

export const signupSchema = z
  .object({
    username: usernameSchema,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password must be at most 128 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password.").max(128),
});

const optionalDate = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.iso.date("Enter a valid date.").nullable());

export const tripSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Give your trip a name.")
      .max(80, "Keep the name under 80 characters."),
    destination: z
      .string()
      .trim()
      .max(120, "Keep the destination under 120 characters.")
      .transform((v) => v || null),
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .refine((t) => !t.startDate || !t.endDate || t.startDate <= t.endDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export const inviteSchema = z.object({
  tripId: z.uuid(),
  username: usernameSchema,
});

const cents = z
  .string()
  .transform((v, ctx) => {
    const c = parseCents(v);
    if (c === null) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 12.50." });
      return z.NEVER;
    }
    return c;
  })
  .pipe(
    z
      .number()
      .min(1, "Amount must be more than $0.")
      .max(MAX_CENTS, `Keep amounts under ${formatCents(MAX_CENTS)}.`),
  );

const expenseItemSchema = z
  .object({
    description: z
      .string()
      .trim()
      .max(80, "Keep the description under 80 characters.")
      .transform((v) => v || null),
    amount: cents,
    splitType: z.enum(SPLIT_TYPES),
    // For even/full splits the value is ignored; otherwise it's the amount,
    // percentage or share count entered for that person (blank = left out).
    participants: z
      .array(z.object({ userId: z.uuid(), value: z.string().max(20) }))
      .max(100),
  })
  .transform((item, ctx) => {
    const participants: { userId: string; weight: number }[] = [];
    for (const p of item.participants) {
      if (item.splitType === "even" || item.splitType === "full") {
        participants.push({ userId: p.userId, weight: 1 });
        continue;
      }
      if (!p.value.trim()) continue;
      const weight =
        item.splitType === "exact"
          ? parseCents(p.value)
          : item.splitType === "percent"
            ? parseBasisPoints(p.value)
            : /^\d{1,4}$/.test(p.value.trim())
              ? Number(p.value.trim())
              : null;
      if (weight === null) {
        ctx.addIssue({
          code: "custom",
          path: ["split"],
          message:
            item.splitType === "shares"
              ? "Shares must be whole numbers."
              : item.splitType === "percent"
                ? "Enter percentages like 33.33."
                : "Enter amounts like 12.50.",
        });
        return z.NEVER;
      }
      if (weight > 0) participants.push({ userId: p.userId, weight });
    }

    const ids = new Set(participants.map((p) => p.userId));
    const total = participants.reduce((sum, p) => sum + p.weight, 0);
    const issue = (message: string) => {
      ctx.addIssue({ code: "custom", path: ["split"], message });
      return z.NEVER;
    };
    if (ids.size !== participants.length)
      return issue("Each person can only appear once.");
    if (participants.length === 0)
      return issue("Choose who this is split between.");
    if (item.splitType === "full" && participants.length !== 1)
      return issue("Choose the one person who covers it.");
    if (item.splitType === "exact" && total !== item.amount)
      return issue(
        `Amounts add up to ${formatCents(total)}, not ${formatCents(item.amount)}.`,
      );
    if (item.splitType === "percent" && total !== 10_000)
      return issue(`Percentages add up to ${total / 100}%, not 100%.`);

    return {
      description: item.description,
      amountCents: item.amount,
      splitType: item.splitType,
      participants,
    };
  });

export const expenseSchema = z
  .object({
    tripId: z.uuid(),
    title: z
      .string()
      .trim()
      .min(1, "Say what this expense was for.")
      .max(80, "Keep the title under 80 characters."),
    paidById: z.uuid("Choose who paid."),
    items: z
      .array(expenseItemSchema)
      .min(1, "Add at least one item.")
      .max(50, "Keep it to 50 items or fewer."),
  })
  .refine(
    (e) => e.items.reduce((sum, i) => sum + i.amountCents, 0) <= MAX_CENTS,
    {
      message: `Keep the total under ${formatCents(MAX_CENTS)}.`,
      path: ["items"],
    },
  );

export type ExpenseInput = z.output<typeof expenseSchema>;

/** Shape returned by form Server Actions to `useActionState`. */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
  success?: string;
};

export function fieldErrorsOf(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<
    string,
    string[] | undefined
  >;
}

/** Field errors keyed by their full path, e.g. `items.0.amount`. */
export function issuesByPath(error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}
