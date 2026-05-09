export const formatPeso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0
  }).format(value || 0);

export const formatCoordinate = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(6) : "N/A";
};

export const formatDateTime = (value: number | string | null | undefined) => {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const relativeTimeUnit = (value: number, singular: string, plural: string) =>
  `${value} ${value === 1 ? singular : plural} ago`;

export const relativeMinutes = (timestamp: number) => {
  if (!timestamp) return "No signal";
  const normalizedTimestamp = timestamp > 0 && timestamp < 100000000000 ? timestamp * 1000 : timestamp;
  const minutes = Math.max(0, Math.floor((Date.now() - normalizedTimestamp) / 60000));

  if (minutes === 0) return "Just now";
  if (minutes < 60) return relativeTimeUnit(minutes, "min", "mins");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativeTimeUnit(hours, "hour", "hours");

  const days = Math.floor(hours / 24);
  if (days < 7) return relativeTimeUnit(days, "day", "days");

  if (days < 30) {
    const weeks = Math.max(1, Math.floor(days / 7));
    return relativeTimeUnit(weeks, "week", "weeks");
  }

  if (days < 365) {
    const months = Math.max(1, Math.floor(days / 30));
    return relativeTimeUnit(months, "month", "months");
  }

  const years = Math.max(1, Math.floor(days / 365));
  return relativeTimeUnit(years, "year", "years");
};
