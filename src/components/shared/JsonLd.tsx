import type { JsonLdNode } from "@/lib/seo/structuredData";

/**
 * Renders a JSON-LD graph into the document.
 *
 * `dangerouslySetInnerHTML` is used here and nowhere else in the codebase. It is
 * unavoidable: a `<script>` element's contents must be raw text, and React escapes
 * children — `&quot;` inside a JSON-LD block makes it unparseable. This is the one
 * case the rule in CLAUDE.md exists to permit rather than forbid.
 *
 * Two things make it safe:
 *
 * 1. The input is a structured object built by our own code from database values,
 *    never a raw string from a request.
 * 2. `<` is escaped to `<` after serialising. Without that, a product name
 *    containing `</script>` would close the tag early and everything after it would
 *    be parsed as HTML — the classic JSON-in-script injection. `JSON.stringify`
 *    alone does not prevent this.
 *
 * A Server Component: this never re-renders and ships no JavaScript.
 */
export interface JsonLdProps {
  /** One node, or several to emit as separate script tags. */
  schema: JsonLdNode | JsonLdNode[];
}

function serialise(node: JsonLdNode): string {
  return JSON.stringify(node).replace(/</g, "\\u003c");
}

export function JsonLd({ schema }: JsonLdProps) {
  const nodes = Array.isArray(schema) ? schema : [schema];

  return (
    <>
      {nodes.map((node, index) => (
        <script
          // Index is a stable key here: the array is built server-side, in a fixed
          // order, and never reordered or filtered on the client.
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialise(node) }}
        />
      ))}
    </>
  );
}
