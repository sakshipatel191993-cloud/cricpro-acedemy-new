"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { dateToISO } from "@/lib/time";

interface DatePickerProps {
  id?: string;
  /** Selected date as `YYYY-MM-DD`, or empty string. */
  value: string;
  /** Called with the new `YYYY-MM-DD` value (or "" if cleared). */
  onChange: (value: string) => void;
}

export function DatePicker({ id, value, onChange }: DatePickerProps) {
  // Midnight today — past dates are disabled visually on every platform,
  // including iOS where the native date input ignores `min`.
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "h-10 w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
          {value ? format(new Date(`${value}T00:00:00`), "EEE, d MMM yyyy") : "Select date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => onChange(day ? dateToISO(day) : "")}
          disabled={(date) => date < today}
          startMonth={today}
          defaultMonth={selected ?? today}
        />
      </PopoverContent>
    </Popover>
  );
}
