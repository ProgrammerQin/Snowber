import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/page";
import { Stars } from "@/components/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/dal/session";
import { listUsers } from "@/lib/dal/users";
import { ControllerAccountForm, RoleSelect } from "./user-forms";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Users" description="Homeowners and cleaners sign up themselves. Only controllers can create controller accounts." />
      <Suspense fallback={<PageSkeleton rows={2} />}>
        <Users />
      </Suspense>
    </>
  );
}

async function Users() {
  const me = await requireRole("CONTROLLER");
  const users = await listUsers(me);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead className="w-44">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <Stars rating={u.rating?.average} count={u.rating?.count} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.role === "CLEANER"
                      ? `${u._count.jobsAsCleaner} jobs${u.ownsBlower ? " · owns blower" : ""}`
                      : u.role === "HOMEOWNER"
                        ? `${u._count.properties} properties · ${u._count.jobsAsHomeowner} bookings`
                        : "—"}
                  </TableCell>
                  <TableCell>{u.id === me.id ? <span className="text-sm">Controller (you)</span> : <RoleSelect userId={u.id} role={u.role} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>New controller account</CardTitle>
          <CardDescription>Share the temporary password with them privately.</CardDescription>
        </CardHeader>
        <CardContent>
          <ControllerAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
