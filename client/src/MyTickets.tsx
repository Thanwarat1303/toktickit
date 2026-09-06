import { useEffect, useState } from "react";
import {
  ApiRequestError,
  getCategories,
  getRelatedSystems,
  getTickets,
  type Category,
  type RelatedSystem,
  type Requester,
  type TicketListResponse,
} from "./api.js";

type SortValue = "createdAt-desc" | "createdAt-asc" | "summary-asc" | "summary-desc" | "priority-asc" | "priority-desc";

interface MyTicketsProps {
  requester: Requester;
  onOpenTicket: (ticketId: number) => void;
}

export default function MyTickets({ requester, onOpenTicket }: MyTicketsProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<SortValue>("createdAt-desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TicketListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getCategories(), getRelatedSystems()])
      .then(([loadedCategories, loadedSystems]) => {
        setCategories(loadedCategories);
        setSystems(loadedSystems);
      })
      .catch(() => setError("Unable to load filter options."));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const [sortBy, sortOrder] = sort.split("-") as ["createdAt" | "summary" | "priority", "asc" | "desc"];

    setLoading(true);
    setError("");

    getTickets({
      requesterId: requester.id,
      search: search.trim() || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      relatedSystemId: relatedSystemId ? Number(relatedSystemId) : undefined,
      priority: priority as "Low" | "Medium" | "High" | undefined,
      status: status || undefined,
      sortBy,
      sortOrder,
      page,
      pageSize: 10,
    })
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(caught instanceof ApiRequestError ? caught.message : "Unable to load your tickets.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requester.id, search, categoryId, relatedSystemId, priority, status, sort, page]);

  function resetPage(action: () => void) {
    action();
    setPage(1);
  }

  const hasFilters = Boolean(search || categoryId || relatedSystemId || priority || status || sort !== "createdAt-desc");

  return (
    <section className="ticket-list-card" aria-labelledby="my-tickets-heading">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <p className="eyebrow mb-1">Your support requests</p>
          <h2 id="my-tickets-heading" className="h3 mb-1">My Tickets</h2>
          <p className="text-secondary mb-0">Tickets created as {requester.name}.</p>
        </div>
        {data && <span className="ticket-count">{data.totalItems} ticket{data.totalItems === 1 ? "" : "s"}</span>}
      </div>

      <div className="ticket-filters" aria-label="Ticket filters">
        <label>
          Search tickets
          <input className="form-control" value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Ticket number or summary" />
        </label>
        <label>
          Category
          <select className="form-select" value={categoryId} onChange={(event) => resetPage(() => setCategoryId(event.target.value))}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label>
          Related system
          <select className="form-select" value={relatedSystemId} onChange={(event) => resetPage(() => setRelatedSystemId(event.target.value))}>
            <option value="">All systems</option>
            {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
          </select>
        </label>
        <label>
          Priority
          <select className="form-select" value={priority} onChange={(event) => resetPage(() => setPriority(event.target.value))}>
            <option value="">All priorities</option>
            <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
          </select>
        </label>
        <label>
          Status
          <select className="form-select" value={status} onChange={(event) => resetPage(() => setStatus(event.target.value))}>
            <option value="">All statuses</option><option value="New">New</option>
          </select>
        </label>
        <label>
          Sort by
          <select className="form-select" value={sort} onChange={(event) => resetPage(() => setSort(event.target.value as SortValue))}>
            <option value="createdAt-desc">Newest first</option><option value="createdAt-asc">Oldest first</option>
            <option value="summary-asc">Summary A–Z</option><option value="summary-desc">Summary Z–A</option>
            <option value="priority-asc">Priority low–high</option><option value="priority-desc">Priority high–low</option>
          </select>
        </label>
      </div>

      {loading && <div className="state-panel mt-4">Loading your tickets…</div>}
      {!loading && error && <div role="alert" className="state-panel state-panel--error mt-4">{error}</div>}
      {!loading && !error && data?.items.length === 0 && (
        <div className="empty-state mt-4">
          <h3 className="h5">{hasFilters ? "No tickets match these filters" : "No tickets yet"}</h3>
          <p className="mb-0">{hasFilters ? "Try changing or clearing a filter." : "Create your first support ticket from the New Ticket tab."}</p>
        </div>
      )}
      {!loading && !error && data && data.items.length > 0 && (
        <>
          <div className="table-responsive mt-4">
            <table className="table ticket-table align-middle mb-0">
              <thead><tr><th>Ticket</th><th>Summary</th><th>Category</th><th>System</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>{data.items.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <button
                      type="button"
                      className="ticket-link"
                      onClick={() => onOpenTicket(ticket.id)}
                    >
                      {ticket.ticketNumber}
                    </button>
                  </td><td>{ticket.summary}</td><td>{ticket.category.name}</td><td>{ticket.relatedSystem.name}</td>
                  <td><span className={`priority-badge priority-badge--${ticket.priority.toLowerCase()}`}>{ticket.priority}</span></td>
                  <td><span className="status-badge">{ticket.status}</span></td><td>{new Date(ticket.createdAt).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <nav className="ticket-pagination mt-4" aria-label="Ticket pagination">
            <button className="btn btn-outline-zen" onClick={() => setPage(page - 1)} disabled={page <= 1}>Previous</button>
            <span>Page {data.page} of {data.totalPages}</span>
            <button className="btn btn-outline-zen" onClick={() => setPage(page + 1)} disabled={page >= data.totalPages}>Next</button>
          </nav>
        </>
      )}
    </section>
  );
}
