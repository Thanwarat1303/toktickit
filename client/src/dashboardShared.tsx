import { ReactNode, useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "./api.js";
import { Route, routeHref } from "./routes.js";

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "error" }
  | { kind: "forbidden" };

export function useDashboard<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ kind: "loading" });
  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", data: await fetcher() });
    } catch (error) {
      setState(error instanceof ApiRequestError && error.status === 403 ? { kind: "forbidden" } : { kind: "error" });
    }
  }, [fetcher]);
  useEffect(() => { void load(); }, [load]);
  return { state, reload: load };
}

export function DashboardStatus({ state, reload }: { state: LoadState<unknown>; reload: () => void }) {
  if (state.kind === "loading") return <p className="text-secondary" role="status">Loading dashboard…</p>;
  if (state.kind === "forbidden") return <div className="state-panel state-panel--error" role="alert">You do not have permission to view this page.</div>;
  if (state.kind === "error") return <div className="state-panel state-panel--error" role="alert"><span>Unable to load the dashboard.</span> <button className="btn btn-outline-success btn-sm" onClick={reload}>Retry</button></div>;
  return null;
}

export function plural(count: number, one: string, many: string) { return count === 1 ? one : many; }

export function DrillLink({ route, label, children = "View", className = "btn btn-outline-success btn-sm" }: { route: Route; label: string; children?: ReactNode; className?: string }) {
  return <a href={routeHref(route)} className={className} aria-label={label}>{children}</a>;
}

export function MetricCard({ title, value, children }: { title: string; value?: number; children?: ReactNode }) {
  return <div className="card h-100 dashboard-card"><div className="card-body"><h3 className="h6 card-title">{title}</h3>{value !== undefined && <><p className="display-6 mb-1">{value}</p>{value === 0 && <p className="text-muted small mb-2">Nothing here</p>}</>}{children}</div></div>;
}
