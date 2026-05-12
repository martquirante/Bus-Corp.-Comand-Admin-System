"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/services/api";
import { AppShell } from "@/components/layout/AppShell";
import { EmployeeIdCard } from "@/components/employee/EmployeeIdCard";
import { EmployeeIdExportActions } from "@/components/employee/EmployeeIdExportActions";
import type { EmployeeRecord } from "@pos-bus/shared";

type DigitalIdPageClientProps = {
  employeeId: string;
};

export function DigitalIdPageClient({ employeeId }: DigitalIdPageClientProps) {
  const loadAssets = useCallback(() => api.getEmployeeAssets(employeeId), [employeeId]);
  const assetsResource = useApiResource(loadAssets);

  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);

  // Update employee when assets load
  const resolvedEmployee =
    employee || (assetsResource.data?.employee ?? null);

  const handleSaved = (updated: EmployeeRecord) => {
    setEmployee(updated);
    void assetsResource.refresh();
  };

  return (
    <AppShell title="Digital ID" kicker="Secure employee identification card">
      {/* Breadcrumb */}
      <div className="digital-id-breadcrumb">
        <Link href="/employees" className="soft-button digital-id-back-link">
          <ArrowLeft size={15} /> Back to Employees
        </Link>
        {resolvedEmployee ? (
          <span className="digital-id-breadcrumb-name">
            {resolvedEmployee.fullName} — {resolvedEmployee.employeeNumber || "No ID"}
          </span>
        ) : null}
      </div>

      {assetsResource.isLoading ? (
        <div className="digital-id-loading">
          <span>Loading employee data…</span>
        </div>
      ) : assetsResource.error ? (
        <div className="digital-id-error command-card">
          <strong>Could not load employee</strong>
          <p>{assetsResource.error}</p>
          <Link href="/employees" className="soft-button">Back to Employees</Link>
        </div>
      ) : !resolvedEmployee ? (
        <div className="digital-id-error command-card">
          <strong>Employee not found</strong>
          <p>No employee record found for ID: {employeeId}</p>
          <Link href="/employees" className="soft-button">Back to Employees</Link>
        </div>
      ) : (
        <div className="digital-id-page">
          {/* Card preview */}
          <section className="command-card digital-id-card-section">
            <div className="section-heading compact">
              <div>
                <span>Preview — {isFlipped ? "Back side" : "Front side"}</span>
                <h2>Employee ID Card</h2>
              </div>
            </div>

            <EmployeeIdCard
              employee={resolvedEmployee}
              isFlipped={isFlipped}
              frontRef={frontRef}
              backRef={backRef}
              onQrReady={setQrDataUrl}
            />

            <EmployeeIdExportActions
              employee={resolvedEmployee}
              frontRef={frontRef}
              backRef={backRef}
              qrDataUrl={qrDataUrl}
              onFlip={() => setIsFlipped((v) => !v)}
              onSaved={handleSaved}
            />
          </section>

          {/* Info summary */}
          <section className="command-card digital-id-info-section">
            <div className="section-heading compact">
              <div>
                <span>Employee record</span>
                <h2>ID Details</h2>
              </div>
            </div>

            <dl className="digital-id-info-grid">
              <div>
                <dt>Full name</dt>
                <dd>{resolvedEmployee.fullName || "—"}</dd>
              </div>
              <div>
                <dt>Employee number</dt>
                <dd>{resolvedEmployee.employeeNumber || "—"}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd className="digital-id-role-badge">{resolvedEmployee.role || "—"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`status-pill status-${resolvedEmployee.status}`}>
                    {resolvedEmployee.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{resolvedEmployee.phone || "—"}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{resolvedEmployee.address || "—"}</dd>
              </div>
              <div>
                <dt>Assigned bus</dt>
                <dd>{resolvedEmployee.assignedBus || resolvedEmployee.assignedBusId || "Unassigned"}</dd>
              </div>
              <div>
                <dt>Assigned route</dt>
                <dd>{resolvedEmployee.assignedRoute || resolvedEmployee.assignedRouteId || "Unassigned"}</dd>
              </div>
            </dl>

            <div className="digital-id-asset-status">
              <span className="digital-id-asset-label">Stored assets</span>
              <div className="digital-id-asset-chips">
                {[
                  { label: "Photo", has: !!(resolvedEmployee.photoUrl || resolvedEmployee.profilePhotoUrl) },
                  { label: "Signature", has: !!resolvedEmployee.signatureUrl },
                  { label: "Front PNG", has: !!resolvedEmployee.idFrontUrl },
                  { label: "Back PNG", has: !!resolvedEmployee.idBackUrl },
                  { label: "PDF", has: !!resolvedEmployee.idPdfUrl },
                  { label: "QR", has: !!resolvedEmployee.qrUrl }
                ].map(({ label, has }) => (
                  <span key={label} className={`digital-id-asset-chip ${has ? "has-asset" : "no-asset"}`}>
                    {has ? "✓" : "○"} {label}
                  </span>
                ))}
              </div>
              {!resolvedEmployee.idFrontUrl && (
                <p className="digital-id-save-hint">
                  Click <strong>Save to Cloud</strong> above to store this ID in Supabase Storage.
                  {!resolvedEmployee.photoUrl && !resolvedEmployee.profilePhotoUrl
                    ? " Upload a photo from the Employee page first for best results."
                    : ""}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
