"use client";

import { MapPin, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { LOCATION } from "@/lib/location";

/**
 * Facility address with a "Get Directions" chooser that lets the visitor pick
 * between Google Maps and Apple Maps.
 */
export function LocationDirections() {
  return (
    <div className="flex items-start gap-3 text-sm">
      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div>
        <p className="font-medium text-foreground">{LOCATION.name}</p>
        <p className="text-muted-foreground">{LOCATION.address}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Get Directions
              <ExternalLink className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem asChild>
              <a href={LOCATION.googleMapsUrl} target="_blank" rel="noreferrer">
                Open in Google Maps
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={LOCATION.appleMapsUrl} target="_blank" rel="noreferrer">
                Open in Apple Maps
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
