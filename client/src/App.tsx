import { useEffect, useState } from "react";
import { getCurrentUser, logout, type AuthSession } from "./api.js";
import ChangePassword from "./ChangePassword.js";
import CreateTicketForm from "./CreateTicketForm.js";
import Login from "./Login.js";
import MyTickets from "./MyTickets.js";
import RequesterDashboard from "./RequesterDashboard.js";
import StaffDashboard from "./StaffDashboard.js";
import StaffTicketDetail from "./StaffTicketDetail.js";
import StaffTicketQueue from "./StaffTicketQueue.js";
import TicketDetail from "./TicketDetail.js";
import UserManagement from "./UserManagement.js";
import { allowedViews, parseRoute, routeHref, type Route, type View } from "./routes.js";

type Screen = "loading" | "login" | "change-password" | "home";
const labels: Record<View, string> = { dashboard: "Dashboard", newTicket: "New Ticket", myTickets: "My Tickets", queue: "Ticket Queue", users: "User Management" };

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [hash, setHash] = useState(() => window.location.hash);
  const [navTick, setNavTick] = useState(0);

  useEffect(() => { const onHash = () => setHash(window.location.hash); window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash); }, []);
  useEffect(() => { getCurrentUser().then(openSession).catch(() => setScreen("login")); }, []);

  function openSession(next: AuthSession) { setSession(next); setScreen(next.user.mustChangePassword ? "change-password" : "home"); if (!window.location.hash) window.location.hash = "#/dashboard"; }
  async function signOut() { if (!session) return; try { await logout(session.csrfToken); } finally { setSession(null); setScreen("login"); window.history.replaceState(null, "", window.location.pathname + window.location.search); setHash(""); } }
  function navigate(route: Route) { const next = routeHref(route); if (window.location.hash === next) setNavTick((value) => value + 1); else window.location.hash = next; }

  if (screen === "loading") return <div className="container py-5"><p>Loading…</p></div>;
  if (screen === "login" || !session) return <Login onSuccess={openSession} />;
  if (screen === "change-password") return <ChangePassword session={session} onSuccess={openSession} />;

  const parsed = parseRoute(hash);
  const route = allowedViews(session.user.role).includes(parsed.view) ? parsed : { view: "dashboard" as const };
  return <div className="app-shell min-vh-100">
    <header className="topbar"><div className="container d-flex align-items-center justify-content-between gap-3"><a className="brand" href={routeHref({ view: "dashboard" })} aria-label="TokTickIT home"><span className="brand__mark">T</span><span>TokTickIT</span></a><div className="d-flex align-items-center gap-3"><div className="requester-chip"><span className="requester-chip__avatar" aria-hidden="true">{session.user.name.charAt(0)}</span><span><small>Signed in as</small><strong>{session.user.name}</strong></span></div><button className="btn btn-sm btn-light" onClick={signOut}>Log out</button></div></div></header>
    <main className={`container py-5 page-content ${session.user.role === "REQUESTER" ? "" : "page-content--wide"}`}>
      <section className="selected-card"><p className="eyebrow mb-2">{session.user.role === "REQUESTER" ? "Requester workspace" : session.user.role === "IT_STAFF" ? "IT Staff workspace" : "Administrator workspace"}</p><h1 className="h2 mb-1">Welcome, {session.user.name}</h1><p className="text-secondary mb-0">Use the dashboard to find the next support task.</p></section>
      <nav className="app-nav" aria-label="Main navigation">{allowedViews(session.user.role).map((item) => <button key={item} className={`app-nav__tab ${route.view === item ? "active" : ""}`} aria-current={route.view === item ? "page" : undefined} onClick={() => navigate(item === "queue" ? { view: "queue", filters: {} } : item === "myTickets" ? { view: "myTickets", filters: {} } : { view: item } as Route)}>{labels[item]}</button>)}</nav>
      {renderRoute(route, session, navTick, navigate)}
    </main>
  </div>;
}

function renderRoute(route: Route, session: AuthSession, navTick: number, navigate: (route: Route) => void) {
  if (route.view === "dashboard") return session.user.role === "REQUESTER" ? <RequesterDashboard /> : <StaffDashboard />;
  if (route.view === "newTicket" && session.user.role === "REQUESTER") return <CreateTicketForm requester={session.user} csrfToken={session.csrfToken} />;
  if (route.view === "users" && session.user.role === "ADMINISTRATOR") return <UserManagement csrfToken={session.csrfToken} />;
  if (route.view === "myTickets" && session.user.role === "REQUESTER") {
    if (route.ticketId !== undefined) return <TicketDetail requester={session.user} csrfToken={session.csrfToken} ticketId={route.ticketId} onBack={() => navigate({ view: "myTickets", filters: route.filters })} />;
    return <MyTickets key={`${routeHref(route)}-${navTick}`} requester={session.user} initialFilters={route.filters} onOpenTicket={(ticketId) => navigate({ view: "myTickets", filters: route.filters, ticketId })} />;
  }
  if (route.view === "queue" && (session.user.role === "IT_STAFF" || session.user.role === "ADMINISTRATOR")) {
    if (route.ticketId !== undefined) return <StaffTicketDetail ticketId={route.ticketId} csrfToken={session.csrfToken} onBack={() => navigate({ view: "queue", filters: route.filters })} />;
    return <StaffTicketQueue key={`${routeHref(route)}-${navTick}`} initialFilters={route.filters} onOpenTicket={(ticketId) => navigate({ view: "queue", filters: route.filters, ticketId })} />;
  }
  return null;
}
