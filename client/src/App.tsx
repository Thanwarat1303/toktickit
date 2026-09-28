import { useEffect, useState } from "react";
import { getCurrentUser, logout, type AuthSession, type Requester } from "./api.js";
import Login from "./Login.js";
import ChangePassword from "./ChangePassword.js";
import CreateTicketForm from "./CreateTicketForm.js";
import MyTickets from "./MyTickets.js";
import TicketDetail from "./TicketDetail.js";

type Screen = "loading" | "login" | "change-password" | "home";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [view, setView] = useState<"create" | "tickets">("create");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  useEffect(() => { getCurrentUser().then(openSession).catch(() => setScreen("login")); }, []);
  function openSession(next: AuthSession) { setSession(next); setView("create"); setSelectedTicketId(null); setScreen(next.user.mustChangePassword ? "change-password" : "home"); }
  async function signOut() { if (!session) return; try { await logout(session.csrfToken); } finally { setSession(null); setScreen("login"); } }
  return <div className="app-shell min-vh-100">
    <header className="topbar"><div className="container d-flex align-items-center justify-content-between gap-3"><a className="brand" href="#" aria-label="TokTickIT home"><span className="brand__mark">T</span><span>TokTickIT</span></a>{session && <div className="d-flex align-items-center gap-3"><div className="requester-chip"><span className="requester-chip__avatar" aria-hidden="true">{session.user.name.charAt(0)}</span><span><small>Signed in as</small><strong>{session.user.name}</strong></span></div><button className="btn btn-sm btn-light" onClick={signOut}>Log out</button></div>}</div></header>
    <main className="container py-5 page-content">
      {screen === "loading" && <p className="text-center text-secondary">Restoring your session…</p>}
      {screen === "login" && <Login onSuccess={openSession} />}
      {screen === "change-password" && session && <ChangePassword session={session} onSuccess={openSession} />}
      {screen === "home" && session && (session.user.role === "REQUESTER" ? <RequesterWorkspace requester={session.user} view={view} selectedTicketId={selectedTicketId} onView={setView} onOpen={setSelectedTicketId} onBack={() => setSelectedTicketId(null)} /> : <section className="selected-card" aria-labelledby="welcome-heading"><div><p className="eyebrow mb-2">Authenticated</p><h1 id="welcome-heading" className="h2">Welcome, {session.user.name}</h1><p className="text-secondary mb-2">{session.user.email} · {session.user.role.replace("_", " ")}</p><p className="mb-0">Your role-specific workspace will be available in the next feature.</p></div></section>)}
    </main>
  </div>;
}

function RequesterWorkspace({ requester, view, selectedTicketId, onView, onOpen, onBack }: { requester: Requester; view: "create" | "tickets"; selectedTicketId: number | null; onView: (view: "create" | "tickets") => void; onOpen: (id: number) => void; onBack: () => void }) {
  return <><section className="selected-card"><div><p className="eyebrow mb-2">Requester workspace</p><h1 className="h2 mb-1">Welcome, {requester.name}</h1><p className="text-secondary mb-0">Create and follow your own support requests.</p></div></section><nav className="app-nav" aria-label="Ticket views"><button className={view === "create" ? "app-nav__tab active" : "app-nav__tab"} onClick={() => { onView("create"); onBack(); }}>New Ticket</button><button className={view === "tickets" ? "app-nav__tab active" : "app-nav__tab"} onClick={() => onView("tickets")}>My Tickets</button></nav>{view === "create" ? <CreateTicketForm requester={requester} /> : selectedTicketId ? <TicketDetail requester={requester} ticketId={selectedTicketId} onBack={onBack} /> : <MyTickets requester={requester} onOpenTicket={onOpen} />}</>;
}
