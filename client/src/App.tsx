import { useEffect, useState } from "react";
import { getCurrentUser, logout, type AuthSession } from "./api.js";
import Login from "./Login.js";
import ChangePassword from "./ChangePassword.js";

type Screen = "loading" | "login" | "change-password" | "home";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  useEffect(() => { getCurrentUser().then(openSession).catch(() => setScreen("login")); }, []);
  function openSession(next: AuthSession) { setSession(next); setScreen(next.user.mustChangePassword ? "change-password" : "home"); }
  async function signOut() { if (!session) return; try { await logout(session.csrfToken); } finally { setSession(null); setScreen("login"); } }
  return <div className="app-shell min-vh-100">
    <header className="topbar"><div className="container d-flex align-items-center justify-content-between gap-3"><a className="brand" href="#" aria-label="TokTickIT home"><span className="brand__mark">T</span><span>TokTickIT</span></a>{session && <div className="d-flex align-items-center gap-3"><div className="requester-chip"><span className="requester-chip__avatar" aria-hidden="true">{session.user.name.charAt(0)}</span><span><small>Signed in as</small><strong>{session.user.name}</strong></span></div><button className="btn btn-sm btn-light" onClick={signOut}>Log out</button></div>}</div></header>
    <main className="container py-5 page-content">
      {screen === "loading" && <p className="text-center text-secondary">Restoring your session…</p>}
      {screen === "login" && <Login onSuccess={openSession} />}
      {screen === "change-password" && session && <ChangePassword session={session} onSuccess={openSession} />}
      {screen === "home" && session && <section className="selected-card" aria-labelledby="welcome-heading"><div><p className="eyebrow mb-2">Authenticated</p><h1 id="welcome-heading" className="h2">Welcome, {session.user.name}</h1><p className="text-secondary mb-2">{session.user.email} · {session.user.role.replace("_", " ")}</p><p className="mb-0">Your account is ready. Ticket navigation will be connected in the authorization feature.</p></div></section>}
    </main>
  </div>;
}
