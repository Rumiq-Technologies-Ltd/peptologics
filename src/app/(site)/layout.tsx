import { SiteDocument } from "@/components/layout/SiteDocument";
import { env } from "@/lib/env";
import { siteMetadata } from "@/lib/seo/siteMetadata";

import "../globals.css";

export const metadata = siteMetadata;

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <SiteDocument appEnv={env.APP_ENV}>{children}</SiteDocument>;
}
