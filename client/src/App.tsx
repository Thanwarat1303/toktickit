import { useState } from "react";
import { checkSystem, type Category } from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

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
        <div className="mt-3">
          <p>
            System Status:{" "}
            <strong className="text-success">Online</strong>
          </p>

          <h2 className="h5">Supported Request Categories:</h2>

          <ol>
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ol>
        </div>
      )}

      {state === "error" && (
        <div className="mt-3 text-danger">
          <strong>System Status: Offline</strong>
          <p className="mb-0">
            Unable to connect to TokTickIT API.
          </p>
        </div>
      )}
    </div>
  );
}