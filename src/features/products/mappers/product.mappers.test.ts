import { describe, expect, it } from "vitest";

import { toAssetPath } from "@/features/products/mappers/product.mappers";

/**
 * `image_url` and `coa_url` become `src` and `href` attributes. These cases are the schemes
 * and the slash tricks that would turn a catalog row into something that runs or leaves the
 * site.
 */
describe("toAssetPath", () => {
  it.each([
    ["a site path", "/coa/bpc-157-10mg.webp"],
    ["an https URL", "https://storage.example.com/products/vial.webp"],
  ])("admits %s", (_label, value) => {
    expect(toAssetPath(value)).toBe(value);
  });

  it("returns null when there is no file", () => {
    expect(toAssetPath(null)).toBeNull();
  });

  it.each([
    ["a javascript URL", "javascript:alert(document.cookie)"],
    ["a data URL", "data:text/html;base64,PHNjcmlwdD4="],
    ["an insecure http URL", "http://storage.example.com/vial.webp"],
    ["a protocol-relative URL", "//attacker.example/vial.webp"],
    ["a backslash path browsers read as protocol-relative", "/\\attacker.example/vial.webp"],
    ["a bare word", "vial.webp"],
    ["a path that is only a slash-and-space", "/ "],
  ])("refuses %s", (_label, value) => {
    expect(toAssetPath(value)).toBeNull();
  });

  it("trims surrounding whitespace before judging the value", () => {
    expect(toAssetPath("  /coa/tesamorelin-10mg.webp  ")).toBe("/coa/tesamorelin-10mg.webp");
  });
});
