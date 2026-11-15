import { AppShell } from "@/components/app-shell";

export default function HomeownerLayout({ children }: LayoutProps<"/homeowner">) {
  return <AppShell role="HOMEOWNER">{children}</AppShell>;
}
