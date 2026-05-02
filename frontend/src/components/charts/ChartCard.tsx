import type { ReactNode } from "react";

export function ChartCard({
  title,
  eyebrow,
  action,
  children
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="chart-card">
      <div className="section-heading compact">
        <div>
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      <div className="chart-body">{children}</div>
    </section>
  );
}
