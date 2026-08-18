import { Clock } from "lucide-react";

interface RateScheduleProps {
  offPeakPrice: number;
  peakPrice: number;
}

/**
 * Neutral, non-interactive presentation of peak vs off-peak hourly rates.
 * Uses a day timeline + a legend so it reads as an informational schedule
 * rather than two clickable (and emotionally-charged) pricing options.
 */
export function RateSchedule({ offPeakPrice, peakPrice }: RateScheduleProps) {
  const savings = peakPrice - offPeakPrice;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/50 px-6 py-7 sm:px-8">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Hourly Rates
        </h3>
      </div>

      {/* Day timeline */}
      <div className="mt-6 space-y-2">
        <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden="true">
          <div className="flex-[4] bg-muted-foreground/25" />
          <div className="flex-[6] bg-muted-foreground/55" />
          <div className="flex-[2] bg-muted-foreground/25" />
        </div>
        <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
          <span>12 PM</span>
          <span>4 PM</span>
          <span>10 PM</span>
          <span>12 AM</span>
        </div>
      </div>

      {/* Rate legend */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full bg-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium">Off-Peak</p>
              <p className="text-xs text-muted-foreground">12–4 PM &amp; 10 PM–12 AM</p>
            </div>
          </div>
          <p className="text-lg font-semibold tabular-nums">
            £{offPeakPrice}
            <span className="text-xs font-normal text-muted-foreground">/hr</span>
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full bg-muted-foreground/55" />
            <div>
              <p className="text-sm font-medium">Peak</p>
              <p className="text-xs text-muted-foreground">4–10 PM</p>
            </div>
          </div>
          <p className="text-lg font-semibold tabular-nums">
            £{peakPrice}
            <span className="text-xs font-normal text-muted-foreground">/hr</span>
          </p>
        </div>
      </div>

      {savings > 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Book off-peak and save{" "}
          <span className="font-medium text-foreground">£{savings}/hr</span>.
        </p>
      )}
    </div>
  );
}
