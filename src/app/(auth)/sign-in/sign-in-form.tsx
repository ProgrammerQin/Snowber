"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Field, useIsClient } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/misc";
import { authClient } from "@/lib/auth-client";
import { DEMO_LOGINS_ENABLED } from "@/lib/config";

// Seeded demo accounts (see prisma/seed.ts). The quick-fill buttons are the
// development "role switcher"; set NEXT_PUBLIC_DEMO_LOGINS=false to hide them.
const DEMO_ACCOUNTS = [
  { label: "Controller", email: "controller@snowber.test" },
  { label: "Cleaner (Ava)", email: "ava.cleaner@snowber.test" },
  { label: "Cleaner (Ben)", email: "ben.cleaner@snowber.test" },
  { label: "Homeowner (Grace)", email: "grace.home@snowber.test" },
];
const DEMO_PASSWORD = "snowber-demo";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Until React hydrates, a click would trigger a plain HTML form submit; keep the button disabled.
  const hydrated = useIsClient();

  const signIn = (creds: { email: string; password: string }) =>
    startTransition(async () => {
      setError(null);
      const { error } = await authClient.signIn.email(creds);
      if (error) {
        setError(error.message ?? "Those details don't match an account.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back. Homeowners, cleaners and the controller all sign in here.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            signIn({ email, password });
          }}
        >
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" disabled={pending || !hydrated}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Sign in
          </Button>
        </form>

        {DEMO_LOGINS_ENABLED && (
          <div className="mt-6 rounded-lg border border-dashed p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Demo accounts (seed data)</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending || !hydrated}
                  onClick={() => signIn({ email: account.email, password: DEMO_PASSWORD })}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        New here?&nbsp;
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </CardFooter>
    </Card>
  );
}
