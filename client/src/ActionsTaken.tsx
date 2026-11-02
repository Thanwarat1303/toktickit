import { useEffect, useMemo, useState } from "react";
import {
  ApiRequestError,
  createAction,
  fetchActionRevisions,
  fetchActions,
  getAssignableStaffUsers,
  updateAction,
  type ActionInput,
  type ActionRevision,
  type ActionStatus,
  type ActionTaken,
  type AssignableStaffUser,
} from "./api.js";

type FormValue = Omit<ActionInput, "actionAt"> & { actionAt: string };
const statusLabel: Record<ActionStatus, string> = { PLANNED: "Planned", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const localDateTime = (value: Date) => {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};
const emptyForm = (status: ActionStatus = "PLANNED"): FormValue => ({ description: "", status, assigneeId: null, actionAt: localDateTime(new Date()), result: "", followUpRequired: false, followUpNote: "", attachmentNotes: "" });
const actionDate = (value: string) => value ? new Date(value).toISOString() : new Date().toISOString();

export default function ActionsTaken({ ticketId, csrfToken, readOnly = false, ticketStatus, onChanged }: { ticketId: number; csrfToken?: string; readOnly?: boolean; ticketStatus: string; onChanged?: () => void }) {
  const [actions, setActions] = useState<ActionTaken[]>([]);
  const [users, setUsers] = useState<AssignableStaffUser[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState("");
  const [form, setForm] = useState<FormValue | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<{ id: number; rows: ActionRevision[] } | null>(null);

  async function load() {
    setState("loading");
    try { setActions(await fetchActions(ticketId)); if (!readOnly) setUsers(await getAssignableStaffUsers()); setState("ready"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load actions."); setState("error"); }
  }
  useEffect(() => { void load(); }, [ticketId, readOnly]);
  const closed = ticketStatus === "Closed" || ticketStatus === "Cancelled";
  const createStatuses: ActionStatus[] = ticketStatus === "Resolved" ? ["COMPLETED"] : ["PLANNED", "IN_PROGRESS", "COMPLETED"];
  const assignable = useMemo(() => users, [users]);

  function beginCreate() { setEditing(null); setErrors({}); setMessage(""); setConflict(""); setForm(emptyForm(ticketStatus === "Resolved" ? "COMPLETED" : "PLANNED")); }
  function beginEdit(action: ActionTaken) {
    setEditing(action.id); setErrors({}); setMessage(""); setConflict("");
    setForm({ description: action.description, status: action.status, assigneeId: action.assignee?.id ?? null, actionAt: localDateTime(new Date(action.actionAt)), result: action.result, followUpRequired: action.followUpRequired, followUpNote: action.followUpNote, attachmentNotes: action.attachmentNotes });
  }
  function setField<K extends keyof FormValue>(field: K, value: FormValue[K]) { setForm((current) => current ? { ...current, [field]: value } : current); setErrors((current) => ({ ...current, [field]: "" })); }
  function editStatuses(action: ActionTaken) { const moves: Record<ActionStatus, ActionStatus[]> = { PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"], IN_PROGRESS: ["COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [] }; return [action.status, ...moves[action.status]]; }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!form || !csrfToken) return;
    const nextErrors: Record<string, string> = {};
    if (!form.description.trim()) nextErrors.description = "Description is required.";
    if (form.followUpRequired && !form.followUpNote.trim()) nextErrors.followUpNote = "A follow-up note is required when follow-up is required.";
    if (form.status === "COMPLETED" && !form.result.trim()) nextErrors.result = "A result is required for a completed action.";
    if (Object.values(nextErrors).some(Boolean)) { setErrors(nextErrors); return; }
    setSaving(true); setMessage(""); setConflict("");
    try {
      const input: ActionInput = { ...form, description: form.description.trim(), result: form.result.trim(), followUpNote: form.followUpNote.trim(), attachmentNotes: form.attachmentNotes.trim(), actionAt: actionDate(form.actionAt) };
      if (editing === null) {
        await createAction(ticketId, input, csrfToken);
      } else {
        const original = actions.find((a) => a.id === editing);
        if (!original) throw new Error("The action is no longer available.");
        const changed: Partial<ActionInput> = {};
        if (input.description !== original.description) changed.description = input.description;
        if (input.status !== original.status) changed.status = input.status;
        if (input.assigneeId !== (original.assignee?.id ?? null)) changed.assigneeId = input.assigneeId;
        if (input.actionAt !== original.actionAt) changed.actionAt = input.actionAt;
        if (input.result !== original.result) changed.result = input.result;
        if (input.followUpRequired !== original.followUpRequired) changed.followUpRequired = input.followUpRequired;
        if (input.followUpNote !== original.followUpNote) changed.followUpNote = input.followUpNote;
        if (input.attachmentNotes !== original.attachmentNotes) changed.attachmentNotes = input.attachmentNotes;
        await updateAction(ticketId, editing, original.version, changed, csrfToken);
      }
      setForm(null); setEditing(null); await load(); onChanged?.();
    } catch (error) {
      const apiError = error instanceof ApiRequestError ? error : null;
      if (apiError?.status === 409) setConflict(apiError.message); else setMessage(apiError?.message ?? "Unable to save action.");
      setErrors(apiError?.fieldErrors ?? {});
    } finally { setSaving(false); }
  }
  async function showHistory(actionId: number) { setHistory({ id: actionId, rows: [] }); try { setHistory({ id: actionId, rows: await fetchActionRevisions(ticketId, actionId) }); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load action history."); setHistory(null); } }

  if (state === "loading") return <section className="staff-detail__panel" aria-labelledby="actions-taken-title"><h2 id="actions-taken-title">Actions Taken</h2><p className="text-secondary">Loading actions…</p></section>;
  if (state === "error") return <section className="staff-detail__panel" aria-labelledby="actions-taken-title"><h2 id="actions-taken-title">Actions Taken</h2><p role="alert" className="form-error">{message}</p><button className="btn btn-outline-success" onClick={() => void load()}>Retry</button></section>;
  return <section className="staff-detail__panel actions-taken" aria-labelledby="actions-taken-title">
    <div className="d-flex justify-content-between align-items-center gap-2"><h2 id="actions-taken-title">Actions Taken</h2>{!readOnly && <button className="btn btn-success btn-sm" disabled={closed} onClick={beginCreate}>Add action</button>}</div>
    {closed && !readOnly && <p className="text-secondary small">Actions cannot be added to a closed or cancelled ticket.</p>}
    {conflict && <div role="alert" className="alert alert-warning d-flex justify-content-between align-items-center gap-2"><span>{conflict}</span><button className="btn btn-sm btn-outline-success" onClick={() => { setConflict(""); void load(); }}>Reload</button></div>}
    {message && <p role="alert" className="form-error">{message}</p>}
    {actions.length === 0 ? <p className="text-secondary">No actions recorded yet.</p> : <div className="actions-taken__list">{actions.map((action) => <article className="actions-taken__item" key={action.id}>
      <div className="d-flex flex-wrap justify-content-between gap-2"><strong><span className="status-badge">{statusLabel[action.status]}</span> · {new Date(action.actionAt).toLocaleString()}</strong><span className="text-secondary">By {action.performedBy.name} · {action.assignee?.name ?? "Unassigned"}</span></div>
      <p className="mb-1">{action.description}</p>{action.result && <p className="mb-1"><strong>Result:</strong> {action.result}</p>}{action.followUpRequired && <p className="mb-1"><strong>Follow-up needed:</strong> {action.followUpNote}</p>}{action.attachmentNotes && <p className="mb-1"><strong>Attachment notes:</strong> {action.attachmentNotes}</p>}
      {!readOnly && <div className="d-flex gap-2 mt-2">{!['COMPLETED', 'CANCELLED'].includes(action.status) && <button className="btn btn-sm btn-outline-success" onClick={() => beginEdit(action)}>Edit</button>}<button className="btn btn-sm btn-outline-success" onClick={() => void showHistory(action.id)}>History</button></div>}
      {readOnly && null}
    </article>)}</div>}
    {form && <form className="actions-taken__form mt-4" onSubmit={(event) => void submit(event)} noValidate><h3>{editing === null ? "Add action" : "Edit action"}</h3>
      <label>Description<textarea value={form.description} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "action-description-error" : undefined} onChange={(e) => setField("description", e.target.value)} />{errors.description && <span id="action-description-error" className="field-error">{errors.description}</span>}</label>
      <label>Status<select value={form.status} onChange={(e) => setField("status", e.target.value as ActionStatus)}>{(editing === null ? createStatuses : editStatuses(actions.find((a) => a.id === editing)!)).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select>{ticketStatus === "Resolved" && editing === null && <span className="form-help">Only Completed actions can be added. Reopen the ticket to add open work.</span>}</label>
      <label>Assignee<select aria-invalid={Boolean(errors.assigneeId)} aria-describedby={errors.assigneeId ? "action-assignee-error" : undefined} value={form.assigneeId ?? ""} onChange={(e) => setField("assigneeId", e.target.value ? Number(e.target.value) : null)}><option value="">Unassigned</option>{assignable.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>{errors.assigneeId && <span id="action-assignee-error" className="field-error">{errors.assigneeId}</span>}</label>
      <label>Action time<input type="datetime-local" aria-invalid={Boolean(errors.actionAt)} aria-describedby={errors.actionAt ? "action-time-error" : undefined} value={form.actionAt} onChange={(e) => setField("actionAt", e.target.value)} />{errors.actionAt && <span id="action-time-error" className="field-error">{errors.actionAt}</span>}</label>
      <label>Result<textarea value={form.result} aria-invalid={Boolean(errors.result)} aria-describedby={errors.result ? "action-result-error" : undefined} onChange={(e) => setField("result", e.target.value)} />{errors.result && <span id="action-result-error" className="field-error">{errors.result}</span>}</label>
      <label className="d-flex gap-2 align-items-center"><input type="checkbox" checked={form.followUpRequired} onChange={(e) => setField("followUpRequired", e.target.checked)} /> Follow-up required</label>
      {form.followUpRequired && <label>Follow-up note<textarea value={form.followUpNote} aria-invalid={Boolean(errors.followUpNote)} aria-describedby={errors.followUpNote ? "action-follow-up-error" : undefined} onChange={(e) => setField("followUpNote", e.target.value)} />{errors.followUpNote && <span id="action-follow-up-error" className="field-error">{errors.followUpNote}</span>}</label>}
      <label>Attachment notes<textarea value={form.attachmentNotes} onChange={(e) => setField("attachmentNotes", e.target.value)} /></label>
      <div className="d-flex gap-2"><button className="btn btn-success" disabled={saving}>{saving ? "Saving…" : "Save action"}</button><button type="button" className="btn btn-outline-success" disabled={saving} onClick={() => { setForm(null); setEditing(null); }}>Cancel</button></div>
    </form>}
    {history && <div className="actions-taken__history mt-4"><h3>Action history</h3>{history.rows.length === 0 ? <p>Loading history…</p> : <ol>{history.rows.map((row) => <li key={row.id}><strong>Revision {row.revision}</strong> · {row.editedBy.name} · {new Date(row.editedAt).toLocaleString()}<p className="mb-0">{row.description}</p></li>)}</ol>}<button className="btn btn-sm btn-outline-success" onClick={() => setHistory(null)}>Close history</button></div>}
  </section>;
}
