/**
 * An RFC 4122 version 4 UUID, for the `Idempotency-Key` header.
 *
 * `crypto.randomUUID` is absent in older mobile browsers and in insecure (plain HTTP)
 * contexts, and calling it there throws. The submit that called it sat outside its try
 * block, so the visitor saw nothing happen. `crypto.getRandomValues` is available in both,
 * so the fallback builds the same version 4 format from it. The server accepts either.
 */
export function createUuid(): string {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));

  // Version 4 in the high nibble of byte 6, and the RFC 4122 variant in the top bits of byte 8.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
