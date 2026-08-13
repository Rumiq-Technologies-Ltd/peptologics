/**
 * Inline script that arms the scroll-reveal system before first paint.
 *
 * The reveal CSS hides `[data-reveal]` elements **only** when `<html>` carries
 * `data-motion="on"`, and this script is the only thing that sets it. That direction
 * matters: the failure mode of a missing attribute is content that is simply visible,
 * never content stuck at `opacity: 0`. If this script throws, if the bundle never
 * loads, if JavaScript is off entirely — the page reads normally and nothing animates.
 * The opposite arrangement (hide in CSS, reveal in JS) fails to a blank page.
 *
 * Runs pre-paint for the same reason the disclaimer gate's script does: setting the
 * attribute after hydration would paint one frame of fully-visible content before
 * hiding it, which is a worse flash than no animation at all.
 *
 * `prefers-reduced-motion` is checked here rather than only in CSS so that a visitor
 * who asked for less motion never has the hidden state applied in the first place.
 * The CSS carries the same guard for anyone who changes the setting mid-session.
 */
export function MotionPrePaintScript() {
  const script = `
(function(){
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.setAttribute('data-motion','on');
  } catch (e) {
    /* No matchMedia. Leave motion off — content stays visible, which is the safe side. */
  }
})();`.trim();

  return (
    <script
      // Static string built at module scope, no user input, and it must execute
      // before paint — which rules out next/script.
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
