import { ReactNode } from "react";
import { Priority, StaffDashboardData, TicketBrief, TicketStatus, fetchStaffDashboard } from "./api.js";
import { DashboardStatus, DrillLink, MetricCard, plural, useDashboard } from "./dashboardShared.js";
import { routeHref } from "./routes.js";

const statuses: TicketStatus[] = ["New", "Open", "In Progress", "Waiting for Requester", "Resolved", "Closed", "Reopened", "Cancelled"];
const priorities: Priority[] = ["HIGH", "MEDIUM", "LOW", "URGENT"];
const priorityLabels: Record<Priority, "Low" | "Medium" | "High" | "Urgent"> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

export default function StaffDashboard() {
  const { state, reload } = useDashboard(fetchStaffDashboard);
  return <section aria-labelledby="staff-dashboard-title"><h2 id="staff-dashboard-title" className="h4 mb-3">Dashboard</h2>{state.kind !== "ready" ? <DashboardStatus state={state} reload={reload} /> : <Loaded data={state.data} />}</section>;
}

function Loaded({ data }: { data: StaffDashboardData }) {
  return <>
    <div className="row g-3 mb-4">
      <Col><MetricCard title="Unassigned" value={data.unassigned}><DrillLink route={{ view: "queue", filters: { ownerId: "unassigned", open: true } }} label={`View ${data.unassigned} unassigned ${plural(data.unassigned, "ticket", "tickets")}`} /></MetricCard></Col>
      <Col><MetricCard title="Assigned to me" value={data.assignedToMe}><DrillLink route={{ view: "queue", filters: { ownerId: "me", open: true } }} label={`View ${data.assignedToMe} ${plural(data.assignedToMe, "ticket", "tickets")} assigned to me`} /></MetricCard></Col>
      <Col><MetricCard title="Open actions assigned to me" value={data.ticketsWithMyOpenActions}><DrillLink route={{ view: "queue", filters: { actionAssigneeId: "me", open: true } }} label={`View ${data.ticketsWithMyOpenActions} ${plural(data.ticketsWithMyOpenActions, "ticket", "tickets")} with my open actions`} /></MetricCard></Col>
      <Wide><MetricCard title="By status"><ul className="list-unstyled mb-0">{statuses.map((status) => { const count = data.byStatus[status] ?? 0; return <li key={status} className="d-flex justify-content-between align-items-center gap-2 mb-1"><span><span className="status-badge">{status}</span> <strong>{count}</strong></span><DrillLink route={{ view: "queue", filters: { status } }} label={`View ${count} ${status} ${plural(count, "ticket", "tickets")}`} /></li>; })}</ul></MetricCard></Wide>
      <Wide><MetricCard title="By IT priority"><p className="text-muted small">Open tickets only.</p><ul className="list-unstyled mb-0">{priorities.map((priority) => { const count = data.byItPriority[priority] ?? 0; return <li key={priority} className="d-flex justify-content-between align-items-center gap-2 mb-1"><span><span className="status-badge">{priorityLabels[priority]}</span> <strong>{count}</strong></span><DrillLink route={{ view: "queue", filters: { itPriority: priorityLabels[priority], open: true } }} label={`View ${count} ${priorityLabels[priority]} priority open ${plural(count, "ticket", "tickets")}`} /></li>; })}</ul></MetricCard></Wide>
    </div>
    <div className="row g-4"><TicketList title="Recently updated" tickets={data.recentlyUpdated} empty="No recent tickets" allRoute={{ view: "queue", filters: { recent: true, sortBy: "updatedAt" } }} /><section className="col-12 col-lg-6" aria-labelledby="my-actions-heading"><h3 id="my-actions-heading" className="h6 mb-2">My recent actions</h3>{data.myRecentActions.length === 0 ? <p className="text-muted">You have not recorded any actions yet.</p> : <ul className="list-unstyled">{data.myRecentActions.map((action) => <li key={action.id} className="mb-2 pb-2 border-bottom"><a href={routeHref({ view: "queue", filters: {}, ticketId: action.ticketId, section: "actions-taken" })} className="d-block text-body"><strong>{action.ticketNumber}</strong> <span className="status-badge">{action.status}</span><span className="d-block">{action.description}</span><span className="d-block text-muted small">{new Date(action.actionAt).toLocaleString()}</span></a></li>)}</ul>}</section></div>
    <div className="d-flex flex-wrap align-items-center gap-2 mt-4"><a className="btn btn-success" href={routeHref({ view: "queue", filters: {} })}>Open Ticket Queue</a>{data.userCounts && <><a className="btn btn-outline-success" href={routeHref({ view: "users" })}>Manage users</a><span>Users: {data.userCounts.total} total, {data.userCounts.active} active</span></>}</div>
  </>;
}

function TicketList({ title, tickets, empty, allRoute }: { title: string; tickets: TicketBrief[]; empty: string; allRoute: Parameters<typeof DrillLink>[0]["route"] }) { return <section className="col-12 col-lg-6" aria-labelledby="recent-tickets-heading"><div className="d-flex justify-content-between align-items-center gap-2 mb-2"><h3 id="recent-tickets-heading" className="h6 mb-0">{title}</h3><DrillLink route={allRoute} label="View all recently updated tickets">View all</DrillLink></div>{tickets.length === 0 ? <p className="text-muted">{empty}</p> : <ul className="list-unstyled">{tickets.map((ticket) => <li key={ticket.id} className="mb-2 pb-2 border-bottom"><a href={routeHref({ view: "queue", filters: {}, ticketId: ticket.id })}>{ticket.ticketNumber}</a> <span className="status-badge">{ticket.currentStatus}</span><div>{ticket.summary}</div><div className="text-muted small">{new Date(ticket.updatedAt).toLocaleString()}</div></li>)}</ul>}</section>; }
function Col({ children }: { children: ReactNode }) { return <div className="col-12 col-md-6 col-lg-4">{children}</div>; }
function Wide({ children }: { children: ReactNode }) { return <div className="col-12 col-md-6">{children}</div>; }
