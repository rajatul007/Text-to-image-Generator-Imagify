import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { currentUser } from "@/lib/auth/current";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
