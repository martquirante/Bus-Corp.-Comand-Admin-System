"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import type { FleetBus } from "@pos-bus/shared";

const assetForStatus = (bus: FleetBus) => {
  if (bus.status === "idle" || bus.speed <= 0) {
    return "/assets/bus/blue-aircon/bus-blue-aircon-front-left.png";
  }
  if (bus.status === "fast" || bus.speed >= 45) {
    return "/assets/bus/blue-aircon/bus-blue-aircon-side-rear.png";
  }
  if (bus.status === "turning-left" || bus.status === "turning-right") {
    return "/assets/bus/blue-aircon/bus-blue-aircon-rear-perspective.png";
  }
  return "/assets/bus/blue-aircon/bus-blue-aircon-front-left.png";
};

const transformForStatus = (bus: FleetBus) => {
  const turn = bus.status === "turning-left" ? -13 : bus.status === "turning-right" ? 13 : 0;
  const pitch = bus.status === "fast" ? 13 : bus.status === "idle" ? 6 : 9;
  const scale = bus.status === "fast" ? 1.08 : bus.status === "idle" ? 0.94 : 1;
  return `translate(-50%, -50%) perspective(520px) rotateX(${pitch}deg) rotateY(-8deg) rotateZ(${turn}deg) scale(${scale})`;
};

export function BusMarker({ bus, x, y }: { bus: FleetBus; x: number; y: number }) {
  const style = {
    left: `${x}%`,
    top: `${y}%`,
    transform: transformForStatus(bus)
  } satisfies CSSProperties;

  return (
    <button className={`bus-marker status-${bus.status}`} style={style} type="button" aria-label={bus.busNumber}>
      {bus.emergency ? <span className="sos-ring" /> : null}
      <Image src={assetForStatus(bus)} width={116} height={78} alt={`${bus.busNumber} marker`} />
      <span className="bus-marker-label">{bus.busNumber}</span>
    </button>
  );
}
