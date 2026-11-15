import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

// Static page: the form reads ?role=cleaner itself after hydration, so it is never
// swapped out for a streamed copy while someone is typing.
export default function SignUpPage() {
  return <SignUpForm />;
}
