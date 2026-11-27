import { SiteDocument } from "@/components/layout/SiteDocument";
import { siteMetadata } from "@/lib/seo/siteMetadata";

import "../globals.css";

export const metadata = siteMetadata;

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <SiteDocument>{children}</SiteDocument>;
}
