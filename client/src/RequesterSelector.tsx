import { useEffect, useState } from "react";
import { getRequesters, type Requester } from "./api.js";

interface RequesterSelectorProps {
  onSelect: (requester: Requester) => void;
}

type LoadState = "loading" | "success" | "error";

export default function RequesterSelector({ onSelect }: RequesterSelectorProps) {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");

  async function loadRequesters() {
    setLoadState("loading");

    try {
      const result = await getRequesters();
      setRequesters(result);
      setLoadState("success");
    } catch {
      setRequesters([]);
      setLoadState("error");
    }
  }

  useEffect(() => {
    void loadRequesters();
  }, []);

  function handleContinue() {
    const requester = requesters.find(
      (item) => item.id === Number(selectedId)
    );

    if (requester) {
      onSelect(requester);
    }
  }

  return (
    <section className="requester-card" aria-labelledby="requester-heading">
      <div className="requester-card__icon" aria-hidden="true">
        <span>DR</span>
      </div>

      <p className="eyebrow mb-2">Development mode</p>
      <h2 id="requester-heading" className="h3 mb-2">
        Select a Development Requester
      </h2>
      <p className="text-secondary mb-4">
        Choose a test identity before using requester-specific ticket features.
        This selector is not a real login.
      </p>

      {loadState === "loading" && (
        <div className="state-panel" role="status">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          Loading requesters...
        </div>
      )}

      {loadState === "error" && (
        <div className="state-panel state-panel--error" role="alert">
          <div>
            <strong>Requester list unavailable</strong>
            <p className="mb-0">Check the API connection and try again.</p>
          </div>
          <button className="btn btn-outline-danger" onClick={loadRequesters}>
            Try again
          </button>
        </div>
      )}

      {loadState === "success" && requesters.length === 0 && (
        <div className="state-panel" role="status">
          No active Development Requesters are available.
        </div>
      )}

      {loadState === "success" && requesters.length > 0 && (
        <div className="text-start">
          <label className="form-label fw-semibold" htmlFor="requester">
            Requester <span className="text-danger">*</span>
          </label>
          <select
            id="requester"
            className="form-select form-select-lg"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">Choose a requester</option>
            {requesters.map((requester) => (
              <option key={requester.id} value={requester.id}>
                {requester.name} - {requester.email}
              </option>
            ))}
          </select>
          <p className="form-text">
            Only active requester profiles are shown.
          </p>

          <button
            className="btn btn-zen btn-lg w-100 mt-3"
            disabled={!selectedId}
            onClick={handleContinue}
          >
            Continue as requester
          </button>
        </div>
      )}
    </section>
  );
}
