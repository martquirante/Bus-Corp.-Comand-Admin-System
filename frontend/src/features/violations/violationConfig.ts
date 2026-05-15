import type { EmployeeViolationRecord } from "@pos-bus/shared";

export type ViolationSeverity = "minor" | "major" | "critical";
export type ViolationStatus = "Active" | "Under Review" | "Resolved" | "Dismissed" | "Escalated";
export type PenaltyType =
  | "Verbal Warning"
  | "Written Warning"
  | "Final Warning"
  | "Salary Deduction"
  | "Cash Shortage Deduction"
  | "Suspension"
  | "Training Required"
  | "Route Reassignment"
  | "Bus Reassignment"
  | "Probation"
  | "Termination Recommendation"
  | "Under Investigation"
  | "No Penalty"
  | "Other";

export type ViolationPreset = {
  category: string;
  severity: ViolationSeverity;
  description: string;
  penaltyType: PenaltyType;
  penaltyDetails: string;
  suspensionDays: number;
  salaryDeductionAmount: number;
};

export const VIOLATION_STATUSES: ViolationStatus[] = [
  "Active",
  "Under Review",
  "Resolved",
  "Dismissed",
  "Escalated"
];

export const PENALTY_TYPES: PenaltyType[] = [
  "Verbal Warning",
  "Written Warning",
  "Final Warning",
  "Salary Deduction",
  "Cash Shortage Deduction",
  "Suspension",
  "Training Required",
  "Route Reassignment",
  "Bus Reassignment",
  "Probation",
  "Termination Recommendation",
  "Under Investigation",
  "No Penalty",
  "Other"
];

export const VIOLATION_GROUPS = [
  {
    category: "Attendance / Duty",
    types: [
      "Late Arrival",
      "Frequent Tardiness",
      "Absent Without Notice",
      "No Call No Show",
      "Unauthorized Leave",
      "Early Departure",
      "Abandoning Duty",
      "Sleeping on Duty",
      "Unauthorized Shift Swap",
      "Not Wearing Uniform",
      "Not Wearing Employee ID"
    ]
  },
  {
    category: "Driver",
    types: [
      "Reckless Driving",
      "Overspeeding",
      "Distracted Driving",
      "Driving Under Influence",
      "Route Deviation",
      "Unauthorized Stop",
      "Skipping Required Stop",
      "Unsafe Loading/Unloading",
      "Accident Not Reported",
      "Failure to Report Incident",
      "Operating Unsafe Bus",
      "Unauthorized Bus Use",
      "Improper Parking"
    ]
  },
  {
    category: "Conductor",
    types: [
      "Not Issuing Ticket",
      "Fake Ticket Issuance",
      "Wrong Fare Collection",
      "Overcharging Passenger",
      "Undercharging Passenger",
      "Unrecorded Passenger Count",
      "Unreported Cash Collection",
      "Late Remittance",
      "Short Remittance",
      "No Remittance",
      "Incorrect Remittance Entry",
      "Fake Remittance Proof",
      "Unauthorized Cash Holding",
      "Cash Misappropriation"
    ]
  },
  {
    category: "Passenger Service",
    types: [
      "Passenger Complaint",
      "Rude Behavior",
      "Harassment",
      "Discrimination",
      "Refusal to Give Discount",
      "Failure to Assist Passenger",
      "Lost Item Not Reported",
      "Theft of Passenger Property"
    ]
  },
  {
    category: "Device / System",
    types: [
      "GPS Tampering",
      "POS Tampering",
      "Lost POS Device",
      "Improper Use of POS Device",
      "Sharing Account Password",
      "Unauthorized Account Access",
      "Unauthorized Data Modification"
    ]
  },
  {
    category: "Bus / Maintenance",
    types: [
      "Failure to Report Bus Damage",
      "Fuel Misuse",
      "Fuel Theft",
      "Maintenance Neglect",
      "Incomplete Maintenance",
      "Fake Maintenance Report",
      "Releasing Unsafe Bus"
    ]
  },
  {
    category: "Ethics / Misconduct",
    types: [
      "Insubordination",
      "Disrespect to Supervisor",
      "Disrespect to Co-worker",
      "Bullying",
      "Physical Fight",
      "Alcohol Use on Duty",
      "Drug Use on Duty",
      "Bribery",
      "Collusion",
      "Fraud",
      "Theft",
      "Falsification of Record",
      "Other"
    ]
  }
] as const;

const categoryFor = (type: string) =>
  VIOLATION_GROUPS.find((group) => group.types.includes(type as never))?.category || "Other";

const preset = (
  type: string,
  severity: ViolationSeverity,
  description: string,
  penaltyType: PenaltyType,
  penaltyDetails: string,
  suspensionDays = 0,
  salaryDeductionAmount = 0
): ViolationPreset => ({
  category: categoryFor(type),
  severity,
  description,
  penaltyType,
  penaltyDetails,
  suspensionDays,
  salaryDeductionAmount
});

export const VIOLATION_PRESETS: Record<string, ViolationPreset> = {
  "Late Arrival": preset(
    "Late Arrival",
    "minor",
    "Employee reported late for assigned duty/shift without valid prior notice.",
    "Written Warning",
    "Issue written warning. Repeated violation may lead to suspension."
  ),
  "Frequent Tardiness": preset(
    "Frequent Tardiness",
    "major",
    "Employee has repeated late arrivals that affect dispatch or office operations.",
    "Final Warning",
    "Issue final warning and require attendance monitoring for the next duty cycle."
  ),
  "Absent Without Notice": preset(
    "Absent Without Notice",
    "major",
    "Employee failed to report for assigned duty without prior notice or approved leave.",
    "Salary Deduction",
    "Record absence and deduct unpaid duty day after attendance review."
  ),
  "No Call No Show": preset(
    "No Call No Show",
    "critical",
    "Employee did not report for assigned duty and did not notify operations before shift start.",
    "Suspension",
    "Suspend employee pending explanation and require supervisor clearance before next assignment.",
    2
  ),
  "Abandoning Duty": preset(
    "Abandoning Duty",
    "critical",
    "Employee left assigned duty or route without authorization before completion.",
    "Suspension",
    "Suspend employee pending investigation and operations review.",
    3
  ),
  "Not Wearing Uniform": preset(
    "Not Wearing Uniform",
    "minor",
    "Employee reported for duty without required company uniform.",
    "Verbal Warning",
    "Issue verbal warning and require compliance before next duty."
  ),
  "Not Wearing Employee ID": preset(
    "Not Wearing Employee ID",
    "minor",
    "Employee reported for duty without visible company employee ID.",
    "Written Warning",
    "Issue written warning and require ID compliance during duty."
  ),
  "Reckless Driving": preset(
    "Reckless Driving",
    "critical",
    "Driver operated the vehicle in a dangerous manner that may endanger passengers, staff, or the public.",
    "Suspension",
    "Suspend driver and require safety retraining before returning to duty.",
    5
  ),
  "Overspeeding": preset(
    "Overspeeding",
    "critical",
    "Driver exceeded safe or authorized speed limits during operation.",
    "Suspension",
    "Suspend driver pending review of GPS/trip data and require safety retraining.",
    3
  ),
  "Route Deviation": preset(
    "Route Deviation",
    "major",
    "Employee deviated from the approved route without dispatch authorization.",
    "Route Reassignment",
    "Review route compliance and temporarily restrict route assignment if needed."
  ),
  "Unauthorized Stop": preset(
    "Unauthorized Stop",
    "major",
    "Employee made an unauthorized stop outside approved loading, unloading, or emergency points.",
    "Written Warning",
    "Issue written warning and monitor route compliance."
  ),
  "Accident Not Reported": preset(
    "Accident Not Reported",
    "critical",
    "Employee failed to report an accident or road incident to operations immediately.",
    "Suspension",
    "Suspend employee pending incident investigation and safety compliance review.",
    5
  ),
  "Failure to Report Bus Damage": preset(
    "Failure to Report Bus Damage",
    "major",
    "Employee failed to report visible or known bus damage before or after duty.",
    "Salary Deduction",
    "Review damage responsibility and record possible repair cost deduction after confirmation."
  ),
  "GPS Tampering": preset(
    "GPS Tampering",
    "critical",
    "Employee tampered with or disabled GPS tracking equipment.",
    "Suspension",
    "Suspend employee pending device audit and operations investigation.",
    5
  ),
  "POS Tampering": preset(
    "POS Tampering",
    "critical",
    "Employee tampered with POS device, transaction records, or ticketing functions.",
    "Suspension",
    "Suspend employee pending POS audit. Repeated or intentional offense may lead to termination recommendation.",
    5
  ),
  "Lost POS Device": preset(
    "Lost POS Device",
    "major",
    "Employee lost an assigned POS device or failed to secure company-issued equipment.",
    "Salary Deduction",
    "Record device loss and review replacement cost deduction after accountability check."
  ),
  "Not Issuing Ticket": preset(
    "Not Issuing Ticket",
    "critical",
    "Employee collected fare but failed to issue an official ticket/POS transaction.",
    "Suspension",
    "Suspend employee pending investigation. Repeated offense may lead to termination recommendation.",
    3
  ),
  "Wrong Fare Collection": preset(
    "Wrong Fare Collection",
    "major",
    "Employee collected incorrect fare amount from passenger or transaction.",
    "Training Required",
    "Require fare matrix retraining and monitor following transactions."
  ),
  "Overcharging Passenger": preset(
    "Overcharging Passenger",
    "critical",
    "Employee charged a passenger above the authorized fare.",
    "Final Warning",
    "Issue final warning, refund verified overcharge, and monitor fare transactions."
  ),
  "Unreported Cash Collection": preset(
    "Unreported Cash Collection",
    "critical",
    "Employee collected fare or cash that was not reported in official records.",
    "Under Investigation",
    "Open cash accountability investigation and temporarily restrict cash handling."
  ),
  "Late Remittance": preset(
    "Late Remittance",
    "major",
    "Conductor submitted remittance later than the required turn-over schedule.",
    "Written Warning",
    "Issue written warning. Repeated violation may result in suspension or route reassignment."
  ),
  "Short Remittance": preset(
    "Short Remittance",
    "major",
    "Conductor remitted an amount lower than the expected collection for the assigned shift/trip.",
    "Cash Shortage Deduction",
    "Deduct verified shortage amount after review. If repeated or intentional, escalate to suspension."
  ),
  "No Remittance": preset(
    "No Remittance",
    "critical",
    "Conductor failed to remit collected fare amount after the assigned shift/trip.",
    "Suspension",
    "Temporarily suspend employee pending investigation and require cash accountability report.",
    3
  ),
  "Fake Remittance Proof": preset(
    "Fake Remittance Proof",
    "critical",
    "Employee submitted false or altered remittance proof.",
    "Suspension",
    "Suspend employee pending audit. Escalate if falsification is confirmed.",
    5
  ),
  "Cash Misappropriation": preset(
    "Cash Misappropriation",
    "critical",
    "Employee used, withheld, or diverted company cash collections without authorization.",
    "Termination Recommendation",
    "Escalate for management review and prepare termination recommendation if confirmed.",
    0
  ),
  "Passenger Complaint": preset(
    "Passenger Complaint",
    "minor",
    "Passenger submitted a complaint regarding employee conduct or service.",
    "Under Investigation",
    "Review passenger complaint and collect employee statement before final action."
  ),
  "Rude Behavior": preset(
    "Rude Behavior",
    "major",
    "Employee showed rude or unprofessional behavior toward passenger, co-worker, or supervisor.",
    "Written Warning",
    "Issue written warning and require customer service coaching."
  ),
  "Harassment": preset(
    "Harassment",
    "critical",
    "Employee was reported for harassment or intimidating behavior.",
    "Suspension",
    "Suspend employee pending investigation and protect complainant from further contact.",
    5
  ),
  "Discrimination": preset(
    "Discrimination",
    "critical",
    "Employee discriminated against a passenger or co-worker based on protected status or unfair treatment.",
    "Suspension",
    "Suspend employee pending investigation and require management review.",
    5
  ),
  "Refusal to Give Discount": preset(
    "Refusal to Give Discount",
    "major",
    "Employee refused a valid passenger discount without proper basis.",
    "Training Required",
    "Require fare discount policy retraining and monitor following trips."
  ),
  "Fuel Misuse": preset(
    "Fuel Misuse",
    "major",
    "Employee used fuel outside approved company operation or failed to follow fuel controls.",
    "Salary Deduction",
    "Review fuel records and apply verified deduction only after approval."
  ),
  "Fuel Theft": preset(
    "Fuel Theft",
    "critical",
    "Employee was involved in unauthorized removal or theft of company fuel.",
    "Termination Recommendation",
    "Escalate for management investigation and termination recommendation if confirmed.",
    0
  ),
  "Maintenance Neglect": preset(
    "Maintenance Neglect",
    "major",
    "Employee failed to perform or report required maintenance checks.",
    "Training Required",
    "Require maintenance process retraining and supervisor monitoring."
  ),
  "Falsification of Record": preset(
    "Falsification of Record",
    "critical",
    "Employee falsified company records, logs, reports, remittances, or operational documents.",
    "Suspension",
    "Suspend employee pending document audit and management review.",
    5
  ),
  "Unauthorized Account Access": preset(
    "Unauthorized Account Access",
    "critical",
    "Employee accessed or used an account without authorization.",
    "Suspension",
    "Suspend employee pending system access audit and credential review.",
    3
  ),
  Fraud: preset(
    "Fraud",
    "critical",
    "Employee committed or attempted fraudulent activity involving company operations or records.",
    "Termination Recommendation",
    "Escalate for formal investigation and termination recommendation if confirmed."
  ),
  Theft: preset(
    "Theft",
    "critical",
    "Employee was involved in theft of company, passenger, or co-worker property.",
    "Termination Recommendation",
    "Escalate for formal investigation and termination recommendation if confirmed."
  ),
  Other: preset(
    "Other",
    "minor",
    "Incident requires management review and classification.",
    "Under Investigation",
    "Review incident details and determine the appropriate disciplinary action."
  )
};

export const allViolationTypes = VIOLATION_GROUPS.flatMap((group) => group.types);

export const normalizeViolationStatus = (status?: string): ViolationStatus => {
  const normalized = String(status || "Active").trim().toLowerCase();
  if (normalized === "resolved") return "Resolved";
  if (normalized === "dismissed") return "Dismissed";
  if (normalized === "escalated") return "Escalated";
  if (normalized === "under review" || normalized === "investigating") return "Under Review";
  return "Active";
};

export const getViolationCategory = (type?: string) => categoryFor(type || "Other");

export const isOpenViolation = (record: EmployeeViolationRecord) =>
  ["Active", "Under Review", "Escalated"].includes(normalizeViolationStatus(record.status));

export const isActiveSuspension = (record: EmployeeViolationRecord, now = new Date()) => {
  if ((record.penaltyType || record.penalty) !== "Suspension") return false;
  if (!isOpenViolation(record) || !record.penaltyEndDate) return false;
  const end = new Date(`${record.penaltyEndDate}T23:59:59`);
  return end.getTime() >= now.getTime();
};

export const remainingSuspensionDays = (record: EmployeeViolationRecord, now = new Date()) => {
  if (!isActiveSuspension(record, now) || !record.penaltyEndDate) return 0;
  const end = new Date(`${record.penaltyEndDate}T23:59:59`);
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
};

export const calculatePenaltyEndDate = (startDate: string, suspensionDays: number) => {
  if (!startDate || !Number.isFinite(suspensionDays) || suspensionDays <= 0) return "";
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + suspensionDays);
  return date.toISOString().split("T")[0];
};

