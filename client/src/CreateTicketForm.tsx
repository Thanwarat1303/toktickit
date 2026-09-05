import { FormEvent, useEffect, useState } from "react";
import {
  createTicket,
  getRelatedSystems,
  checkSystem,
  type Category,
  type CreatedTicket,
  type RelatedSystem,
  type Requester,
} from "./api.js";

interface CreateTicketFormProps {
  requester: Requester;
}

type LoadState = "loading" | "ready" | "error";
type FieldName = "categoryId" | "relatedSystemId" | "summary" | "description" | "priority";
type FormErrors = Partial<Record<FieldName, string>>;

const emptyForm = {
  categoryId: "",
  relatedSystemId: "",
  summary: "",
  description: "",
  priority: "Medium",
};

export default function CreateTicketForm({ requester }: CreateTicketFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);

  async function loadReferences() {
    setLoadState("loading");

    try {
      const result = await checkSystem();
      const systems = await getRelatedSystems();
      setCategories(result.categories);
      setRelatedSystems(systems);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => {
    void loadReferences();
  }, []);

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!form.categoryId) nextErrors.categoryId = "Please choose a category.";
    if (!form.relatedSystemId) nextErrors.relatedSystemId = "Please choose a related system.";
    if (!form.summary.trim()) nextErrors.summary = "Summary is required.";
    else if (form.summary.trim().length > 100) nextErrors.summary = "Summary must not exceed 100 characters.";
    if (!form.description.trim()) nextErrors.description = "Description is required.";
    else if (form.description.trim().length > 2000) nextErrors.description = "Description must not exceed 2,000 characters.";
    if (!form.priority) nextErrors.priority = "Please choose a priority.";

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitError("");

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const ticket = await createTicket({
        requesterId: requester.id,
        categoryId: Number(form.categoryId),
        relatedSystemId: Number(form.relatedSystemId),
        summary: form.summary.trim(),
        description: form.description.trim(),
        priority: form.priority as "Low" | "Medium" | "High",
      });
      setCreatedTicket(ticket);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to create the ticket."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  }

  if (createdTicket) {
    return (
      <section className="ticket-success-card mt-4" aria-live="polite">
        <p className="eyebrow mb-2">Ticket created</p>
        <h2 className="h3">Your support request is ready</h2>
        <p className="mb-2">Your Ticket Number is:</p>
        <p className="ticket-number">{createdTicket.ticketNumber}</p>
        <p className="text-secondary mb-4">
          It was created with status <strong>{createdTicket.status}</strong>.
        </p>
        <button
          className="btn btn-zen"
          onClick={() => {
            setForm(emptyForm);
            setErrors({});
            setSubmitError("");
            setCreatedTicket(null);
          }}
        >
          Create another ticket
        </button>
      </section>
    );
  }

  return (
    <section className="ticket-form-card mt-4" aria-labelledby="create-ticket-heading">
      <div className="ticket-form-card__heading">
        <div>
          <p className="eyebrow mb-2">New support request</p>
          <h2 id="create-ticket-heading" className="h3 mb-2">Create an IT Support Ticket</h2>
          <p className="text-secondary mb-0">
            Tell us what happened and choose the service affected.
          </p>
        </div>
        <div className="read-only-requester">
          <span>Creating as</span>
          <strong>{requester.name}</strong>
        </div>
      </div>

      {loadState === "loading" && (
        <div className="state-panel mt-4" role="status">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          Loading ticket options...
        </div>
      )}

      {loadState === "error" && (
        <div className="state-panel state-panel--error mt-4" role="alert">
          <div>
            <strong>Ticket options are unavailable</strong>
            <p className="mb-0">Check the API connection and try again.</p>
          </div>
          <button className="btn btn-outline-danger" onClick={loadReferences}>
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && (
        <form className="mt-4" noValidate onSubmit={handleSubmit}>
          {submitError && (
            <div className="alert alert-danger" role="alert">{submitError}</div>
          )}
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="categoryId">Category <span className="text-danger">*</span></label>
              <select id="categoryId" className={`form-select ${errors.categoryId ? "is-invalid" : ""}`} value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)} aria-describedby={errors.categoryId ? "categoryId-error" : undefined}>
                <option value="">Choose a category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              {errors.categoryId && <div id="categoryId-error" className="invalid-feedback">{errors.categoryId}</div>}
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="relatedSystemId">Related System <span className="text-danger">*</span></label>
              <select id="relatedSystemId" className={`form-select ${errors.relatedSystemId ? "is-invalid" : ""}`} value={form.relatedSystemId} onChange={(event) => updateField("relatedSystemId", event.target.value)} aria-describedby={errors.relatedSystemId ? "relatedSystemId-error" : undefined}>
                <option value="">Choose a related system</option>
                {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
              </select>
              {errors.relatedSystemId && <div id="relatedSystemId-error" className="invalid-feedback">{errors.relatedSystemId}</div>}
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="summary">Summary <span className="text-danger">*</span></label>
              <input id="summary" className={`form-control ${errors.summary ? "is-invalid" : ""}`} value={form.summary} onChange={(event) => updateField("summary", event.target.value)} maxLength={101} aria-describedby="summary-help" />
              <div id="summary-help" className="form-text">{form.summary.length}/100 characters</div>
              {errors.summary && <div className="invalid-feedback d-block">{errors.summary}</div>}
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="description">Description <span className="text-danger">*</span></label>
              <textarea id="description" className={`form-control ${errors.description ? "is-invalid" : ""}`} rows={5} value={form.description} onChange={(event) => updateField("description", event.target.value)} maxLength={2001} aria-describedby="description-help" />
              <div id="description-help" className="form-text">{form.description.length}/2,000 characters</div>
              {errors.description && <div className="invalid-feedback d-block">{errors.description}</div>}
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="priority">Priority <span className="text-danger">*</span></label>
              <select id="priority" className={`form-select ${errors.priority ? "is-invalid" : ""}`} value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              {errors.priority && <div className="invalid-feedback">{errors.priority}</div>}
            </div>
          </div>
          <div className="d-flex justify-content-end mt-4">
            <button className="btn btn-zen px-4" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Create Ticket"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
