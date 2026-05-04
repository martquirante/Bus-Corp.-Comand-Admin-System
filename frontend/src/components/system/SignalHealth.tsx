"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RadioTower, RefreshCw, Server } from "lucide-react";
import { api, apiBaseUrl, getSessionToken } from "@/services/api";
import { formatDateTime } from "@/utils/format";

type SignalState = "checking" | "connected" | "demo" | "offline";

type HealthSnapshot = {
  service: string;
  firebase: "connected" | "rtdb-rest" | "not-configured";
  supabase: "connected" | "not-configured" | "error";
  supabaseMode: "service-role" | "postgres" | "not-configured";
  auth: "dev-bypass" | "protected";
  uptime: number;
  generatedAt: string;
  source: "firebase" | "rtdb-rest" | "demo";
};

const labelForState = (state: SignalState) => {
  if (state === "connected") return "Live Firebase connected";
  if (state === "demo") return "API online, RTDB REST active";
  if (state === "offline") return "API offline";
  return "Checking signal";
};

const formatUptime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `${Math.round(seconds)}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
};

export function SignalHealth() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<SignalState>("checking");
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setState((current) => (current === "offline" ? "checking" : current));

    try {
      const result = await api.health();
      const nextState = result.data.firebase === "connected" || result.data.firebase === "rtdb-rest" ? "connected" : "demo";

      setHealth({
        service: result.data.service,
        firebase: result.data.firebase,
        supabase: result.data.supabase,
        supabaseMode: result.data.supabaseMode,
        auth: result.data.auth,
        uptime: result.data.uptime,
        generatedAt: result.generatedAt,
        source: result.source
      });
      setState(nextState);
    } catch (err) {
      setState("offline");
      setHealth(null);
      setError(err instanceof Error ? err.message : "Backend health check failed.");
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const openPanel = async () => {
    setIsOpen((current) => !current);
    if (!isOpen) await refresh();
  };

  const syncToSql = async () => {
    if (!getSessionToken()) {
      setSyncMessage("Sync requires an admin login/session. Dev bypass is only for read-only dashboard data.");
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const result = await api.syncRealtimeToSql();
      setSyncMessage(
        result.data.synced
          ? "Synced Firebase routes to Supabase PostgreSQL."
          : result.data.reason || "Supabase sync is not configured."
      );
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Supabase sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="signal-health" ref={panelRef}>
      <button
        type="button"
        className={`icon-button signal-button signal-${state}`}
        aria-label={labelForState(state)}
        aria-expanded={isOpen}
        title={labelForState(state)}
        onClick={openPanel}
      >
        <RadioTower size={18} />
        <span className="signal-dot" />
      </button>

      {isOpen ? (
        <section className="signal-panel" aria-label="System health">
          <div className="signal-panel-header">
            <div>
              <span>System health</span>
              <strong>{labelForState(state)}</strong>
            </div>
            {state === "checking" ? (
              <Loader2 size={18} className="spin-icon" />
            ) : state === "offline" ? (
              <AlertTriangle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
          </div>

          <div className="signal-health-list">
            <div>
              <Server size={15} />
              <span>API</span>
              <strong>{state === "offline" ? "Unavailable" : "Online"}</strong>
            </div>
            <div>
              <RadioTower size={15} />
              <span>Firebase RTDB</span>
              <strong>
                {health?.firebase === "connected"
                  ? "Admin SDK connected"
                  : health?.firebase === "rtdb-rest"
                    ? "REST connected"
                    : "Unknown"}
              </strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{health?.source || "none"}</strong>
            </div>
            <div>
              <span>Supabase SQL</span>
              <strong>
                {health?.supabase === "connected"
                  ? `Ready (${health.supabaseMode})`
                  : health?.supabase === "error"
                    ? "Config error"
                    : "Needs backend env"}
              </strong>
            </div>
            <div>
              <span>Uptime</span>
              <strong>{health ? formatUptime(health.uptime) : "n/a"}</strong>
            </div>
            <div>
              <span>Auth</span>
              <strong>{health?.auth === "dev-bypass" ? "Dev bypass" : "Protected"}</strong>
            </div>
            <div className="signal-wide">
              <span>Endpoint</span>
              <strong>{apiBaseUrl}/health</strong>
            </div>
            <div className="signal-wide">
              <span>Last checked</span>
              <strong>{health ? formatDateTime(health.generatedAt) : error || "Checking..."}</strong>
            </div>
          </div>

          {error ? <p className="signal-error">{error}</p> : null}
          {syncMessage ? <p className="signal-sync-message">{syncMessage}</p> : null}

          <div className="signal-actions">
            <button type="button" className="soft-button compact-button" onClick={refresh}>
              <RefreshCw size={14} /> Check again
            </button>
            <button type="button" className="soft-button compact-button" onClick={syncToSql} disabled={isSyncing}>
              {isSyncing ? <Loader2 size={14} className="spin-icon" /> : <Server size={14} />}
              Sync Supabase
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
