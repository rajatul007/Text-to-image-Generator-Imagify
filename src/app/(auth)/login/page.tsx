import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";
import { GoogleButton } from "@/components/auth/google-button";
import { currentUser } from "@/lib/auth/current";
import { googleConfigured } from "@/lib/auth/google";

export const metadata = { title: "Log in" };

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't available on this server yet.",
  google_cancelled: "Google sign-in was cancelled.",
  google_state: "Your sign-in session expired. Please try again.",
  google_unverified: "Your Google email address isn't verified.",
  google_failed: "Google sign-in failed. Please try again.",
  suspended: "This account has been suspended. Contact support if you think this is a mistake.",
  rate_limited: "Too many attempts. Please wait a few minutes.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await currentUser()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  return (
    <AuthCard
      title="Welcome back"
      description="Log in to keep creating."
      footer={
        <>
          New here?{" "}
          <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-violet hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton next={next} enabled={googleConfigured()} />
      <LoginForm next={next} initialError={error ? ERRORS[error] : undefined} />
    </AuthCard>
  );
}
