import { unstable_rethrow } from "next/navigation";
import { AppError } from "./errors";

/** What every server action returns to the client. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string };

/**
 * Runs a server action body, converting business errors into `{ ok: false }`
 * while letting Next.js control-flow errors (redirect, notFound) pass through.
 */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) return { ok: false, error: error.message };
    console.error("[action] unexpected error", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Converts FormData into a plain object; repeated keys become arrays. */
export function formToObject(formData: FormData, arrayKeys: readonly string[] = []): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = formData.getAll(key).map((v) => (typeof v === "string" ? v : v.name));
    result[key] = arrayKeys.includes(key) ? values : values[values.length - 1];
  }
  for (const key of arrayKeys) if (!(key in result)) result[key] = [];
  return result;
}
