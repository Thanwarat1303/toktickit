import { useState } from "react";
import {
  checkSystem,
  type Category,
  type Requester,
} from "./api.js";
import RequesterSelector from "./RequesterSelector.js";

type UiState = "idle" | "loading" | "success" | "error";
const REQUESTER_STORAGE_KEY = "toktickit.developmentRequester";

function loadSavedRequester(): Requester | null {
  const saved = localStorage.getItem(REQUESTER_STORAGE_KEY);

  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(saved) as Requester;
  } catch {
    localStorage.removeItem(REQUESTER_STORAGE_KEY);
    return null;
  }
}

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [requester, setRequester] = useState<Requester | null>(
    loadSavedRequester
  );

  function handleRequesterSelect(selectedRequester: Requester) {
    localStorage.setItem(
      REQUESTER_STORAGE_KEY,
      JSON.stringify(selectedRequester)
    );
    setRequester(selectedRequester);
  }

  function handleRequesterChange() {
    localStorage.removeItem(REQUESTER_STORAGE_KEY);
    setRequester(null);
  }

  async function handleCheck() {
    setState("loading");
    setCategories([]);

    try {
      const result = await checkSystem();

      setCategories(result.categories);
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="app-shell min-vh-100">
      <header className="topbar">
        <div className="container d-flex align-items-center justify-content-between gap-3">
          <a className="brand" href="#" aria-label="TokTickIT home">
            <span className="brand__mark">T</span>
            <span>TokTickIT</span>
          </a>

          {requester && (
            <div className="requester-chip">
              <span className="requester-chip__avatar" aria-hidden="true">
                {requester.name.charAt(0)}
              </span>
              <span>
                <small>Current requester</small>
                <strong>{requester.name}</strong>
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="container py-5 page-content">
        <div className="hero-copy text-center mx-auto mb-4">
          <p className="eyebrow mb-2">IT support, made simple</p>
          <h1 className="display-6 fw-bold mb-3">
            TokTickIT <span>IT Service Desk</span>
          </h1>
          <p className="lead text-secondary mb-0">
            Select a development identity to create and follow your support tickets.
          </p>
        </div>

        {!requester ? (
          <RequesterSelector onSelect={handleRequesterSelect} />
        ) : (
          <section className="selected-card" aria-labelledby="selected-heading">
            <div>
              <p className="eyebrow mb-2">Ready to continue</p>
              <h2 id="selected-heading" className="h3 mb-2">
                Welcome, {requester.name}
              </h2>
              <p className="text-secondary mb-1">{requester.email}</p>
              <p className="mb-0">
                Your requester identity is active for this browser.
              </p>
            </div>
            <button
              className="btn btn-outline-zen"
              onClick={handleRequesterChange}
            >
              Change requester
            </button>
          </section>
        )}

        <section className="system-card mt-4" aria-labelledby="system-heading">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <p className="eyebrow mb-1">Development diagnostics</p>
              <h2 id="system-heading" className="h5 mb-0">System connection</h2>
            </div>
            <button
              className="btn btn-outline-zen"
              onClick={handleCheck}
              disabled={state === "loading"}
            >
              {state === "loading" ? "Loading..." : "Check System"}
            </button>
          </div>

          {state === "loading" && (
            <p className="mt-3 mb-0">Checking the system...</p>
          )}

          {state === "success" && (
            <div className="mt-3">
              <p>
                System Status:{" "}
                <strong className="text-success">Online</strong>
              </p>

              <h3 className="h6">Supported Request Categories:</h3>

              <ol className="mb-0">
                {categories.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))}
              </ol>
            </div>
          )}

          {state === "error" && (
            <div className="mt-3 text-danger">
              <strong>System Status: Offline</strong>
              <p className="mb-0">Unable to connect to TokTickIT API.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
