import { useState } from "react";
import { openWebSignIn, signIn, signUp, type AuthState } from "../lib/api";

interface Props {
  onDone: (auth: AuthState) => void;
  onClose: () => void;
}

export function AccountView({ onDone, onClose }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const auth =
        mode === "signin"
          ? await signIn(email, password)
          : await signUp(name.trim() || email.split("@")[0] || "User", email, password);
      onDone(auth);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="editor">
      <h2>{mode === "signin" ? "Sign in" : "Create account"}</h2>
      <p style={{ color: "var(--dim)", fontSize: 12 }}>
        Sync your prompts across devices and share with your team.
      </p>
      {mode === "signup" && (
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}
      <input
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <input
        placeholder="Password (8+ characters)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
      />
      {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
      <button
        className="btn"
        onClick={() => {
          void openWebSignIn();
          window.close();
        }}
      >
        Continue with Google (opens the website)
      </button>
      <p style={{ color: "var(--dim)", fontSize: 11, lineHeight: 1.5 }}>
        Sign in there with Google, then reopen this popup — it connects
        automatically.
      </p>
      <div style={{ flex: 1 }} />
      <div className="actions">
        <button
          className="link-btn"
          style={{ marginRight: "auto" }}
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "New here? Create account" : "Have an account? Sign in"}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={busy || !email || password.length < 8}
          onClick={() => void submit()}
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </div>
    </div>
  );
}
