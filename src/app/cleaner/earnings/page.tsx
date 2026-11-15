import type { Metadata } from "next";
import { Suspense } from "react";
import { Banknote } from "lucide-react";
import { payoutAction } from "@/app/actions/cleaner";
import { ActionButton } from "@/components/forms";
import { EmptyState, PageHeader, PageSkeleton, Stat } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { autoConfirmStale } from "@/lib/dal/jobs";
import { getMyLedger } from "@/lib/dal/ledger";
import { requireRole } from "@/lib/dal/session";
import { formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Earnings" };

const TYPE_LABEL = { EARNING: "Job", RENTAL_FEE: "Tool rental", PAYOUT: "Payout", ADJUSTMENT: "Adjustment" } as const;

export default function EarningsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Earnings" description="You keep 80% of each job plus 100% of tips. Tool rental fees are deducted when approved." />
      <Suspense fallback={<PageSkeleton rows={2} />}>
        <Earnings />
      </Suspense>
    </div>
  );
}

async function Earnings() {
  const user = await requireRole("CLEANER");
  await autoConfirmStale();
  const ledger = await getMyLedger(user);
  const pendingTotal = ledger.pending.reduce((sum, j) => sum + j.expectedCents, 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Available balance" value={formatMoney(ledger.balanceCents)} />
        <Stat label="Waiting for confirmation" value={formatMoney(pendingTotal)} hint={`${ledger.pending.length} job(s)`} />
        <div className="flex items-center rounded-xl border bg-card p-4">
          <ActionButton
            action={payoutAction}
            size="lg"
            className="w-full"
            disabled={ledger.balanceCents <= 0}
            confirm={{
              title: `Pay out ${formatMoney(ledger.balanceCents)}?`,
              description: "In this version payouts are simulated; no real money moves.",
              confirmLabel: "Pay out",
            }}
          >
            <Banknote aria-hidden /> Pay out balance
          </ActionButton>
        </div>
      </div>

      {ledger.pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for the homeowner</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {ledger.pending.map((job) => (
                <li key={job.id} className="flex justify-between gap-2">
                  <span>
                    {job.property.address} {job.status === "DISPUTED" && <Badge variant="destructive">Disputed</Badge>}
                  </span>
                  <span className="tabular-nums">{formatMoney(job.expectedCents)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.entries.length === 0 ? (
            <EmptyState title="Nothing here yet">Finished jobs appear here once the homeowner confirms.</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</TableCell>
                    <TableCell>{TYPE_LABEL[entry.type]}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell className={`text-right tabular-nums ${entry.amountCents < 0 ? "text-destructive" : "text-success"}`}>
                      {entry.amountCents > 0 ? "+" : ""}
                      {formatMoney(entry.amountCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
