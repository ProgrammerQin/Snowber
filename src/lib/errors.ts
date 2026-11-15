// Business-rule errors. Server actions turn these into user-facing messages;
// anything else is logged and shown as a generic error.

export type AppErrorCode = "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: AppErrorCode = "INVALID",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const forbidden = (message = "You don't have access to that.") => new AppError(message, "FORBIDDEN");
export const notFound = (message = "We couldn't find that.") => new AppError(message, "NOT_FOUND");
export const conflict = (message: string) => new AppError(message, "CONFLICT");
export const invalid = (message: string) => new AppError(message, "INVALID");

/** PostgreSQL exclusion_violation (SQLSTATE 23P01), raised by the time-range constraints. */
export function isExclusionViolation(error: unknown, constraint?: string): boolean {
  const text = errorText(error);
  const matches = text.includes("23P01") || text.toLowerCase().includes("exclusion constraint") || text.includes("_no_overlap");
  return matches && (!constraint || text.includes(constraint) || !text.includes("_no_overlap"));
}

/** Prisma unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002" || errorText(error).includes("23505");
}

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const e = error as { message?: unknown; code?: unknown; meta?: unknown; cause?: unknown };
  return [e.message, e.code, safeJson(e.meta), safeJson(e.cause)].filter(Boolean).join(" ");
}

function safeJson(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
