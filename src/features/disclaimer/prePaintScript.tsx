import { RUO_ACKNOWLEDGEMENT_DAYS, RUO_STORAGE_KEY, RUO_STORAGE_VERSION } from "@/constants/site";

/**
 * Inline script that runs before first paint, so a returning visitor never sees
 * the gate flash.
 *
 * The gate is present in the server-rendered HTML by default — it must be, because
 * the server cannot know whether this device has already accepted. Without this
 * script a returning visitor would see the overlay for one frame until React
 * hydrated and removed it.
 *
 * The script sets `data-ruo="ok"` on <html>, and CSS hides the gate when that
 * attribute is present. Running before paint means the browser never composites a
 * frame containing the overlay.
 *
 * CRITICAL: this hides only the GATE, never the page content.
 *
 * The tempting version of this optimisation — hiding the page until acceptance to
 * avoid any flash of ungated content — is a trap. Googlebot renders with an empty
 * localStorage, so it would take the un-accepted branch and every page's content
 * would be hidden at crawl time. Content hidden that way is discounted. We accept
 * a brief flash of real content and keep it honestly visible. See ADR-009.
 */
export function DisclaimerPrePaintScript() {
  // Values are interpolated from the same constants the runtime module uses, so
  // the two cannot drift apart.
  const script = `
(function(){
  try {
    var raw = localStorage.getItem(${JSON.stringify(RUO_STORAGE_KEY)});
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== ${RUO_STORAGE_VERSION}) return;
    if (typeof parsed.at !== 'number') return;
    var age = Date.now() - parsed.at;
    if (age < 0 || age >= ${RUO_ACKNOWLEDGEMENT_DAYS} * 86400000) return;
    document.documentElement.setAttribute('data-ruo','ok');
  } catch (e) {
    /* Storage unavailable. Leave the gate in place — failing closed is correct. */
  }
})();`.trim();

  return (
    <script
      // The content is built from module constants, contains no user input, and
      // must execute before paint, which rules out next/script.
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
