"use client";

import { RefObject, useEffect, useMemo, useState } from "react";
/* eslint-disable @next/next/no-img-element */
import type { EmployeeRecord } from "@pos-bus/shared";
import QRCode from "qrcode";

type EmployeeIdCardProps = {
  employee: EmployeeRecord | null;
  isFlipped: boolean;
  frontRef: RefObject<HTMLDivElement | null>;
  backRef: RefObject<HTMLDivElement | null>;
  onQrReady?: (value: string) => void;
};

const logoPath = "/assets/logos/pos-bus-logo.png";

const display = (value?: string, fallback = "Not set") => value || fallback;

const prettyRole = (role?: string) =>
  role ? role.replace(/^\w/, (letter) => letter.toUpperCase()) : "Employee";

const oneYearFromNow = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date
    .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    .toUpperCase();
};

const issuedToday = () =>
  new Date()
    .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    .toUpperCase();

/** Roles that have an assigned bus / route on the ID */
const TRANSPORT_ROLES: (EmployeeRecord["role"] | string)[] = ["driver", "conductor"];

export function employeeQrPayload(employee: EmployeeRecord | null) {
  if (!employee) return "";
  // Return a nicely formatted text string for generic scanners
  return `POS BUS EMPLOYEE ID
-----------------------
Name: ${employee.fullName || "N/A"}
Employee No: ${employee.employeeNumber || "N/A"}
Position: ${employee.role?.toUpperCase() || "N/A"}
Status: ${employee.status?.toUpperCase() || "N/A"}
Phone: ${employee.phone || "N/A"}`;
}

export function EmployeeIdCard({
  employee,
  isFlipped,
  frontRef,
  backRef,
  onQrReady,
}: EmployeeIdCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const payload = useMemo(() => employeeQrPayload(employee), [employee]);

  const photoUrl = employee?.photoUrl || employee?.profilePhotoUrl;
  const signatureUrl = employee?.signatureUrl;
  const employeeNumber = employee?.employeeNumber || "EMP-0000";
  const issuedDate = employee?.issuedDate
    ? new Date(employee.issuedDate).toLocaleDateString("en-US")
    : issuedToday();
  const validUntil = employee?.validUntil
    ? new Date(employee.validUntil).toLocaleDateString("en-US")
    : oneYearFromNow();

  const isTransportRole = TRANSPORT_ROLES.includes(employee?.role ?? "");

  useEffect(() => {
    if (!payload) {
      setQrDataUrl("");
      onQrReady?.("");
      return;
    }

    QRCode.toDataURL(payload, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0a1628",
        light: "#ffffff",
      },
    }).then((value) => {
      setQrDataUrl(value);
      onQrReady?.(value);
    });
  }, [onQrReady, payload]);

  return (
    <div className={`employee-id-stage ${isFlipped ? "is-flipped" : ""}`} aria-live="polite">
      <div className="employee-id-flipper">

        {/* ── FRONT ── */}
        <article className="employee-id-card employee-id-front" ref={frontRef}>
          <div className="id-holographic-foil" />

          {/* Header */}
          <header className="id-header-modern">
            <div className="id-header-left">
              <div className="id-logo-ring">
                <img src={logoPath} alt="POS BUS" />
              </div>
              <div className="id-brand-text">
                <strong>POS BUS</strong>
                <span>Employee Command ID</span>
              </div>
            </div>
            <div className="id-header-right">
              <span className="id-status-chip">
                {employee?.status === "active"
                  ? "ACTIVE STAFF"
                  : display(employee?.status, "PENDING").toUpperCase()}
              </span>
            </div>
          </header>

          {/* Gold accent stripe */}
          <div className="id-gold-stripe" />

          {/* Hero — photo + identity */}
          <section className="id-card-hero">
            <div className="id-photo-frame">
              {photoUrl ? (
                <img src={photoUrl} alt={`${employee?.fullName ?? "Employee"} photo`} />
              ) : (
                <span className="id-photo-placeholder">PHOTO</span>
              )}
            </div>

            <div className="id-identity">
              <span>Full Name</span>
              <strong>{employee?.fullName || "Employee Name"}</strong>

              <span>Employee No.</span>
              <b>{employeeNumber}</b>

              <span>Position</span>
              <strong className="id-role-value">{prettyRole(employee?.role)}</strong>
            </div>
          </section>

          {/* Info grid */}
          <section className="id-info-grid">
            <div>
              <span>Phone</span>
              <strong>{display(employee?.phone, "09XX XXX XXXX")}</strong>
            </div>
            <div>
              <span>Address</span>
              <strong>{display(employee?.address, "Address not set")}</strong>
            </div>

            {isTransportRole && (
              <div>
                <span>Assigned Bus</span>
                <strong>
                  {display(
                    employee?.assignedBus || employee?.assignedBusId,
                    "Unassigned"
                  )}
                </strong>
              </div>
            )}

            {isTransportRole && (
              <div>
                <span>Assigned Route</span>
                <strong>
                  {display(
                    employee?.assignedRoute || employee?.assignedRouteId,
                    "Unassigned"
                  )}
                </strong>
              </div>
            )}

            <div className="id-status-box">
              <span>Status</span>
              <strong>{display(employee?.status, "Pending").toUpperCase()}</strong>
            </div>
          </section>

          {/* Footer */}
          <footer className="id-footer-modern">
            <div className="id-footer-left">
              <img
                src="/assets/bus/blue-aircon/bus-blue-aircon-front-left.png"
                alt="Holographic Bus"
                className="id-holographic-bus"
              />
            </div>
            <div className="id-signature">
              {signatureUrl ? (
                <img
                  src={signatureUrl}
                  alt={`${employee?.fullName ?? "Employee"} signature`}
                />
              ) : (
                <strong>{employee?.fullName || "Employee"}</strong>
              )}
              <span>Authorized Signature</span>
            </div>
          </footer>
        </article>

        {/* ── BACK ── */}
        <article className="employee-id-card employee-id-back" ref={backRef}>
          <div className="id-holographic-foil" />

          {/* Just the QR Panel in the center */}
          <section className="id-qr-panel" style={{ margin: "auto", width: "100%", padding: "20px" }}>
            <div className="id-qr-title-bar" style={{ marginBottom: "15px" }}>
              <strong>{employee?.fullName || "Employee"}</strong>
              <span>{employeeNumber}</span>
            </div>

            <div className="id-qr-frame" style={{ width: "min(260px, 90%)", padding: "15px" }}>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Employee verification QR code" />
              ) : (
                <span className="id-qr-placeholder">QR</span>
              )}
              {/* Logo overlay in QR centre */}
              <div className="id-qr-logo-overlay">
                <img src={logoPath} alt="POS BUS" />
              </div>
            </div>

            <p className="id-qr-scan-note" style={{ marginTop: "15px" }}>
              SCAN TO VERIFY EMPLOYEE IDENTITY · {employee?.role?.toUpperCase()}
            </p>
          </section>
        </article>

      </div>
    </div>
  );
}
