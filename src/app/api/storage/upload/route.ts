import { getLocalStorage } from "@/lib/storage";
import { LocalStorage } from "@/lib/storage/local";
import { verify } from "@/lib/storage/signing";

// Local storage driver only: accepts the browser's PUT to a signed upload URL,
// the same way DigitalOcean Spaces accepts a presigned PUT.

export async function PUT(request: Request) {
  const storage = getLocalStorage();
  if (!storage) return new Response("Not found", { status: 404 });

  const params = new URL(request.url).searchParams;
  const key = params.get("key") ?? "";
  const contentType = params.get("ct") ?? "";
  const exp = Number(params.get("exp"));
  const max = Number(params.get("max"));

  if (!verify(LocalStorage.uploadPayload(key, contentType, exp, max), params.get("sig"))) {
    return new Response("Invalid signature", { status: 403 });
  }
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return new Response("Upload URL expired", { status: 403 });
  if ((request.headers.get("content-type") ?? "") !== contentType) {
    return new Response("Content-Type does not match the signed upload", { status: 400 });
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > max) return new Response("File too large", { status: 413 });

  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0) return new Response("Empty upload", { status: 400 });
  if (body.length > max) return new Response("File too large", { status: 413 });

  await storage.putObject(key, body);
  return new Response(null, { status: 200 });
}
