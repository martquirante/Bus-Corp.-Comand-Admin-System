"use client";

import { RefObject, useState } from "react";
import type { EmployeeRecord } from "@pos-bus/shared";
import { CloudUpload, Download, FlipHorizontal } from "lucide-react";
import { toBlob } from "html-to-image";
import { jsPDF } from "jspdf";
import { api } from "@/services/api";

type EmployeeIdExportActionsProps = {
  employee: EmployeeRecord | null;
  frontRef: RefObject<HTMLDivElement | null>;
  backRef: RefObject<HTMLDivElement | null>;
  qrDataUrl: string;
  onFlip: () => void;
  onSaved: (employee: EmployeeRecord) => void;
};

const nodeToBlob = async (node: HTMLDivElement | null) => {
  if (!node) throw new Error("Employee ID preview is not ready.");
  const originalTransform = node.style.transform;
  const originalPosition = node.style.position;
  const originalInset = node.style.inset;
  const originalBackface = node.style.backfaceVisibility;

  node.style.transform = "none";
  node.style.position = "relative";
  node.style.inset = "auto";
  node.style.backfaceVisibility = "visible";

  try {
    const blob = await toBlob(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      skipFonts: true
    });
    if (!blob) throw new Error("Could not render employee ID image.");
    return blob;
  } finally {
    node.style.transform = originalTransform;
    node.style.position = originalPosition;
    node.style.inset = originalInset;
    node.style.backfaceVisibility = originalBackface;
  }
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Could not read generated image."));
    reader.readAsDataURL(blob);
  });

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const qrBlob = async (dataUrl: string) => {
  if (!dataUrl) throw new Error("QR code is not ready.");
  return fetch(dataUrl).then((response) => response.blob());
};

const createPdfBlob = async (front: Blob, back: Blob, width: number, height: number) => {
  const [frontDataUrl, backDataUrl] = await Promise.all([blobToDataUrl(front), blobToDataUrl(back)]);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [width, height]
  });
  pdf.addImage(frontDataUrl, "PNG", 0, 0, width, height);
  pdf.addPage([width, height], "portrait");
  pdf.addImage(backDataUrl, "PNG", 0, 0, width, height);
  return pdf.output("blob");
};

export function EmployeeIdExportActions({
  employee,
  frontRef,
  backRef,
  qrDataUrl,
  onFlip,
  onSaved
}: EmployeeIdExportActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const fileBase = employee?.employeeNumber || "employee-id";

  const guard = () => {
    if (!employee) throw new Error("Select an employee first.");
  };

  const withLoading = async (fn: () => Promise<void>) => {
    setIsWorking(true);
    setMessage(null);
    setIsSuccess(false);
    try {
      await fn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
      setIsSuccess(false);
    } finally {
      setIsWorking(false);
    }
  };

  const downloadFront = () =>
    withLoading(async () => {
      guard();
      downloadBlob(await nodeToBlob(frontRef.current), `${fileBase}-front.png`);
    });

  const downloadBack = () =>
    withLoading(async () => {
      guard();
      downloadBlob(await nodeToBlob(backRef.current), `${fileBase}-back.png`);
    });

  const downloadPdf = () =>
    withLoading(async () => {
      guard();
      const [front, back] = await Promise.all([nodeToBlob(frontRef.current), nodeToBlob(backRef.current)]);
      const width = frontRef.current?.offsetWidth || 390;
      const height = frontRef.current?.offsetHeight || 620;
      downloadBlob(await createPdfBlob(front, back, width, height), `${fileBase}.pdf`);
    });

  const saveToStorage = () =>
    withLoading(async () => {
      guard();
      if (!employee) return;
      const [front, back, qr] = await Promise.all([
        nodeToBlob(frontRef.current),
        nodeToBlob(backRef.current),
        qrBlob(qrDataUrl)
      ]);
      const width = frontRef.current?.offsetWidth || 390;
      const height = frontRef.current?.offsetHeight || 620;
      const pdf = await createPdfBlob(front, back, width, height);

      const frontResult = await api.uploadEmployeeIdFront(employee.id, front);
      const backResult = await api.uploadEmployeeIdBack(employee.id, back);
      const pdfResult = await api.uploadEmployeeIdPdf(employee.id, pdf);
      const qrResult = await api.uploadEmployeeQr(employee.id, qr);
      const updated =
        qrResult.data.employee || pdfResult.data.employee || backResult.data.employee || frontResult.data.employee;
      if (updated) onSaved(updated);
      setMessage("Employee ID assets saved to Supabase Storage.");
      setIsSuccess(true);
    });

  return (
    <div className="employee-id-actions">
      <button type="button" className="soft-button" onClick={onFlip} disabled={!employee || isWorking}>
        <FlipHorizontal size={15} /> Flip ID
      </button>
      <button type="button" className="soft-button" onClick={downloadFront} disabled={!employee || isWorking}>
        <Download size={15} /> Front PNG
      </button>
      <button type="button" className="soft-button" onClick={downloadBack} disabled={!employee || isWorking}>
        <Download size={15} /> Back PNG
      </button>
      <button type="button" className="soft-button" onClick={downloadPdf} disabled={!employee || isWorking}>
        <Download size={15} /> PDF
      </button>
      <button type="button" className="primary-action" onClick={saveToStorage} disabled={!employee || isWorking}>
        <CloudUpload size={15} /> {isWorking ? "Saving…" : "Save to Cloud"}
      </button>
      {message && !isSuccess ? <p className="form-error export-message">{message}</p> : null}
      {message && isSuccess ? <p className="form-success export-message">{message}</p> : null}
    </div>
  );
}
