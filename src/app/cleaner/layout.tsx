import { AppShell } from "@/components/app-shell";

export default function CleanerLayout({ children }: LayoutProps<"/cleaner">) {
  return <AppShell role="CLEANER">{children}</AppShell>;
}
