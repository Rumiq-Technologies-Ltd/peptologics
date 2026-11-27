import Link from "next/link";

import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

/**
 * Site-wide 404. Always offers a route onward rather than a dead end.
 */
export default function NotFound() {
  return (
    <Section className="min-h-[55vh]">
      <div className="mx-auto max-w-xl">
        <p className="text-eyebrow text-brand-800 font-mono uppercase">Error 404</p>
        <h1 className="text-h2 text-ink-950 mt-3 font-bold">Page not found</h1>

        <p className="text-ink-700 mt-4">
          The link may be out of date, or the page may have moved. Nothing is wrong with your
          connection.
        </p>

        <h2 className="text-ink-950 mt-10 text-sm font-semibold">Where to go next</h2>
        <ul className="divide-ink-200 border-ink-200 mt-3 divide-y border-y">
          {[
            { href: ROUTES.products, label: "Research peptides", detail: "The full catalog" },
            {
              href: ROUTES.labTesting,
              label: "Lab testing & COAs",
              detail: "Analytical documentation",
            },
            { href: ROUTES.contact, label: "Contact us", detail: "Ask a representative" },
          ].map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="hover:bg-ink-50 flex items-baseline gap-3 py-3">
                <span className="text-brand-600 font-medium underline-offset-4 hover:underline">
                  {item.label}
                </span>
                <span className="text-ink-600 text-sm">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>

        <Button asChild className="mt-8">
          <Link href={ROUTES.home}>Back to home</Link>
        </Button>
      </div>
    </Section>
  );
}
