import { useEffect, useState } from "react";
import { ApiRequestError, getCategories, getRelatedSystems, getStaffTickets, type Category, type RelatedSystem, type StaffTicketQueueQuery, type StaffTicketSummary } from "./api.js";

const statusOptions = ["New", "Open", "In Progress", "Waiting for Requester", "Resolved", "Closed", "Reopened", "Cancelled"];

export default function StaffTicketQueue() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [tickets, setTickets] = useState<StaffTicketSummary[]>([]);
  const [query, setQuery] = useState<StaffTicketQueueQuery>({ page: 1, pageSize: 20, sortBy: "createdAt", sortDir: "desc" });
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    Promise.all([getCategories(), getRelatedSystems()]).then(([categoryList, systemList]) => {
      setCategories(categoryList); setSystems(systemList);
    }).catch(() => setState("error"));
  }, []);

  useEffect(() => {
    setState("loading");
    getStaffTickets(query).then((result) => {
      setTickets(result.tickets); setPageInfo(result.pagination); setState("ready");
    }).catch((error) => setState(error instanceof ApiRequestError && /permission/i.test(error.message) ? "forbidden" : "error"));
  }, [query]);

  function update(next: Partial<StaffTicketQueueQuery>) { setQuery((current) => ({ ...current, ...next, page: 1 })); }
  function toggleSort(sortBy: NonNullable<StaffTicketQueueQuery["sortBy"]>) {
    setQuery((current) => ({ ...current, sortBy, sortDir: current.sortBy === sortBy && current.sortDir === "desc" ? "asc" : "desc", page: 1 }));
  }
  const activeFilters = Boolean(query.search || query.categoryId || query.relatedSystemId || query.itPriority || query.status || query.ownerId === 0);
  const sortMark = (field: StaffTicketQueueQuery["sortBy"]) => query.sortBy === field ? (query.sortDir === "asc" ? " ↑" : " ↓") : "";
  const filters = <div className="staff-queue__filters">
    <label>Category<select aria-label="Filter by category" value={query.categoryId ?? ""} onChange={(e) => update({ categoryId: e.target.value ? Number(e.target.value) : undefined })}><option value="">All categories</option>{categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>Related system<select aria-label="Filter by related system" value={query.relatedSystemId ?? ""} onChange={(e) => update({ relatedSystemId: e.target.value ? Number(e.target.value) : undefined })}><option value="">All systems</option>{systems.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>IT priority<select aria-label="Filter by IT priority" value={query.itPriority ?? ""} onChange={(e) => update({ itPriority: (e.target.value || undefined) as StaffTicketQueueQuery["itPriority"] })}><option value="">All priorities</option><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></label>
    <label>Status<select aria-label="Filter by status" value={query.status ?? ""} onChange={(e) => update({ status: e.target.value || undefined })}><option value="">All statuses</option>{statusOptions.map((x) => <option key={x}>{x}</option>)}</select></label>
    <label>Owner<select aria-label="Filter by owner" value={query.ownerId === 0 ? "unassigned" : ""} onChange={(e) => update({ ownerId: e.target.value === "unassigned" ? 0 : undefined })}><option value="">All owners</option><option value="unassigned">Unassigned</option></select></label>
  </div>;

  return <section className="ticket-list-card staff-queue" aria-labelledby="staff-queue-title">
    <div className="staff-queue__heading"><div><p className="eyebrow">IT STAFF</p><h1 id="staff-queue-title">Ticket Queue</h1><p className="text-secondary">Shared support requests across the club.</p></div><span className="ticket-count">{pageInfo.totalItems} tickets</span></div>
    <label className="staff-queue__search">Search tickets<input type="search" placeholder="Ticket no., summary, or description" value={query.search ?? ""} onChange={(e) => update({ search: e.target.value || undefined })} /></label>
    <button className="staff-queue__filter-toggle" type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>Filters {filtersOpen ? "−" : "+"}</button>
    <div className="staff-queue__filters-wrap">{filters}</div><div className="staff-queue__filters-mobile">{filtersOpen && filters}</div>
    {state === "loading" && <p className="text-secondary">Loading tickets…</p>}
    {state === "forbidden" && <p role="alert" className="form-error">You do not have permission to view this queue.</p>}
    {state === "error" && <p role="alert" className="form-error">Unable to load the ticket queue. Please try again.</p>}
    {state === "ready" && tickets.length === 0 && <p className="text-secondary">{activeFilters ? "No tickets match your search and filters." : "No tickets yet."}</p>}
    {state === "ready" && tickets.length > 0 && <><div className="staff-queue__table-wrap"><table className="ticket-table"><thead><tr><th>Ticket</th><th><button onClick={() => toggleSort("createdAt")}>Created{sortMark("createdAt")}</button></th><th>Summary</th><th className="staff-queue__wide">Category</th><th>Requested</th><th><button onClick={() => toggleSort("itPriority")}>IT priority{sortMark("itPriority")}</button></th><th><button onClick={() => toggleSort("status")}>Status{sortMark("status")}</button></th><th>Owner</th><th className="staff-queue__wide"><button onClick={() => toggleSort("updatedAt")}>Updated{sortMark("updatedAt")}</button></th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><code>{ticket.ticketNumber}</code></td><td>{new Date(ticket.createdAt).toLocaleDateString()}</td><td>{ticket.summary}</td><td className="staff-queue__wide">{ticket.category.name}</td><td><span className="status-badge">{ticket.priority}</span></td><td><span className="status-badge">{ticket.itPriority}</span></td><td><span className="status-badge">{ticket.status}</span></td><td>{ticket.owner?.name ?? "Unassigned"}</td><td className="staff-queue__wide">{new Date(ticket.updatedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div><div className="staff-queue__cards">{tickets.map((ticket) => <article key={ticket.id} className="staff-queue__card"><div><code>{ticket.ticketNumber}</code><span className="status-badge">{ticket.status}</span></div><strong>{ticket.summary}</strong><p>{ticket.owner?.name ?? "Unassigned"} · Updated {new Date(ticket.updatedAt).toLocaleDateString()}</p><span className="status-badge">Requested: {ticket.priority}</span> <span className="status-badge">IT: {ticket.itPriority}</span></article>)}</div></>}
    {state === "ready" && <div className="ticket-pagination"><span>Page {pageInfo.page} of {pageInfo.totalPages}</span><div><button disabled={pageInfo.page <= 1} onClick={() => setQuery((q) => ({ ...q, page: q.page! - 1 }))}>Previous</button><button disabled={pageInfo.page >= pageInfo.totalPages} onClick={() => setQuery((q) => ({ ...q, page: q.page! + 1 }))}>Next</button></div></div>}
  </section>;
}
