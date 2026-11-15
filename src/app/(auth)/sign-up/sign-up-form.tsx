"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Home, Loader2, Shovel } from "lucide-react";
import { Field, useIsClient } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/misc";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type SignUpRole = "HOMEOWNER" | "CLEANER";

const ROLE_OPTIONS: { value: SignUpRole; title: string; text: string; icon: typeof Home }[] = [
  { value: "HOMEOWNER", title: "I need snow cleared", text: "Book clearing for your driveway and sidewalk.", icon: Home },
  { value: "CLEANER", title: "I want to clear snow", text: "Post your hours and earn per job nearby.", icon: Shovel },
];

const subscribeNoop = () => () => {};
const roleFromUrl = (): SignUpRole => (new URLSearchParams(window.location.search).get("role") === "cleaner" ? "CLEANER" : "HOMEOWNER");

export function SignUpForm() {
  const router = useRouter();
  // The landing page links to /sign-up?role=cleaner. The server renders the homeowner
  // default; after hydration the URL decides, until the person picks a role themselves.
  const urlRole = useSyncExternalStore(subscribeNoop, roleFromUrl, () => "HOMEOWNER" as const);
  const [chosenRole, setRole] = useState<SignUpRole | null>(null);
  const role = chosenRole ?? urlRole;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Until React hydrates, a click would trigger a plain HTML form submit; keep the button disabled.
  const hydrated = useIsClient();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Choose how you&apos;ll use Snowber. Controller accounts are created by the operations team.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              setError(null);
              // The server ignores any role other than HOMEOWNER or CLEANER (see src/lib/auth.ts).
              const { error } = await authClient.signUp.email({ name, email, password, role });
              if (error) {
                setError(error.message ?? "We couldn't create that account.");
                return;
              }
              router.push("/dashboard");
              router.refresh();
            });
          }}
        >
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">I am…</legend>
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors",
                  role === option.value ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  className="sr-only"
                />
                <option.icon className="size-5 text-primary" aria-hidden />
                <span className="text-sm font-medium">{option.title}</span>
                <span className="text-xs text-muted-foreground">{option.text}</span>
              </label>
            ))}
          </fieldset>
          <Field label="Full name" htmlFor="name">
            <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="password" hint="At least 8 characters.">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
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
            Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
