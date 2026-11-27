import { Section } from "@/components/layout/Section";

/**
 * Shared prose container for the policy pages.
 *
 * A route group, so it adds no URL segment — the pages stay at /terms, /privacy
 * and so on. Its only job is a readable measure and consistent typography, which
 * is what stops four separate legal pages each inventing their own layout.
 *
 * Prose styles are applied here rather than per page so the wording in each file
 * stays plain markup that is easy for the client's counsel to review.
 */
/*
 * `children` is typed directly rather than with `LayoutProps<...>`. Next only
 * generates route types for real URL paths, and a route group adds no segment —
 * the pages live at /terms, /privacy and so on — so there is no `"/(legal)"` key
 * to reference.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Section>
      <div className="[&_a]:text-brand-600 [&_h1]:text-h2 [&_h1]:text-ink-950 [&_h2]:text-h3 [&_h2]:text-ink-950 [&_h3]:text-ink-950 [&_p]:text-ink-700 mx-auto max-w-prose [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_h1]:font-bold [&_h2]:mt-10 [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </Section>
  );
}
