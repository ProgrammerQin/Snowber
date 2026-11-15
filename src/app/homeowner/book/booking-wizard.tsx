"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { bookJobAction, quoteAction } from "@/app/actions/homeowner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/misc";
import { Textarea } from "@/components/ui/textarea";
import { formatMinutes, formatMoney, formatMultiplier } from "@/lib/format";
import type { Quote } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type PropertyOption = { id: string; title: string; subtitle: string; hasSidewalk: boolean };
type WindowOption = { id: string; label: string; when: string; multiplier: string | null };

const STEPS = ["Property", "Time & extras", "Review"] as const;
const TIPS = [0, 500, 1000];

export function BookingWizard({
  properties,
  windows,
  initialPropertyId,
}: {
  properties: PropertyOption[];
  windows: WindowOption[];
  initialPropertyId: string;
}) {
  const [step, setStep] = useState(0);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [windowIds, setWindowIds] = useState<string[]>([]);
  const property = properties.find((p) => p.id === propertyId)!;
  const [includeSidewalk, setIncludeSidewalk] = useState(property.hasSidewalk);
  const [includeSalt, setIncludeSalt] = useState(false);
  const [tipCents, setTipCents] = useState(0);
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [booking, startBooking] = useTransition();
  const [quoting, startQuoting] = useTransition();

  // The price shown is always computed on the server from the rate card.
  useEffect(() => {
    if (step !== 2) return;
    startQuoting(async () => {
      const result = await quoteAction({ propertyId, windowIds, includeSidewalk: property.hasSidewalk && includeSidewalk, includeSalt });
      if (result.ok && result.data) {
        setQuote(result.data);
        setQuoteError(null);
      } else {
        setQuote(null);
        setQuoteError(result.ok ? "Could not price this booking." : result.error);
      }
    });
  }, [step, propertyId, windowIds, includeSidewalk, includeSalt, property.hasSidewalk]);

  const toggleWindow = (id: string) =>
    setWindowIds((current) => (current.includes(id) ? current.filter((w) => w !== id) : [...current, id]));

  const canContinue = step === 0 ? Boolean(propertyId) : step === 1 ? windowIds.length > 0 : Boolean(quote);

  const book = () =>
    startBooking(async () => {
      const result = await bookJobAction({
        propertyId,
        windowIds,
        includeSidewalk: property.hasSidewalk && includeSidewalk,
        includeSalt,
        tipCents,
        notes,
      });
      if (result && !result.ok) toast.error(result.error);
    });

  return (
    <div className="grid gap-5">
      <ol className="flex gap-2" aria-label="Booking steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              i === step ? "border-primary bg-primary/5 font-medium text-primary" : i < step ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", i <= step ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="grid gap-4">
          {step === 0 && (
            <fieldset className="grid gap-3">
              <legend className="mb-1 font-medium">Which property?</legend>
              {properties.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
                    propertyId === p.id ? "border-primary bg-primary/5 ring-2 ring-primary/25" : "hover:bg-accent",
                  )}
                >
                  <input
                    type="radio"
                    name="property"
                    className="mt-1 size-4 accent-primary"
                    checked={propertyId === p.id}
                    onChange={() => {
                      setPropertyId(p.id);
                      setIncludeSidewalk(p.hasSidewalk);
                    }}
                  />
                  <span>
                    <span className="block font-medium">{p.title}</span>
                    <span className="text-sm text-muted-foreground">{p.subtitle}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {step === 1 && (
            <>
              <fieldset className="grid gap-2">
                <legend className="mb-1 font-medium">When can we come?</legend>
                <p className="mb-2 text-sm text-muted-foreground">
                  Pick every window that works. More choices make it easier to match you with a nearby cleaner. You pay the price
                  of the most expensive window you pick, and get the difference back if we schedule a cheaper one.
                </p>
                {windows.map((w) => (
                  <label
                    key={w.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                      windowIds.includes(w.id) ? "border-primary bg-primary/5" : "hover:bg-accent",
                    )}
                  >
                    <Checkbox checked={windowIds.includes(w.id)} onCheckedChange={() => toggleWindow(w.id)} aria-label={w.when} />
                    <span className="flex-1">
                      <span className="block font-medium">{w.label}</span>
                      {w.label !== w.when && <span className="text-sm text-muted-foreground">{w.when}</span>}
                    </span>
                    {w.multiplier && <span className="rounded bg-warning/20 px-2 py-0.5 text-xs font-medium text-amber-800">{w.multiplier} price</span>}
                  </label>
                ))}
              </fieldset>
              <Separator />
              <fieldset className="grid gap-3">
                <legend className="mb-1 font-medium">Extras</legend>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="sidewalk"
                    checked={property.hasSidewalk && includeSidewalk}
                    disabled={!property.hasSidewalk}
                    onCheckedChange={(v) => setIncludeSidewalk(v === true)}
                  />
                  <Label htmlFor="sidewalk">
                    Clear the public sidewalk too{!property.hasSidewalk && " (no sidewalk at this property)"}
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox id="salt" checked={includeSalt} onCheckedChange={(v) => setIncludeSalt(v === true)} />
                  <Label htmlFor="salt">Spread salt on walkways</Label>
                </div>
              </fieldset>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes for the cleaner (optional)</Label>
                <Textarea id="notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <div>
                <p className="font-medium">{property.title}</p>
                <p className="text-sm text-muted-foreground">
                  {windowIds.length} window{windowIds.length === 1 ? "" : "s"}:{" "}
                  {windows
                    .filter((w) => windowIds.includes(w.id))
                    .map((w) => w.when)
                    .join("; ")}
                </p>
              </div>
              {quoting && !quote && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Pricing…
                </p>
              )}
              {quoteError && <p className="text-sm text-destructive">{quoteError}</p>}
              {quote && (
                <Card className="gap-3 bg-muted/40 py-4 shadow-none">
                  <CardHeader className="px-4">
                    <CardTitle className="text-base">Price</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-1.5 px-4 text-sm">
                    <Row label="Driveway" value={formatMoney(quote.baseCents)} />
                    {quote.addOnsCents > 0 && <Row label="Extras" value={formatMoney(quote.addOnsCents)} />}
                    {quote.multiplierBps !== 10000 && <Row label="Busy-window rate" value={formatMultiplier(quote.multiplierBps)} />}
                    <Row label="Estimated time" value={formatMinutes(quote.estMinutes)} />
                    <Separator className="my-1" />
                    <fieldset className="flex flex-wrap items-center justify-between gap-2">
                      <legend className="sr-only">Tip</legend>
                      <span>Tip for your cleaner</span>
                      <span className="flex gap-1">
                        {TIPS.map((tip) => (
                          <Button key={tip} type="button" size="sm" variant={tipCents === tip ? "default" : "outline"} onClick={() => setTipCents(tip)}>
                            {tip === 0 ? "None" : formatMoney(tip)}
                          </Button>
                        ))}
                      </span>
                    </fieldset>
                    <Separator className="my-1" />
                    <Row label="Total charged now" value={formatMoney(quote.totalCents + tipCents)} strong />
                    <p className="text-xs text-muted-foreground">
                      Payments are simulated in this version. Cancel any time before the job starts for a full refund.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || booking}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        {step < 2 ? (
          <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
            Continue <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button size="lg" onClick={book} disabled={!canContinue || booking || quoting}>
            {booking && <Loader2 className="animate-spin" aria-hidden />}
            Confirm booking
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "text-base font-semibold")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
