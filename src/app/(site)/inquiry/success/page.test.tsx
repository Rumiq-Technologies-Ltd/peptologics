import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NO_EMAIL_SENT_NOTE } from "@/constants/messages";

const flags = vi.hoisted(() => ({ isEmailConfigured: true }));

vi.mock("@/lib/env", () => ({
  get isEmailConfigured() {
    return flags.isEmailConfigured;
  },
}));
vi.mock("@/lib/env.client", () => ({ contactEmail: "hello@peptologics.com" }));

async function renderPage() {
  const { default: Page } = await import("@/app/(site)/inquiry/success/page");
  const ui = await Page({ searchParams: Promise.resolve({ ref: "PL-001032" }) } as never);
  render(ui);
}

describe("inquiry success page", () => {
  beforeEach(() => vi.resetModules());

  it("adds the no-email note when email is not configured", async () => {
    flags.isEmailConfigured = false;
    await renderPage();
    expect(screen.getByText(NO_EMAIL_SENT_NOTE)).toBeInTheDocument();
  });

  it("omits the note when email is configured", async () => {
    flags.isEmailConfigured = true;
    await renderPage();
    expect(screen.queryByText(NO_EMAIL_SENT_NOTE)).not.toBeInTheDocument();
  });
});
