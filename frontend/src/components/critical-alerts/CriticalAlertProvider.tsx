"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CriticalAlert } from "@pos-bus/shared";
import { AlertTriangle, BellRing, CheckCircle2, LocateFixed, ShieldAlert, X } from "lucide-react";
import { api } from "@/services/api";
import { realtimeClient } from "@/services/realtimeClient";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/utils/format";

type CriticalAlertContextValue = {
  activeAlerts: CriticalAlert[];
  openAlert: (alert: CriticalAlert) => void;
};

const CriticalAlertContext = createContext<CriticalAlertContextValue | null>(null);
const dismissedStorageKey = "posBusDismissedCriticalAlerts";

const readDismissed = () => {
  if (typeof window === "undefined") return new Set<string>();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(dismissedStorageKey) || "[]") as string[]);
  } catch {
    return new Set<string>();
  }
};

const writeDismissed = (ids: Set<string>) => {
  window.localStorage.setItem(dismissedStorageKey, JSON.stringify(Array.from(ids)));
};

const playAlertCue = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 740;
    gain.gain.value = 0.045;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  } catch {
    // Browser autoplay policy may block sound until the user interacts with the page.
  }

  if ("vibrate" in navigator) {
    navigator.vibrate?.([180, 80, 180]);
  }
};

export function CriticalAlertProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);
  const [toastAlert, setToastAlert] = useState<CriticalAlert | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => readDismissed());
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => !alert.resolvedAt && !dismissedIds.has(alert.id)),
    [alerts, dismissedIds]
  );
  const currentAlert = visibleAlerts.find((alert) => alert.id === currentAlertId) || visibleAlerts[0] || null;

  const ingestAlerts = useCallback((incoming: CriticalAlert[]) => {
    setAlerts(incoming);
    const next = incoming.find((alert) => !alert.resolvedAt && !readDismissed().has(alert.id));
    if (!next) return;

    setSeenIds((current) => {
      if (current.has(next.id)) return current;
      playAlertCue();
      setToastAlert(next);
      setCurrentAlertId(next.id);
      return new Set([...current, next.id]);
    });
  }, []);

  useEffect(() => {
    if (!session) {
      setAlerts([]);
      setCurrentAlertId(null);
      return;
    }

    let pollTimer = 0;
    const load = async () => {
      try {
        const result = await api.getActiveCriticalAlerts();
        ingestAlerts(result.data);
      } catch {
        // The notification center and health indicator still expose backend state.
      }
    };

    void load();
    pollTimer = window.setInterval(load, 10000);
    const close = realtimeClient.streamCriticalAlerts({
      onData(payload) {
        ingestAlerts(payload.data);
      }
    });

    return () => {
      window.clearInterval(pollTimer);
      close();
    };
  }, [ingestAlerts, session]);

  const openAlert = (alert: CriticalAlert) => {
    setCurrentAlertId(alert.id);
    setToastAlert(null);
  };

  const dismissLocal = async (alert: CriticalAlert) => {
    const next = new Set(dismissedIds);
    next.add(alert.id);
    setDismissedIds(next);
    writeDismissed(next);
    setCurrentAlertId(null);
    setToastAlert(null);
    void api.dismissCriticalAlert(alert.id).catch(() => undefined);
  };

  const acknowledge = async (alert: CriticalAlert) => {
    await api.acknowledgeCriticalAlert(alert.id);
    setAlerts((current) =>
      current.map((item) => (item.id === alert.id ? { ...item, acknowledgedAt: Date.now() } : item))
    );
  };

  const resolve = async (alert: CriticalAlert) => {
    await api.resolveCriticalAlert(alert.id);
    setAlerts((current) =>
      current.map((item) => (item.id === alert.id ? { ...item, resolvedAt: Date.now() } : item))
    );
    setCurrentAlertId(null);
    setToastAlert(null);
  };

  const locate = (alert: CriticalAlert) => {
    const query = encodeURIComponent(alert.deviceId || alert.busNumber || alert.sourceKey);
    router.push(`/fleet-map?bus=${query}`);
  };

  return (
    <CriticalAlertContext.Provider value={{ activeAlerts: visibleAlerts, openAlert }}>
      {children}
      {currentAlert ? (
        <div className="critical-alert-backdrop" role="presentation">
          <section className="critical-alert-modal" role="dialog" aria-modal="true" aria-labelledby="critical-alert-title">
            <div className="critical-alert-header">
              <div>
                <span><ShieldAlert size={18} /> Critical Alert</span>
                <h2 id="critical-alert-title">{currentAlert.title}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Dismiss for now" onClick={() => dismissLocal(currentAlert)}>
                <X size={18} />
              </button>
            </div>

            <p className="critical-alert-message">{currentAlert.message}</p>

            <dl className="critical-alert-details">
              <div><dt>Bus</dt><dd>{currentAlert.busNumber || "Not reported"}</dd></div>
              <div><dt>Device</dt><dd>{currentAlert.deviceId || currentAlert.sourceKey}</dd></div>
              <div><dt>Driver</dt><dd>{currentAlert.driver || "Not reported"}</dd></div>
              <div><dt>Conductor</dt><dd>{currentAlert.conductor || "Not reported"}</dd></div>
              <div><dt>Reporter</dt><dd>{currentAlert.reporter || "System"} {currentAlert.reporterRole ? `(${currentAlert.reporterRole})` : ""}</dd></div>
              <div><dt>Route</dt><dd>{currentAlert.route || "Unassigned"}</dd></div>
              <div><dt>Location</dt><dd>{currentAlert.locationText || (currentAlert.lat && currentAlert.lng ? `${currentAlert.lat}, ${currentAlert.lng}` : "No GPS yet")}</dd></div>
              <div><dt>Reported</dt><dd>{formatDateTime(currentAlert.timestamp)}</dd></div>
              <div><dt>Issue</dt><dd>{currentAlert.issueType}</dd></div>
              <div><dt>Status</dt><dd>{currentAlert.status}</dd></div>
            </dl>

            <div className="critical-alert-actions">
              <button type="button" className="primary-action" onClick={() => locate(currentAlert)}>
                <LocateFixed size={17} /> Locate bus on map
              </button>
              <button type="button" className="soft-button" onClick={() => acknowledge(currentAlert)}>
                <BellRing size={17} /> Acknowledge
              </button>
              <button type="button" className="soft-button resolve-action" onClick={() => resolve(currentAlert)}>
                <CheckCircle2 size={17} /> Mark resolved
              </button>
            </div>

            {visibleAlerts.length > 1 ? (
              <div className="critical-alert-queue">
                <span>{visibleAlerts.length} active alerts</span>
                {visibleAlerts.slice(0, 4).map((alert) => (
                  <button key={alert.id} type="button" onClick={() => setCurrentAlertId(alert.id)} className={alert.id === currentAlert.id ? "active" : ""}>
                    {alert.busNumber || alert.title}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {toastAlert && !currentAlert ? (
        <button type="button" className="critical-alert-toast" onClick={() => openAlert(toastAlert)}>
          <AlertTriangle size={18} />
          <span>
            <strong>{toastAlert.title}</strong>
            {toastAlert.message}
          </span>
        </button>
      ) : null}
    </CriticalAlertContext.Provider>
  );
}

export function useCriticalAlerts() {
  const context = useContext(CriticalAlertContext);
  if (!context) throw new Error("useCriticalAlerts must be used inside CriticalAlertProvider.");
  return context;
}
