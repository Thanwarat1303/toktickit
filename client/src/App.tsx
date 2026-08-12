import { useState } from "react";
import { checkHealth } from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");

  async function handleCheck() {
    setState("loading");

    try {
      await checkHealth();
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button
        className="btn btn-success"
        onClick={handleCheck}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Loading..." : "Check System"}
      </button>

      {state === "loading" && (
        <p className="mt-3">Checking the system...</p>
      )}

      {state === "success" && (
        <p className="mt-3">
          System Status: <strong className="text-success">Online</strong>
        </p>
      )}

      {state === "error" && (
        <div className="mt-3 text-danger">
          <strong>System Status: Offline</strong>
          <p className="mb-0">Unable to connect to TokTickIT API.</p>
        </div>
      )}
    </div>
  );
}