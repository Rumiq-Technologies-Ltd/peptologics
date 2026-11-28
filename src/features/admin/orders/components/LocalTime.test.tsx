import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  LocalTime,
  formatLocalTime,
  formatUtcTime,
} from "@/features/admin/orders/components/LocalTime";

const VALUE = "2026-11-28T11:29:00.000Z";

describe("LocalTime", () => {
  it("renders UTC on the server so the first paint matches the client's", () => {
    const html = renderToString(<LocalTime value={VALUE} />);

    expect(html).toMatch(/datetime="2026-11-28T11:29:00\.000Z"/i);
    expect(html).toContain("28 Nov 2026, 11:29 UTC");
  });

  it("switches to the viewer's own zone in the browser, keeping the exact UTC time in the tooltip", () => {
    render(<LocalTime value={VALUE} />);

    const time = document.querySelector("time") as HTMLTimeElement;
    expect(time).toHaveAttribute("datetime", VALUE);
    expect(time).toHaveAttribute("title", `${VALUE} (UTC)`);
    expect(time.textContent).toBe(formatLocalTime(VALUE));
    expect(screen.getByText(/28 Nov 2026/)).toBeInTheDocument();
  });

  it("formats with a 12-hour clock and a zone name", () => {
    expect(formatLocalTime(VALUE)).toMatch(/28 Nov 2026, \d{1,2}:\d{2} (AM|PM) \S+/);
    expect(formatUtcTime(VALUE)).toBe("28 Nov 2026, 11:29 UTC");
  });
});
