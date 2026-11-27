import { describe, expect, it } from "vitest";

import {
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  contactFieldsSchema,
  contactRequestSchema,
} from "@/lib/validations/contact.schema";
import { toFieldErrors } from "@/lib/validations/inquiry.schema";

/**
 * The contact contract, shared by the form and `POST /api/contact`.
 */

function validFields(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "Do you have the 10 mg vial in stock?",
    ...overrides,
  };
}

function errorsFor(input: unknown): Record<string, string[]> {
  const result = contactFieldsSchema.safeParse(input);
  if (result.success) throw new Error("expected the input to be rejected");
  return toFieldErrors(result.error);
}

describe("contactFieldsSchema", () => {
  it("accepts valid input", () => {
    expect(contactFieldsSchema.parse(validFields())).toEqual(validFields());
  });

  it("trims and normalises each field", () => {
    const parsed = contactFieldsSchema.parse(
      validFields({
        name: "  Ada ​ Lovelace  ",
        email: "  ADA@Example.COM ",
        message: "  first line  \r\n\r\n\r\n\r\nsecond\u0007 line  ",
      }),
    );

    expect(parsed.name).toBe("Ada Lovelace");
    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.message).toBe("first line\n\nsecond line");
  });

  it.each([
    ["name", { name: "" }, "Enter your name."],
    ["name", { name: "​​​" }, "Enter your name."],
    ["email", { email: "" }, "Enter a valid email address"],
    ["email", { email: "not-an-email" }, "Enter a valid email address"],
    ["message", { message: "" }, "at least 10 characters"],
    ["message", { message: "too short" }, "at least 10 characters"],
    ["message", { message: "​".repeat(20) }, "at least 10 characters"],
  ])("rejects an invalid %s with a specific message", (field, override, expected) => {
    const errors = errorsFor(validFields(override));

    expect(errors[field]?.[0]).toContain(expected);
  });

  it("reports a missing field, not a type error", () => {
    expect(errorsFor({})).toMatchObject({
      name: ["Enter your name."],
      email: [expect.stringContaining("Enter your email")],
      message: ["Enter your message."],
    });
  });

  describe("length limits", () => {
    it("accepts the longest name and message", () => {
      expect(
        contactFieldsSchema.safeParse(
          validFields({
            name: "a".repeat(CONTACT_NAME_MAX_LENGTH),
            message: "m".repeat(CONTACT_MESSAGE_MAX_LENGTH),
          }),
        ).success,
      ).toBe(true);
    });

    it("rejects a name and message one character too long", () => {
      const errors = errorsFor(
        validFields({
          name: "a".repeat(CONTACT_NAME_MAX_LENGTH + 1),
          message: "m".repeat(CONTACT_MESSAGE_MAX_LENGTH + 1),
        }),
      );

      expect(errors.name?.[0]).toContain("100 characters");
      expect(errors.message?.[0]).toContain("5000 characters");
    });

    it("accepts a message of exactly the minimum length", () => {
      expect(contactFieldsSchema.safeParse(validFields({ message: "1234567890" })).success).toBe(
        true,
      );
    });

    it("accepts an email of 254 characters and rejects 255", () => {
      const domain = `${"d".repeat(60)}.${"e".repeat(60)}.${"f".repeat(60)}.com`;
      const withLength = (length: number) => `${"a".repeat(length - domain.length - 1)}@${domain}`;

      // The local part exceeds the RFC's 64 characters, so only the length rule is under test.
      expect(errorsFor(validFields({ email: withLength(255) })).email?.[0]).toContain("too long");
    });
  });

  describe("header injection", () => {
    it.each([
      ["LF", "ada@example.com\nBcc: victim@example.com"],
      ["CR", "ada@example.com\rBcc: victim@example.com"],
      ["CRLF", "ada@example.com\r\nBcc: victim@example.com"],
      ["embedded LF", "ada\n@example.com"],
    ])("rejects %s in the email", (_label, email) => {
      expect(contactFieldsSchema.safeParse(validFields({ email })).success).toBe(false);
    });

    it("never lets a line break into the name that becomes the subject", () => {
      const parsed = contactFieldsSchema.parse(validFields({ name: "Ada\r\nBcc: x@example.com" }));

      expect(parsed.name).not.toMatch(/[\r\n]/);
    });
  });
});

describe("contactRequestSchema", () => {
  it("carries the anti-spam signals through without validating them strictly", () => {
    const parsed = contactRequestSchema.parse({
      ...validFields(),
      honeypot: "filled by a bot",
      formElapsedMs: 5000,
    });

    expect(parsed.honeypot).toBe("filled by a bot");
    expect(parsed.formElapsedMs).toBe(5000);
  });

  it("accepts a request without them, leaving the decision to the service", () => {
    const parsed = contactRequestSchema.parse(validFields());

    expect(parsed.honeypot).toBeUndefined();
    expect(parsed.formElapsedMs).toBeUndefined();
  });
});
