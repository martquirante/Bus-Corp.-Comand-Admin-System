"use client";

import { useCallback } from "react";
import { Gauge, Radio, Route, Siren } from "lucide-react";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { AppShell } from "@/components/layout/AppShell";
import { FleetMap } from "@/components/map/FleetMap";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatPeso, relativeMinutes } from "@/utils/format";

export function FleetMapPage() {
  const loadFleet = useCallback(() => api.fleet(), []);
  const fleet = useApiResource(loadFleet);
  const buses = fleet.data || [];
  const active = buses.filter((bus) => bus.online).length;
  const emergency = buses.filter((bus) => bus.emergency).length;
  const avgSpeed = buses.length
    ? Math.round(buses.reduce((sum, bus) => sum + bus.speed, 0) / buses.length)
    : 0;
  const routeCount = new Set(buses.map((bus) => bus.route)).size;

  return (
    <AppShell title="Live Fleet Map" kicker="Dispatch desk with bus-angle markers">
      <section className="stats-grid compact-grid">
        <StatCard label="Online Units" value={String(active)} detail="Updated from LiveStatus" tone="blue" icon={Radio} />
        <StatCard label="Avg Speed" value={`${avgSpeed} km/h`} detail="Moving fleet average" tone="green" icon={Gauge} />
        <StatCard label="Routes Covered" value={String(routeCount)} detail="Current loop spread" tone="violet" icon={Route} />
        <StatCard label="SOS Watch" value={String(emergency)} detail="Professional pulse only" tone={emergency ? "red" : "blue"} icon={Siren} />
      </section>

      {fleet.isLoading ? <Skeleton className="map-skeleton" /> : <FleetMap buses={buses} />}

      <section className="command-card">
        <div className="section-heading compact">
          <div>
            <span>Fleet roster</span>
            <h2>Live bus status</h2>
          </div>
          <small>{fleet.source === "demo" ? "Demo data" : "Firebase live"}</small>
        </div>
        <DataTable
          rows={buses}
          getRowKey={(row) => row.id}
          columns={[
            { header: "Bus", cell: (row) => <strong>{row.busNumber}</strong> },
            { header: "Driver", cell: (row) => row.driver },
            { header: "Route", cell: (row) => row.route },
            { header: "Speed", cell: (row) => `${row.speed} km/h` },
            { header: "Sales", cell: (row) => formatPeso(row.total) },
            { header: "Signal", cell: (row) => relativeMinutes(row.lastUpdate) },
            { header: "Status", cell: (row) => <span className={`status-pill status-${row.status}`}>{row.status}</span> }
          ]}
        />
      </section>
    </AppShell>
  );
}
