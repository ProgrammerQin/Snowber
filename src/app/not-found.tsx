import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="text-muted-foreground">It may have moved, or you may not have access to it.</p>
      <Button asChild>
        <Link href="/dashboard">Go to my dashboard</Link>
      </Button>
    </div>
  );
}
