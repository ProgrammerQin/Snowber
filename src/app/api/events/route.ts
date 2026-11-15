import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isRole } from "@/lib/contracts/domain";
import { canReceive, subscribe, toClientEvent } from "@/lib/events";

// Server-Sent Events stream (advanced feature: real-time functionality).
// Each signed-in browser tab holds one connection. Events are filtered per user:
// homeowners only hear about their own jobs, cleaners about their assignments,
// controllers about everything. Requires a long-lived Node.js server (`next start`).

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const user = { id: session.user.id, role: isRole(session.user.role) ? session.user.role : "HOMEOWNER" };

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      send("retry: 3000\n\n");
      send("event: ready\ndata: {}\n\n");

      const unsubscribe = subscribe((event) => {
        if (canReceive(user, event)) send(`event: ${event.type}\ndata: ${JSON.stringify(toClientEvent(event))}\n\n`);
      });
      // Comment lines keep proxies from closing an idle connection.
      const keepAlive = setInterval(() => send(": keep-alive\n\n"), 20_000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
