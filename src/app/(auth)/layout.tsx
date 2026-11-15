import Link from "next/link";
import { Snowflake } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-secondary to-background px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 text-xl font-semibold text-primary">
        <Snowflake className="size-6" aria-hidden /> Snowber
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
