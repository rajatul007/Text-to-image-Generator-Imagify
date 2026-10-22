import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <h1 className="font-display mt-10 text-5xl font-semibold">Nothing to see here</h1>
      <p className="mt-3 max-w-md text-muted">This page doesn&apos;t exist, or it&apos;s an image that isn&apos;t public. If someone shared it with you, ask them for a share link.</p>
      <div className="mt-8 flex gap-2">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/explore">Browse Explore</Link>
        </Button>
      </div>
    </main>
  );
}
