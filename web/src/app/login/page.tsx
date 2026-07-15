"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result =
      mode === "signin"
        ? await signIn.email({ email, password })
        : await signUp.email({
            email,
            password,
            name: name.trim() || email.split("@")[0] || "User",
          });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong");
      return;
    }
    router.push("/dashboard");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
  {/* soft blue glow rising from the bottom, fading to nothing by mid-page */}
  <div aria-hidden className="auth-glow z-0" />
  <form
    onSubmit={submit}
    className="relative z-10 w-full max-w-sm space-y-4 rounded-xl border border-line bg-raised p-8"
  >
        <Link href="/" className="block text-center font-display text-2xl font-light tracking-tight">
          Prompt <span className="text-accent">Diary</span>
        </Link>
        <h1 className="text-center text-sm text-dim">
          {mode === "signin"
            ? "Sign in to your vault"
            : "Create your account"}
        </h1>

        {mode === "signup" && (
          <input
            className="input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="input"
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent py-2.5 font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>

        <div className="flex items-center gap-3 text-xs text-dim">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <button
          type="button"
          className="btn flex w-full items-center justify-center gap-2 py-2.5"
          onClick={() =>
            void signIn.social({ provider: "google", callbackURL: "/dashboard" })
          }
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.2h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.7z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1L1.3 17c1.9 4.1 6 7 10.7 7z"
            />
            <path
              fill="#FBBC05"
              d="M5.1 14.3c-.3-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.3 6.7C.5 8.3 0 10.1 0 12s.5 3.7 1.3 5.3l3.8-3z"
            />
            <path
              fill="#EA4335"
              d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.3-3.2C18 1.3 15.2 0 12 0 7.3 0 3.2 2.9 1.3 6.7l3.8 3c.9-2.9 3.7-5 6.9-5z"
            />
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          className="w-full text-center text-sm text-accent hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
