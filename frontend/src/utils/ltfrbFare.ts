export type BusFareClass = "aircon" | "ordinary";
export type PassengerFareType = "regular" | "discounted";

const fareRules = {
  aircon: {
    regularBase: 15,
    regularSucceedingPerKm: 2.65,
    discountedBase: 12,
    discountedSucceedingPerKm: 2.12
  },
  ordinary: {
    regularBase: 13,
    regularSucceedingPerKm: 2.25,
    discountedBase: 10.4,
    discountedSucceedingPerKm: 1.8
  }
} as const;

export function roundFareToPeso(value: number) {
  return Math.round(Number(value) || 0);
}

export function computeLtfrbCityBusFare(
  distanceKm: number,
  busClass: BusFareClass = "aircon",
  passengerType: PassengerFareType = "regular"
) {
  const km = Math.max(1, Math.ceil(Number(distanceKm) || 1));
  const rule = fareRules[busClass];

  const base =
    passengerType === "discounted"
      ? rule.discountedBase
      : rule.regularBase;

  const succeedingPerKm =
    passengerType === "discounted"
      ? rule.discountedSucceedingPerKm
      : rule.regularSucceedingPerKm;

  const rawFare = km <= 5 ? base : base + (km - 5) * succeedingPerKm;

  return roundFareToPeso(rawFare);
}

export function formatFarePeso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(roundFareToPeso(value));
}