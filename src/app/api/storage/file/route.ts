import { contentTypeForKey, getLocalStorage } from "@/lib/storage";
import { LocalStorage } from "@/lib/storage/local";
import { verify } from "@/lib/storage/signing";

// Local storage driver only: serves an object for a signed, expiring download URL.

export async function GET(request: Request) {
  const storage = getLocalStorage();
  if (!storage) return new Response("Not found", { status: 404 });

  const params = new URL(request.url).searchParams;
  const key = params.get("key") ?? "";
  const exp = Number(params.get("exp"));
  if (!verify(LocalStorage.downloadPayload(key, exp), params.get("sig"))) {
    return new Response("Invalid signature", { status: 403 });
  }
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return new Response("Link expired", { status: 403 });

  try {
    const body = await storage.getObject(key);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
