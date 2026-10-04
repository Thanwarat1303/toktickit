import { FormEvent, useState } from "react";
import { ApiRequestError, login, type AuthSession } from "./api.js";

export default function Login({ onSuccess }: { onSuccess: (session: AuthSession) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); setBusy(true); try { onSuccess(await login(email, password)); } catch (e) { setError(e instanceof ApiRequestError ? e.message : "Unable to sign in."); } finally { setBusy(false); } }
  return <section className="auth-card" aria-labelledby="login-heading"><p className="eyebrow mb-2">Secure access</p><h1 id="login-heading" className="h2">Sign in to TokTickIT</h1><p className="text-secondary">Use your club account to continue.</p><form onSubmit={submit} noValidate><label className="form-label" htmlFor="email">Email</label><input id="email" className="form-control mb-3" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /><label className="form-label" htmlFor="password">Password</label><input id="password" className="form-control mb-3" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />{error && <p className="text-danger" role="alert">{error}</p>}<button className="btn btn-zen w-100" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form></section>;
}
