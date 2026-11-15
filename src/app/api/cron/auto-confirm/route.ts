import { autoConfirmStale } from "@/lib/dal/jobs";

// Confirms jobs that have been "awaiting confirmation" for 24 hours.
// Call it from any scheduler (cron, GitHub Actions, DigitalOcean Functions):
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/auto-confirm
// The controller overview page also runs the same check whenever it loads.

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const confirmed = await autoConfirmStale();
  return Response.json({ confirmed });
}
