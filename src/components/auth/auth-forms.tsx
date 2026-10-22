"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { Alert } from "../ui/misc";
import { api, ApiClientError } from "@/lib/client/api";

function safeNext(next?: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required aria-invalid={invalid || undefined} aria-describedby={`${id}-error`} className="pr-10" />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-text" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function useFormState() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    setFields({});
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
        setFields(e.fields ?? {});
      } else setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };
  return { loading, error, fields, run };
}

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { loading, error, fields, run } = useFormState();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/api/auth/login", { body: { email, password } });
      router.replace(safeNext(next));
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {(error || initialError) && <Alert tone="danger">{error ?? initialError}</Alert>}
      <Field label="Email" htmlFor="email" error={fields.email}>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required aria-invalid={Boolean(fields.email) || undefined} />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={fields.password}
        hint={
          <Link href="/forgot-password" className="text-violet hover:underline">
            Forgot password?
          </Link>
        }
      >
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" invalid={Boolean(fields.password)} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Log in
      </Button>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { loading, error, fields, run } = useFormState();
  const strongEnough = password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api<{ message: string; verificationEmailSent: boolean }>("/api/auth/signup", { body: { name, email, password } });
      if (res.verificationEmailSent) toast.success(res.message);
      else toast.warning(res.message);
      router.replace(safeNext(next));
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Name" htmlFor="name" error={fields.name}>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required aria-invalid={Boolean(fields.name) || undefined} />
      </Field>
      <Field label="Email" htmlFor="email" error={fields.email}>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required aria-invalid={Boolean(fields.email) || undefined} />
      </Field>
      <Field label="Password" htmlFor="password" error={fields.password} hint={password ? (strongEnough ? "Looks good" : "8+ characters with letters and numbers") : "8+ characters with letters and numbers"}>
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" invalid={Boolean(fields.password)} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Create account
      </Button>
      <p className="text-center text-xs text-faint">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>
        .
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const { loading, error, fields, run } = useFormState();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api<{ message: string }>("/api/auth/forgot-password", { body: { email } });
      setSent(res.message);
    });
  };
  if (sent) return <Alert tone="ok" title="Check your email">{sent}</Alert>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Email" htmlFor="email" error={fields.email}>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { loading, error, fields, run } = useFormState();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (password !== confirm) throw new ApiClientError("Passwords don't match", 422, "VALIDATION", { confirm: "Passwords don't match" });
      const res = await api<{ message: string }>("/api/auth/reset-password", { body: { token, password } });
      toast.success(res.message);
      router.replace("/login");
    });
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="New password" htmlFor="password" error={fields.password} hint="8+ characters with letters and numbers">
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={fields.confirm}>
        <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Update password
      </Button>
    </form>
  );
}
