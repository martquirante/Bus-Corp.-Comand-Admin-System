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

export const relativeMinutes = (timestamp: number) => {
  if (!timestamp) return "No signal";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes === 0) return "Just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} mins ago`;
};
