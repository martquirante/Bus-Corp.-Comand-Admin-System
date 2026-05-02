import { LocateFixed, Map, Satellite, TrafficCone } from "lucide-react";

export function MapControls() {
  return (
    <div className="map-controls" aria-label="Map controls">
      <button type="button" title="Center fleet">
        <LocateFixed size={16} />
      </button>
      <button type="button" title="Route grid">
        <Map size={16} />
      </button>
      <button type="button" title="Traffic layer">
        <TrafficCone size={16} />
      </button>
      <button type="button" title="Satellite view">
        <Satellite size={16} />
      </button>
    </div>
  );
}
