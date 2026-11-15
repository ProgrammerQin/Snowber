import { AppShell } from "@/components/app-shell";

export default function ControllerLayout({ children }: LayoutProps<"/controller">) {
  return (
    <AppShell role="CONTROLLER" wide>
      {children}
    </AppShell>
  );
}
