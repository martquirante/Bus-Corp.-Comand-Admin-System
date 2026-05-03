"use client";

import { formatPeso } from "@/utils/format";

type TooltipPayload = {
  name?: string | number;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

type CommandChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayload[];
  formatter?: (value: number, item: TooltipPayload) => string;
};

export function CommandChartTooltip({
  active,
  label,
  payload,
  formatter = (value) => formatPeso(value)
}: CommandChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="command-chart-tooltip">
      {label ? <strong>{label}</strong> : null}
      {payload.map((item) => {
        const numericValue = Number(item.value || 0);
        const name = item.name || item.dataKey || "Value";
        return (
          <span key={`${name}`}>
            <i style={{ background: item.color || "var(--blue)" }} />
            {name}: {formatter(numericValue, item)}
          </span>
        );
      })}
    </div>
  );
}
