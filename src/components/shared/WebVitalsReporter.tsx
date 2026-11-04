"use client";

import { useReportWebVitals } from "next/web-vitals";

import type { WebVitalReport } from "@/lib/validations/webVitals.schema";

/**
 * Sends each real visitor's Core Web Vitals to `POST /api/vitals` (ADR-031).
 *
 * Renders nothing. `sendBeacon` is used because LCP, CLS and INP are often only final
 * when the visitor leaves the page, and a beacon survives the page unloading where a
 * normal `fetch` would be cancelled. `fetch` with `keepalive` is the fallback for the
 * rare browser without it.
 *
 * Only the path is sent — never the query string, which could carry anything.
 */

const VITALS_ENDPOINT = "/api/vitals";

type NextWebVitalsMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

/**
 * Defined at module level so the callback identity never changes: the hook
 * re-subscribes whenever it does, which would double-report every metric.
 */
function sendWebVital(metric: NextWebVitalsMetric): void {
  // Next also reports its own custom timings; only the standard metrics are wanted.
  if (!("rating" in metric) || !metric.rating) return;

  const report: WebVitalReport = {
    name: metric.name as WebVitalReport["name"],
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    pathname: window.location.pathname,
  };

  const body = JSON.stringify(report);

  if (navigator.sendBeacon?.(VITALS_ENDPOINT, new Blob([body], { type: "application/json" }))) {
    return;
  }

  void fetch(VITALS_ENDPOINT, {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "application/json" },
  }).catch(() => {
    // Losing one speed sample is not worth surfacing to a visitor, or retrying.
  });
}

export function WebVitalsReporter(): null {
  useReportWebVitals(sendWebVital);
  return null;
}
