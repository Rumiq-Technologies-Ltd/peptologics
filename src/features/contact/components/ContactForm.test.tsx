import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContactForm } from "@/features/contact/components/ContactForm";

/**
 * The contact form, tested the way a visitor meets it: through labels, roles and
 * the keyboard rather than class names.
 */

vi.mock("@/lib/env.client", () => ({ contactEmail: "hello@peptologics.com" }));

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Ada Lovelace");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Message"), "Do you have the 10 mg vial in stock?");
}

function lastRequestBody(): Record<string, unknown> {
  const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("ContactForm", () => {
  it("labels every field and the submit button", () => {
    render(<ContactForm />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });

  it("keeps the honeypot away from keyboard and screen-reader users", () => {
    render(<ContactForm />);

    const honeypot = document.getElementById("leave-blank-field");

    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("shows a specific error for each empty field and sends nothing", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText(/Enter a valid email address|Enter your email/)).toBeInTheDocument();
    expect(screen.getByText(/at least 10 characters|Enter your message/)).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the fields with the honeypot and an elapsed time, then shows success", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { success: true, message: "ok", data: {} }));
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Your message has been sent.");
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contact",
      expect.objectContaining({ method: "POST" }),
    );
    expect(lastRequestBody()).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Do you have the 10 mg vial in stock?",
      honeypot: "",
    });
    expect(typeof lastRequestBody().formElapsedMs).toBe("number");
  });

  it("shows Sending… and blocks a second submit while the request is in flight", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (resolveFetch = resolve)));
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    const sending = await screen.findByRole("button", { name: "Sending…" });
    expect(sending).toBeDisabled();

    resolveFetch(jsonResponse(201, { success: true, message: "ok", data: {} }));
    await screen.findByRole("status");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("can be completed and submitted from the keyboard alone", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { success: true, message: "ok", data: {} }));
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.tab();
    expect(screen.getByLabelText("Name")).toHaveFocus();
    await user.keyboard("Ada Lovelace");
    await user.tab();
    expect(screen.getByLabelText("Email")).toHaveFocus();
    await user.keyboard("ada@example.com");
    await user.tab();
    expect(screen.getByLabelText("Message")).toHaveFocus();
    await user.keyboard("Do you have the 10 mg vial in stock?");
    // The honeypot is skipped: the next stop is the button.
    await user.tab();
    expect(screen.getByRole("button", { name: "Send message" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("points at the email address, and keeps what was typed, when sending fails", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, {
        success: false,
        message: "We couldn't send your message.",
        code: "UNEXPECTED",
      }),
    );
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    const alert = await screen.findByRole("alert");
    await waitFor(() =>
      expect(alert).toHaveTextContent(
        "We couldn't send your message. Please email us at hello@peptologics.com.",
      ),
    );
    expect(screen.getByLabelText("Message")).toHaveValue("Do you have the 10 mg vial in stock?");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the same fallback when the network fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Please email us at hello@peptologics.com.",
      ),
    );
  });

  it("shows the server's wait message when rate limited", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, {
        success: false,
        message: "Please wait a few minutes.",
        code: "RATE_LIMITED",
      }),
    );
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Please wait a few minutes."),
    );
  });

  it("maps a server field error onto its field", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        success: false,
        message: "Please check the highlighted fields and try again.",
        code: "VALIDATION_FAILED",
        errors: [
          { field: "email", message: "Enter a valid email address, for example name@example.com." },
        ],
      }),
    );
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      /Enter a valid email address/,
    );
  });
});
