"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import type { FleetBus } from "@pos-bus/shared";

const assetForStatus = (bus: FleetBus) => {
  const isLoadingPassengers = Boolean((bus as FleetBus & { isLoadingPassengers?: boolean }).isLoadingPassengers);
  const stoppedAsset = "/assets/bus/blue-aircon/bus-blue-aircon-front-left.png";

  if (bus.status === "offline") {
    return stoppedAsset;
  }

  if (isLoadingPassengers) {
    return stoppedAsset;
  }

  if (bus.status === "idle" || bus.speed <= 0) {
    return stoppedAsset;
  }

  if (bus.status === "fast" || bus.status === "moving" || bus.speed > 0) {
    return "/assets/bus/blue-aircon/map-only-blue-bus.png";
  }

  if (bus.status === "turning-left" || bus.status === "turning-right") {
    return "/assets/bus/blue-aircon/map-only-blue-bus.png";
  }

  return stoppedAsset;
};

const transformForStatus = (bus: FleetBus) => {
  const turn = bus.status === "turning-left" ? -13 : bus.status === "turning-right" ? 13 : 0;
  const heading = typeof bus.heading === "number" ? bus.heading : 0;
  const pitch = bus.status === "fast" ? 12 : bus.status === "idle" || !bus.online ? 5 : 8;
  const scale = bus.status === "fast" ? 1.08 : bus.status === "idle" ? 0.94 : 1;
  return `translate(-50%, -50%) perspective(520px) rotateX(${pitch}deg) rotateY(-8deg) rotateZ(${heading + turn}deg) scale(${scale})`;
};

export function BusMarker({ bus, x, y }: { bus: FleetBus; x: number; y: number }) {
  const style = {
    left: `${x}%`,
    top: `${y}%`,
    transform: transformForStatus(bus)
  } satisfies CSSProperties;

  return (
    <button
      className={`bus-marker status-${bus.status} ${bus.online ? "" : "is-offline"}`}
      style={style}
      type="button"
      aria-label={bus.busNumber}
    >
      {bus.emergency ? <span className="sos-ring" /> : null}
      <Image src={assetForStatus(bus)} width={116} height={78} alt={`${bus.busNumber} marker`} />
      {!bus.online ? <span className="offline-badge">Offline</span> : null}
      <span className="bus-marker-label">{bus.busNumber}</span>
    </button>
  );
}
