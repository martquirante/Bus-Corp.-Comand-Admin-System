/* eslint-disable @next/next/no-img-element */
"use client";

import { ChangeEvent, useRef } from "react";
import type { EmployeeRecord } from "@pos-bus/shared";
import { CheckCircle, Edit3, IdCard, Upload, User } from "lucide-react";
import Link from "next/link";

type EmployeeProfilePanelProps = {
  employee: EmployeeRecord | null;
  isSaving: boolean;
  onEdit: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>, kind: "photo" | "signature") => void;
};

const titleCase = (value: string) => value.replace(/^\w/, (l) => l.toUpperCase());
const display = (value?: string, fallback = "Not set") => value || fallback;

export function EmployeeProfilePanel({ employee, isSaving, onEdit, onUpload }: EmployeeProfilePanelProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const photoUrl = employee?.photoUrl || employee?.profilePhotoUrl;
  const signatureUrl = employee?.signatureUrl;
  const hasPhoto = !!photoUrl;
  const hasSignature = !!signatureUrl;

  if (!employee) {
    return (
      <aside className="employee-profile-panel">
        <div className="profile-empty-state">
          <User size={40} />
          <strong>No employee selected</strong>
          <span>Click a row in the table to view the employee profile.</span>
        </div>
      </aside>
    );
  }

  const statusClass =
    employee.status === "active" ? "active" : employee.status === "inactive" ? "inactive" : "pending";

  return (
    <aside className="employee-profile-panel">
      {/* Photo */}
      <div className="profile-photo-frame">
        {photoUrl ? (
          <img src={photoUrl} alt={`${employee.fullName} profile`} />
        ) : (
          <div className="profile-photo-placeholder">
            <User size={40} />
          </div>
        )}
        <span className={`profile-status-badge status-${statusClass}`}>{titleCase(employee.status || "pending")}</span>
      </div>

      {/* Identity — signature floats above the printed name line */}
      <div className="profile-identity">
        {signatureUrl ? (
          <div className="profile-signature-over-name">
            <img src={signatureUrl} alt={`${employee.fullName} signature`} />
          </div>
        ) : null}

        <div className="profile-name-line">
          <strong className="profile-name">{employee.fullName || "Unknown Employee"}</strong>
        </div>

        <span className="profile-employee-num">{employee.employeeNumber || "No ID"}</span>
        <span className="profile-role">{titleCase(employee.role || "employee")}</span>
      </div>

      {/* Info grid */}
      <dl className="profile-info-grid">
        {employee.email ? (
          <div>
            <dt>Email</dt>
            <dd>{employee.email}</dd>
          </div>
        ) : null}
        <div>
          <dt>Phone</dt>
          <dd>{display(employee.phone, "Not set")}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{display(employee.address, "Not set")}</dd>
        </div>
        {["driver", "conductor"].includes(employee.role) && (
          <>
            <div>
              <dt>Assigned Bus</dt>
              <dd>{display(employee.assignedBus || employee.assignedBusId, "Unassigned")}</dd>
            </div>
            <div>
              <dt>Assigned Route</dt>
              <dd>{display(employee.assignedRoute || employee.assignedRouteId, "Unassigned")}</dd>
            </div>
          </>
        )}
      </dl>

      {/* Actions */}
      <div className="profile-action-grid">
        <button type="button" className="soft-button profile-action-btn" onClick={onEdit} disabled={isSaving}>
          <Edit3 size={15} />
          <span>Edit Profile</span>
        </button>

        {/* Photo upload */}
        <button
          type="button"
          className={`soft-button profile-action-btn ${hasPhoto ? "profile-action-uploaded" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            photoInputRef.current?.click();
          }}
          disabled={isSaving}
        >
          {hasPhoto ? <CheckCircle size={15} /> : <Upload size={15} />}
          <span>{hasPhoto ? "Change Photo" : "Upload Photo"}</span>
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden-file-input"
          onChange={(e) => onUpload(e, "photo")}
        />

        {/* Signature upload */}
        <button
          type="button"
          className={`soft-button profile-action-btn ${hasSignature ? "profile-action-uploaded" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            signatureInputRef.current?.click();
          }}
          disabled={isSaving}
        >
          {hasSignature ? <CheckCircle size={15} /> : <Upload size={15} />}
          <span>{hasSignature ? "Change Signature" : "Upload Signature"}</span>
        </button>
        <input
          ref={signatureInputRef}
          type="file"
          accept="image/*"
          className="hidden-file-input"
          onChange={(e) => onUpload(e, "signature")}
        />

        <Link href={`/employees/${employee.id}/digital-id`} className="primary-action profile-action-btn profile-id-btn">
          <IdCard size={15} />
          <span>Digital ID</span>
        </Link>
      </div>

      {isSaving ? <p className="profile-saving-note">Saving…</p> : null}
    </aside>
  );
}
