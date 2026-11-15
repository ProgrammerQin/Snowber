// Zod schemas shared by forms (client) and server actions (server).
// The server always re-validates; client-side use is only for early feedback.

import { z } from "zod";
import { LOT_SIZES, PHOTO_KINDS, ROLES, TOOL_STATUSES, TOOL_TYPES } from "./domain";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../config";

const formBool = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());
const isoDate = z.iso.datetime({ message: "Pick a date and time" }).transform((s) => new Date(s));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));
const id = z.string().trim().min(1, "Missing id").max(64);

const HOUR = 60 * 60 * 1000;

export const propertySchema = z.object({
  label: optionalText(60),
  address: z.string().trim().min(5, "Enter the full street address").max(200),
  lotSize: z.enum(LOT_SIZES, { message: "Choose a lot size" }),
  hasSidewalk: formBool,
  notes: optionalText(500),
});

export const bookingSchema = z.object({
  propertyId: id,
  windowIds: z.array(id).min(1, "Pick at least one time window").max(8),
  includeSidewalk: formBool,
  includeSalt: formBool,
  tipCents: z.coerce.number().int().min(0).max(10000).default(0),
  notes: optionalText(500),
});
export type BookingInput = z.infer<typeof bookingSchema>;

export const windowSchema = z
  .object({
    label: optionalText(60),
    startsAt: isoDate,
    endsAt: isoDate,
    multiplierBps: z.coerce.number().int().min(5000, "Minimum 0.5×").max(30000, "Maximum 3×"),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((v) => v.endsAt.getTime() - v.startsAt.getTime() <= 6 * HOUR, {
    message: "Windows can be at most 6 hours long",
    path: ["endsAt"],
  });

export const shiftSchema = z
  .object({ startsAt: isoDate, endsAt: isoDate })
  .refine((v) => v.endsAt > v.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((v) => v.endsAt.getTime() - v.startsAt.getTime() <= 12 * HOUR, {
    message: "Shifts can be at most 12 hours long",
    path: ["endsAt"],
  });

export const rentalRequestSchema = z
  .object({ toolId: id, startsAt: isoDate, endsAt: isoDate })
  .refine((v) => v.endsAt > v.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((v) => v.endsAt.getTime() - v.startsAt.getTime() <= 24 * HOUR, {
    message: "Rentals can be at most 24 hours long",
    path: ["endsAt"],
  });

export const toolSchema = z.object({
  name: z.string().trim().min(2, "Name the tool").max(80),
  type: z.enum(TOOL_TYPES, { message: "Choose a tool type" }),
  feeDollars: z.coerce.number().min(0).max(500).transform((d) => Math.round(d * 100)),
  notes: optionalText(300),
});

export const toolStatusSchema = z.object({ toolId: id, status: z.enum(TOOL_STATUSES) });

export const reviewSchema = z.object({
  jobId: id,
  rating: z.coerce.number().int().min(1, "Pick 1–5 stars").max(5, "Pick 1–5 stars"),
  comment: optionalText(1000),
});

export const disputeSchema = z.object({
  jobId: id,
  reason: z.string().trim().min(10, "Describe the problem in at least 10 characters").max(1000),
});

export const cleanerProfileSchema = z.object({
  phone: optionalText(30),
  homeAddress: optionalText(200),
  ownsBlower: formBool,
});

export const controllerAccountSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

export const roleChangeSchema = z.object({ userId: id, role: z.enum(ROLES) });

export const photoUploadSchema = z.object({
  jobId: id,
  kind: z.enum(PHOTO_KINDS),
  contentType: z.enum(ALLOWED_IMAGE_TYPES, { message: "Use a JPEG, PNG or WebP photo" }),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "Photos must be under 15 MB"),
});

export const photoFinalizeSchema = z.object({
  jobId: id,
  kind: z.enum(PHOTO_KINDS),
  key: z.string().min(1).max(300),
});

export const assignmentSchema = z.object({
  windowId: id,
  assignments: z.array(z.object({ jobId: id, cleanerId: id })).min(1).max(200),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}
