import { z } from "zod";

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
