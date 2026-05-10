"use client";

import { RefObject, useEffect, useMemo, useState } from "react";
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

const prettyRole = (role?: string) => (role ? role.replace(/^\w/, (letter) => letter.toUpperCase()) : "Employee");

const oneYearFromNow = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();
};

const issuedToday = () => new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();

export function employeeQrPayload(employee: EmployeeRecord | null) {
  if (!employee) return "";
  const verificationUrl =
    typeof window === "undefined"
      ? `https://pos-bus.local/verify/employee/${employee.employeeNumber}`
      : `${window.location.origin}/verify/employee/${employee.employeeNumber}`;

  return JSON.stringify({
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    name: employee.fullName,
    role: employee.role,
    status: employee.status,
    verificationUrl
  });
}

export function EmployeeIdCard({ employee, isFlipped, frontRef, backRef, onQrReady }: EmployeeIdCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const payload = useMemo(() => employeeQrPayload(employee), [employee]);
  const photoUrl = employee?.photoUrl || employee?.profilePhotoUrl;
  const signatureUrl = employee?.signatureUrl;
  const employeeNumber = employee?.employeeNumber || "EMP-0000";
  const issuedDate = employee?.issuedDate ? new Date(employee.issuedDate).toLocaleDateString("en-US") : issuedToday();
  const validUntil = employee?.validUntil ? new Date(employee.validUntil).toLocaleDateString("en-US") : oneYearFromNow();

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
        dark: "#111827",
        light: "#ffffff"
      }
    }).then((value) => {
      setQrDataUrl(value);
      onQrReady?.(value);
    });
  }, [onQrReady, payload]);

  return (
    <div className={`employee-id-stage ${isFlipped ? "is-flipped" : ""}`} aria-live="polite">
      <div className="employee-id-flipper">
        <article className="employee-id-card employee-id-front" ref={frontRef}>
          <div className="id-security-shine" />
          <header className="id-card-header">
            <div className="id-logo-lockup">
              <img src={logoPath} alt="POS BUS logo" />
              <div>
                <strong>POS BUS</strong>
                <span>Employee Command ID</span>
              </div>
            </div>
            <span className="id-status-chip">{employee?.status === "active" ? "ACTIVE STAFF" : display(employee?.status, "PENDING")}</span>
          </header>

          <section className="id-card-hero">
            <div className="id-photo-frame">
              {photoUrl ? <img src={photoUrl} alt={`${employee?.fullName || "Employee"} profile`} /> : <span>EMPLOYEE PHOTO</span>}
            </div>
            <div className="id-identity">
              <span>Full name</span>
              <strong>{employee?.fullName || "Employee Name"}</strong>
              <span>Employee no.</span>
              <b>{employeeNumber}</b>
              <span>Position</span>
              <strong>{prettyRole(employee?.role)}</strong>
            </div>
          </section>

          <section className="id-info-grid">
            <div>
              <span>Phone</span>
              <strong>{display(employee?.phone, "09XX XXX XXXX")}</strong>
            </div>
            <div>
              <span>Address</span>
              <strong>{display(employee?.address, "Address not set")}</strong>
            </div>
            <div>
              <span>Assigned bus</span>
              <strong>{display(employee?.assignedBus || employee?.assignedBusId, "Unassigned")}</strong>
            </div>
            <div>
              <span>Assigned route</span>
              <strong>{display(employee?.assignedRoute || employee?.assignedRouteId, "Unassigned")}</strong>
            </div>
            <div className="id-status-box">
              <span>Status</span>
              <strong>{display(employee?.status, "pending")}</strong>
            </div>
            <div>
              <span>Valid until</span>
              <strong>{validUntil}</strong>
            </div>
          </section>

          <footer className="id-card-footer">
            <div>
              <span>Security features</span>
              <strong>Holographic shine • Secure employee record</strong>
            </div>
            <div className="id-signature">
              {signatureUrl ? <img src={signatureUrl} alt={`${employee?.fullName || "Employee"} signature`} /> : <strong>{employee?.fullName?.split(" ")[0] || "Signature"}</strong>}
              <span>Authorized Signature</span>
            </div>
          </footer>
        </article>

        <article className="employee-id-card employee-id-back" ref={backRef}>
          <div className="id-security-shine" />
          <header className="id-card-header dark">
            <div className="id-logo-lockup">
              <img src={logoPath} alt="POS BUS logo" />
              <div>
                <strong>POS BUS</strong>
                <span>Secure Employee QR Access</span>
              </div>
            </div>
            <span className="id-status-chip">ACTIVE ID</span>
          </header>

          <section className="id-qr-panel">
            <div className="id-qr-title">
              <strong>Scan Employee QR</strong>
              <span>{employeeNumber}</span>
            </div>
            <div className="id-qr-frame">{qrDataUrl ? <img src={qrDataUrl} alt="Employee verification QR code" /> : <span>QR</span>}</div>
            <div className="id-qr-copy">
              <span>How this QR works</span>
              <p>Normal scanners show public employee details only. The POS employee app uses this QR for authorized login and transaction pairing.</p>
            </div>
          </section>

          <section className="id-scan-rules">
            <div>
              <strong>Public scan</strong>
              <span>Shows name, employee number, role, and active status.</span>
            </div>
            <div className="green">
              <strong>App scan</strong>
              <span>Links authorized staff access for POS transactions.</span>
            </div>
            <div className="amber">
              <strong>Lost ID</strong>
              <span>Report immediately to POS BUS Admin Command.</span>
            </div>
          </section>

          <footer className="id-card-footer dark">
            <div>
              <strong>Property of POS BUS Ticketing System</strong>
              <span>Issued {issuedDate} • Verification ID: POS-{employeeNumber}</span>
            </div>
            <div className="id-seal">POS<br />BUS</div>
          </footer>
        </article>
      </div>
    </div>
  );
}
