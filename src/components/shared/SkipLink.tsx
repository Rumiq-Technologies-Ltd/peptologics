/**
 * Skip-to-content link.
 *
 * Visually hidden until focused, so a keyboard user can bypass the compliance
 * strip and the whole navigation on every page. First focusable element in the
 * document, which is the only position where it is useful.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="focus-visible:bg-brand-800 sr-only z-50 focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:rounded-md focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-white"
    >
      Skip to content
    </a>
  );
}
