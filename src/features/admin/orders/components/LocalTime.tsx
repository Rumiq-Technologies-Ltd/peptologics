"use client";

import { useSyncExternalStore } from "react";

interface LocalTimeProps {
  /** ISO 8601, UTC, as stored. */
  value: string;
  className?: string;
}

const noopSubscribe = (): (() => void) => () => undefined;

const LOCAL_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

const UTC_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** "28 Nov 2026, 4:29 PM PKT": the viewer's own zone, with its short name. */
export function formatLocalTime(value: string): string {
  return LOCAL_FORMAT.format(new Date(value)).replace(/\b(am|pm)\b/, (marker) =>
    marker.toUpperCase(),
  );
}

/** What the server renders: the UTC time, so the first paint is identical on both sides. */
export function formatUtcTime(value: string): string {
  return `${UTC_FORMAT.format(new Date(value))} UTC`;
}

/**
 * A timestamp shown in the viewer's own time zone (D41: the business zone is not recorded).
 * The server and the first client render both show UTC inside a `<time dateTime>`, and the
 * browser then switches to local time, so there is no hydration mismatch. The exact UTC time
 * is always in the tooltip.
 */
export function LocalTime({ value, className }: LocalTimeProps) {
  const inBrowser = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return (
    <time dateTime={value} title={`${value} (UTC)`} className={className}>
      {inBrowser ? formatLocalTime(value) : formatUtcTime(value)}
    </time>
  );
}
