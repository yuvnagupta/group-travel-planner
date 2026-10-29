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

const isoDate = z.iso.date("Enter a valid date.");
const count = (min: number, max: number, label: string) =>
  z.coerce
    .number()
    .int()
    .min(min, `${label}: at least ${min}.`)
    .max(max, `${label}: at most ${max}.`);

export const flightSearchSchema = z
  .object({
    origin: z
      .string()
      .regex(/^[A-Z]{3}$/, "Pick a departure airport or city from the list."),
    destination: z
      .string()
      .regex(/^[A-Z]{3}$/, "Pick an arrival airport or city from the list."),
    departureDate: isoDate,
    returnDate: z
      .string()
      .trim()
      .transform((v) => v || null)
      .pipe(isoDate.nullable()),
    adults: count(1, 9, "Travelers"),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
  })
  .refine((s) => s.origin !== s.destination, {
    message: "Departure and arrival must be different.",
    path: ["destination"],
  })
  .refine((s) => !s.returnDate || s.returnDate >= s.departureDate, {
    message: "Return must be on or after departure.",
    path: ["returnDate"],
  });

export const hotelSearchSchema = z
  .object({
    latitude: z.coerce
      .number({ error: "Pick a city from the list." })
      .min(-90)
      .max(90),
    longitude: z.coerce
      .number({ error: "Pick a city from the list." })
      .min(-180)
      .max(180),
    checkInDate: isoDate,
    checkOutDate: isoDate,
    adults: count(1, 9, "Guests"),
    rooms: count(1, 5, "Rooms"),
  })
  .refine((s) => s.checkOutDate > s.checkInDate, {
    message: "Check-out must be after check-in.",
    path: ["checkOutDate"],
  })
  .refine((s) => s.rooms <= s.adults, {
    message: "Each room needs at least one guest.",
    path: ["rooms"],
  });

export const suggestSchema = z.object({
  tripId: z.uuid(),
  kind: z.enum(["flight", "hotel"]),
  payload: z.string().max(20_000),
  signature: z.string().max(200),
  note: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters.")
    .transform((v) => v || null),
});

export const commentSchema = z.object({
  suggestionId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Write a comment first.")
    .max(1000, "Keep comments under 1000 characters."),
});
