"use client";

import type { FleetBus } from "@pos-bus/shared";
import { BusMarker } from "./BusMarker";
import { MapControls } from "./MapControls";

const clamp = (value: number, min = 8, max = 92) => Math.min(max, Math.max(min, value));

const projectBus = (bus: FleetBus, index: number, buses: FleetBus[]) => {
  const valid = buses.filter((item) => item.lat !== null && item.lng !== null);

  if (!valid.length || bus.lat === null || bus.lng === null) {
    return {
      x: clamp(18 + index * 18),
      y: clamp(36 + (index % 3) * 18)
    };
  }

  const latValues = valid.map((item) => item.lat as number);
  const lngValues = valid.map((item) => item.lng as number);
  const minLat = Math.min(...latValues);
  const maxLat = Math.max(...latValues);
  const minLng = Math.min(...lngValues);
  const maxLng = Math.max(...lngValues);
  const latRange = maxLat - minLat || 0.02;
  const lngRange = maxLng - minLng || 0.02;

  return {
    x: clamp(((bus.lng - minLng) / lngRange) * 72 + 14),
    y: clamp(86 - ((bus.lat - minLat) / latRange) * 72)
  };
};

export function FleetMap({ buses }: { buses: FleetBus[] }) {
  return (
    <section className="fleet-map">
      <div className="map-pattern" aria-hidden="true" />
      <div className="route-line route-line-a" aria-hidden="true" />
      <div className="route-line route-line-b" aria-hidden="true" />
      <div className="terminal terminal-a">FVR</div>
      <div className="terminal terminal-b">SMF</div>
      <div className="terminal terminal-c">SP</div>
      <MapControls />
      {buses.map((bus, index) => {
        const point = projectBus(bus, index, buses);
        return <BusMarker key={bus.id} bus={bus} x={point.x} y={point.y} />;
      })}
      <div className="map-legend">
        <span>
          <i className="legend-online" /> Online
        </span>
        <span>
          <i className="legend-idle" /> Idle
        </span>
        <span>
          <i className="legend-sos" /> SOS
        </span>
      </div>
    </section>
  );
}
