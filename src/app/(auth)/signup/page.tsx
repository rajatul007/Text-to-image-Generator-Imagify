import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/auth-forms";
import { GoogleButton } from "@/components/auth/google-button";
import { currentUser } from "@/lib/auth/current";
import { googleConfigured } from "@/lib/auth/google";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect("/dashboard");
  const { welcomeCredits } = await getSettings();
  return (
    <AuthCard
      title="Create your account"
      description={welcomeCredits > 0 ? `Verify your email to get ${welcomeCredits} free credits.` : "Start creating in under a minute."}
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-violet hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <GoogleButton next={next} enabled={googleConfigured()} />
      <SignupForm next={next} />
    </AuthCard>
  );
}
