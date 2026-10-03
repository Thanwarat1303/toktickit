import { useEffect, useState } from "react";
import {
  ApiRequestError,
  attachmentDownloadUrl,
  claimStaffTicket,
  getAssignableStaffUsers,
  getStaffTicketDetail,
  postInternalNote,
  postTicketComment,
  updateStaffTicketOwner,
  updateStaffTicketWorkflow,
  type AssignableStaffUser,
  type StaffTicketDetail as StaffTicket,
  type WorkflowStatus,
} from "./api.js";

const transitions: Record<WorkflowStatus, WorkflowStatus[]> = {
  New: ["Open", "Cancelled"], Open: ["In Progress", "Waiting for Requester", "Cancelled"],
  "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
  "Waiting for Requester": ["In Progress", "Resolved", "Cancelled"], Resolved: ["Closed", "Reopened"],
  Closed: ["Reopened"], Reopened: ["In Progress", "Cancelled"], Cancelled: ["Reopened"],
};
const confirmationRequired = new Set<WorkflowStatus>(["Resolved", "Closed", "Reopened", "Cancelled"]);

export default function StaffTicketDetail({ ticketId, csrfToken, onBack }: { ticketId: number; csrfToken: string; onBack: () => void }) {
  const [ticket, setTicket] = useState<StaffTicket | null>(null);
  const [staff, setStaff] = useState<AssignableStaffUser[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [priority, setPriority] = useState("");
  const [nextStatus, setNextStatus] = useState<WorkflowStatus | "">("");
  const [confirmStatus, setConfirmStatus] = useState<WorkflowStatus | null>(null);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    setState("loading");
    try {
      const [detail, staffUsers] = await Promise.all([getStaffTicketDetail(ticketId), getAssignableStaffUsers()]);
      setTicket(detail); setStaff(staffUsers); setOwnerId(detail.owner ? String(detail.owner.id) : ""); setPriority(detail.itPriority); setState("ready");
    } catch (error) {
      setState(error instanceof ApiRequestError && /not found/i.test(error.message) ? "not-found" : "error");
    }
  }
  useEffect(() => { void load(); }, [ticketId]);
  const report = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(""), 4500); };
  async function perform(action: () => Promise<unknown>, success: string) { setBusy(true); try { await action(); report(success); await load(); } catch (error) { report(error instanceof Error ? error.message : "Unable to save changes."); } finally { setBusy(false); } }
  async function saveOwner() { await perform(() => updateStaffTicketOwner(ticketId, ownerId ? Number(ownerId) : null, csrfToken), "Owner updated."); }
  async function savePriority() { if (!priority || !ticket) return; await perform(() => updateStaffTicketWorkflow(ticketId, { itPriority: priority as StaffTicket["itPriority"] }, csrfToken), "IT priority updated."); }
  async function requestStatus() { if (!nextStatus) return; if (confirmationRequired.has(nextStatus)) { setConfirmStatus(nextStatus); return; } await applyStatus(nextStatus); }
  async function applyStatus(status: WorkflowStatus) { setConfirmStatus(null); await perform(() => updateStaffTicketWorkflow(ticketId, { status, ...(confirmationRequired.has(status) ? { confirm: true as const } : {}) }, csrfToken), "Ticket status updated."); setNextStatus(""); }
  async function submitComment() { const content = comment.trim(); if (!content) return report("Write a public comment before posting."); await perform(async () => { await postTicketComment(ticketId, content, csrfToken); setComment(""); }, "Public comment posted."); }
  async function submitNote() { const content = note.trim(); if (!content) return report("Write an internal note before posting."); await perform(async () => { await postInternalNote(ticketId, content, csrfToken); setNote(""); }, "Internal note posted."); }

  if (state === "loading") return <p className="text-secondary">Loading ticket details…</p>;
  if (state === "not-found") return <section className="selected-card"><p role="alert" className="form-error">This ticket was not found.</p><button className="btn btn-outline-success" onClick={onBack}>Back to queue</button></section>;
  if (state === "error" || !ticket) return <section className="selected-card"><p role="alert" className="form-error">Unable to load this ticket. Please try again.</p><button className="btn btn-outline-success" onClick={() => void load()}>Try again</button></section>;

  const allowed = transitions[ticket.status as WorkflowStatus] ?? [];
  return <section className="ticket-list-card staff-detail" aria-labelledby="staff-ticket-detail-title">
    <button className="btn btn-sm btn-outline-success" onClick={onBack}>← Back to queue</button>
    <div className="staff-detail__heading"><div><p className="eyebrow">IT STAFF · TICKET DETAIL</p><h1 id="staff-ticket-detail-title">{ticket.ticketNumber}</h1><p className="text-secondary">{ticket.summary}</p></div><span className="status-badge">{ticket.status}</span></div>
    {message && <p role="status" className="staff-detail__message">{message}</p>}
    <div className="staff-detail__grid">
      <section className="staff-detail__panel"><h2>Requester and request</h2><dl><dt>Requester</dt><dd>{ticket.requester.name}<small>{ticket.requester.email}</small></dd><dt>Category</dt><dd>{ticket.category.name}</dd><dt>Related system</dt><dd>{ticket.relatedSystem.name}</dd><dt>Requested priority</dt><dd><span className="status-badge">{ticket.priority}</span></dd><dt>Description</dt><dd>{ticket.description}</dd></dl></section>
      <section className="staff-detail__panel"><h2>Operational controls</h2><label>Owner<select aria-label="Ticket owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={busy}><option value="">Unassigned</option>{staff.map((person) => <option value={person.id} key={person.id}>{person.name} · {person.email}</option>)}</select></label><div className="staff-detail__actions">{!ticket.owner && <button className="btn btn-success" disabled={busy} onClick={() => void perform(() => claimStaffTicket(ticketId, csrfToken), "Ticket claimed.")}>Claim ticket</button>}<button className="btn btn-outline-success" disabled={busy || ownerId === (ticket.owner ? String(ticket.owner.id) : "")} onClick={() => void saveOwner()}>Save owner</button></div><label>IT priority<select aria-label="IT priority" value={priority} disabled={busy} onChange={(e) => setPriority(e.target.value)}>{["Low", "Medium", "High", "Urgent"].map((value) => <option key={value}>{value}</option>)}</select></label><button className="btn btn-outline-success" disabled={busy || priority === ticket.itPriority} onClick={() => void savePriority()}>Save IT priority</button><label>Change status<select aria-label="Change status" value={nextStatus} disabled={busy || allowed.length === 0} onChange={(e) => setNextStatus(e.target.value as WorkflowStatus | "")}><option value="">Choose a permitted status</option>{allowed.map((status) => <option value={status} key={status}>{status}{confirmationRequired.has(status) ? " · confirmation required" : ""}</option>)}</select></label><button className="btn btn-success" disabled={busy || !nextStatus} onClick={() => void requestStatus()}>Update status</button></section>
    </div>
    {confirmStatus && <section className="staff-detail__confirm" role="alertdialog" aria-label="Confirm status change"><h2>Confirm status change</h2><p>Change this ticket to <strong>{confirmStatus}</strong>? This status requires confirmation.</p><button className="btn btn-success" disabled={busy} onClick={() => void applyStatus(confirmStatus)}>Confirm</button><button className="btn btn-outline-success" disabled={busy} onClick={() => setConfirmStatus(null)}>Cancel</button></section>}
    <section className="staff-detail__panel"><h2>Attachments</h2>{ticket.attachments.length ? <ul className="staff-detail__attachments">{ticket.attachments.map((file) => <li key={file.id}><span>{file.originalFilename} {file.removedAt && "(removed)"}</span>{!file.removedAt && <a href={attachmentDownloadUrl(file.id)}>Download</a>}</li>)}</ul> : <p className="text-secondary">No attachments.</p>}</section>
    <div className="staff-detail__communications"><section className="staff-detail__panel public-comments"><h2>Public comments</h2><CommunicationList entries={ticket.publicComments} empty="No public comments yet." /><label>Reply publicly<textarea aria-label="Public comment" maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} /></label><button className="btn btn-success" disabled={busy} onClick={() => void submitComment()}>Post public comment</button></section><section className="staff-detail__panel internal-notes"><h2>Internal notes <span>IT Staff only</span></h2><CommunicationList entries={ticket.internalNotes} empty="No internal notes yet." /><label>Add internal note<textarea aria-label="Internal note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="btn btn-outline-success" disabled={busy} onClick={() => void submitNote()}>Post internal note</button></section></div>
  </section>;
}

function CommunicationList({ entries, empty }: { entries: StaffTicket["publicComments"]; empty: string }) { return entries.length ? <ul className="staff-detail__messages">{entries.map((entry) => <li key={entry.id}><strong>{entry.author.name}</strong><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time><p>{entry.content}</p></li>)}</ul> : <p className="text-secondary">{empty}</p>; }
