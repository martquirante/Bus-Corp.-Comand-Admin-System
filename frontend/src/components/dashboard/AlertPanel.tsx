import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { FleetBus } from "@pos-bus/shared";
import { relativeMinutes } from "@/utils/format";

export function AlertPanel({ buses }: { buses: FleetBus[] }) {
  const alerts = buses.filter((bus) => bus.emergency || bus.status === "offline");

  return (
    <section className={`alert-panel ${alerts.length ? "has-alerts" : ""}`}>
      <div className="section-heading compact">
        <div>
          <span>Dispatch Watch</span>
          <h2>Operational Alerts</h2>
        </div>
        {alerts.length ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
      </div>
      {alerts.length ? (
        <div className="alert-list">
          {alerts.slice(0, 4).map((bus) => (
            <article key={bus.id} className="alert-row">
              <strong>{bus.busNumber}</strong>
              <span>{bus.emergency ? "SOS active" : "Signal offline"}</span>
              <small>{relativeMinutes(bus.lastUpdate)}</small>
            </article>
          ))}
        </div>
      ) : (
        <p className="quiet-copy">No active SOS or offline bus alerts.</p>
      )}
    </section>
  );
}
