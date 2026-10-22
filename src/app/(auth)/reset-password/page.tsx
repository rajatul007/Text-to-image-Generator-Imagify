import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/misc";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Choose a new password" description="You'll be signed out of all devices after the change.">
      {token ? (
        <ResetForm token={token} />
      ) : (
        <Alert tone="danger" title="This link is incomplete">
          Open the link from your email again, or{" "}
          <Link href="/forgot-password" className="text-violet underline">
            request a new one
          </Link>
          .
        </Alert>
      )}
    </AuthCard>
  );
}
