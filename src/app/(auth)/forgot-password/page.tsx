import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account's email and we'll send you a link to choose a new password."
      footer={
        <Link href="/login" className="text-violet hover:underline">
          Back to log in
        </Link>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
