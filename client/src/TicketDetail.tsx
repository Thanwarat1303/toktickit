import { useEffect, useState } from "react";
import {
  ApiRequestError,
  attachmentDownloadUrl,
  getTicketAttachments,
  getTicketDetail,
  removeAttachment,
  type AttachmentSummary,
  type Requester,
  type TicketDetail as TicketDetailData,
} from "./api.js";

interface TicketDetailProps {
  requester: Requester;
  ticketId: number;
  onBack: () => void;
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TicketDetail({ requester, ticketId, onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [attachments, setAttachments] = useState<AttachmentSummary[]>([]);
  const [loadingTicket, setLoadingTicket] = useState(true);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [ticketError, setTicketError] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);

  async function loadAttachments() {
    setLoadingAttachments(true);
    setAttachmentError("");

    try {
      const loadedAttachments = await getTicketAttachments(ticketId, requester.id);
      setAttachments(loadedAttachments);
    } catch (caught) {
      setAttachmentError(
        caught instanceof ApiRequestError
          ? caught.message
          : "Unable to load ticket attachments."
      );
    } finally {
      setLoadingAttachments(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    setLoadingTicket(true);
    setTicketError("");

    getTicketDetail(ticketId, requester.id)
      .then((loadedTicket) => {
        if (!cancelled) setTicket(loadedTicket);
      })
      .catch((caught) => {
        if (!cancelled) {
          setTicket(null);
          setTicketError(
            caught instanceof ApiRequestError
              ? caught.message
              : "Unable to load ticket details."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTicket(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticketId, requester.id]);

  useEffect(() => {
    void loadAttachments();
  }, [ticketId, requester.id]);

  async function handleRemoveAttachment(attachment: AttachmentSummary) {
    const reason = window.prompt(
      `Why do you want to remove "${attachment.originalFilename}"?`
    );

    if (!reason?.trim()) return;

    setRemovingId(attachment.id);
    setAttachmentError("");

    try {
      const removedAttachment = await removeAttachment(
        attachment.id,
        requester.id,
        reason
      );

      setAttachments((currentAttachments) =>
        currentAttachments.map((current) =>
          current.id === removedAttachment.id ? removedAttachment : current
        )
      );
    } catch (caught) {
      setAttachmentError(
        caught instanceof ApiRequestError
          ? caught.message
          : "Unable to remove the attachment."
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="ticket-detail-card" aria-labelledby="ticket-detail-heading">
      <button type="button" className="btn btn-outline-zen mb-4" onClick={onBack}>
        ← Back to My Tickets
      </button>

      {loadingTicket && <div className="state-panel">Loading ticket details…</div>}

      {!loadingTicket && ticketError && (
        <div role="alert" className="state-panel state-panel--error">
          {ticketError}
        </div>
      )}

      {!loadingTicket && ticket && (
        <>
          <div className="ticket-detail-card__header">
            <div>
              <p className="eyebrow mb-1">Ticket detail</p>
              <h2 id="ticket-detail-heading" className="h3 mb-2">
                {ticket.ticketNumber}
              </h2>
              <p className="text-secondary mb-0">{ticket.summary}</p>
            </div>
            <span className="status-badge">{ticket.status}</span>
          </div>

          <dl className="ticket-detail-grid">
            <div><dt>Requester</dt><dd>{ticket.requester.name}</dd></div>
            <div><dt>Category</dt><dd>{ticket.category.name}</dd></div>
            <div><dt>Related system</dt><dd>{ticket.relatedSystem.name}</dd></div>
            <div><dt>Priority</dt><dd><span className={`priority-badge priority-badge--${ticket.priority.toLowerCase()}`}>{ticket.priority}</span></dd></div>
            <div><dt>Created</dt><dd>{new Date(ticket.createdAt).toLocaleString()}</dd></div>
            <div><dt>Last updated</dt><dd>{new Date(ticket.updatedAt).toLocaleString()}</dd></div>
          </dl>

          <div className="ticket-description">
            <h3 className="h5">Description</h3>
            <p className="mb-0">{ticket.description}</p>
          </div>
        </>
      )}

      <section className="attachments-panel mt-4" aria-labelledby="attachments-heading">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div>
            <p className="eyebrow mb-1">Supporting files</p>
            <h3 id="attachments-heading" className="h5 mb-0">Attachments</h3>
          </div>
          <button
            type="button"
            className="btn btn-outline-zen"
            onClick={() => void loadAttachments()}
            disabled={loadingAttachments}
          >
            {loadingAttachments ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingAttachments && <div className="state-panel">Loading attachments…</div>}

        {!loadingAttachments && attachmentError && (
          <div role="alert" className="state-panel state-panel--error">
            {attachmentError}
          </div>
        )}

        {!loadingAttachments && !attachmentError && attachments.length === 0 && (
          <div className="empty-state">
            <h4 className="h6">No attachments yet</h4>
            <p className="mb-0">Uploaded files for this ticket will appear here.</p>
          </div>
        )}

        {!loadingAttachments && !attachmentError && attachments.length > 0 && (
          <ul className="attachment-list">
            {attachments.map((attachment) => {
              const isRemoved = Boolean(attachment.removedAt);

              return (
                <li
                  key={attachment.id}
                  className={isRemoved ? "attachment-item attachment-item--removed" : "attachment-item"}
                >
                  <div>
                    <strong>{attachment.originalFilename}</strong>
                    <p className="mb-0 text-secondary">
                      {attachment.mimeType} · {formatBytes(attachment.sizeBytes)} · Uploaded {new Date(attachment.createdAt).toLocaleString()}
                    </p>
                    {isRemoved && (
                      <p className="mb-0 text-secondary">
                        Removed {new Date(attachment.removedAt as string).toLocaleString()}
                        {attachment.removalReason ? ` — ${attachment.removalReason}` : ""}
                      </p>
                    )}
                  </div>

                  {isRemoved ? (
                    <span className="status-badge">Removed</span>
                  ) : (
                    <div className="attachment-actions">
                      <a
                        className="btn btn-outline-zen"
                        href={attachmentDownloadUrl(attachment.id, requester.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => void handleRemoveAttachment(attachment)}
                        disabled={removingId === attachment.id}
                      >
                        {removingId === attachment.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
