"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import type { EmployeeRecord } from "@pos-bus/shared";
import { Download, FlipHorizontal } from "lucide-react";
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
      backgroundColor: "#ffffff"
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
  const [isWorking, setIsWorking] = useState(false);
  const fileBase = employee?.employeeNumber || "employee-id";
  const lastSavedRef = useRef<string | null>(null);

  const guard = () => {
    if (!employee) throw new Error("Select an employee first.");
  };

  const downloadFront = async () => {
    try {
      guard();
      setIsWorking(true);
      setMessage(null);
      downloadBlob(await nodeToBlob(frontRef.current), `${fileBase}-front.png`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not download front ID.");
    } finally {
      setIsWorking(false);
    }
  };

  const downloadBack = async () => {
    try {
      guard();
      setIsWorking(true);
      setMessage(null);
      downloadBlob(await nodeToBlob(backRef.current), `${fileBase}-back.png`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not download back ID.");
    } finally {
      setIsWorking(false);
    }
  };

  const downloadPdf = async () => {
    try {
      guard();
      setIsWorking(true);
      setMessage(null);
      const [front, back] = await Promise.all([nodeToBlob(frontRef.current), nodeToBlob(backRef.current)]);
      const width = frontRef.current?.offsetWidth || 390;
      const height = frontRef.current?.offsetHeight || 620;
      downloadBlob(await createPdfBlob(front, back, width, height), `${fileBase}.pdf`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not download employee ID PDF.");
    } finally {
      setIsWorking(false);
    }
  };

  const saveToStorage = async () => {
    try {
      guard();
      if (!employee) return;
      setIsWorking(true);
      setMessage(null);
      const [front, back, qr] = await Promise.all([nodeToBlob(frontRef.current), nodeToBlob(backRef.current), qrBlob(qrDataUrl)]);
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save employee ID assets.");
    } finally {
      setIsWorking(false);
    }
  };

  useEffect(() => {
    if (!employee || !qrDataUrl) return;
    const saveKey = `${employee.id}-${qrDataUrl}`;
    if (lastSavedRef.current === saveKey) return;
    
    const timer = setTimeout(() => {
      lastSavedRef.current = saveKey;
      saveToStorage();
    }, 1500); // give DOM time to render images/fonts

    return () => clearTimeout(timer);
  }, [employee?.id, qrDataUrl]);

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
      {message && message !== "Employee ID assets saved to Supabase Storage." ? (
        <p className="form-error export-message">{message}</p>
      ) : null}
      {isWorking ? <p className="form-success export-message">Auto-saving ID...</p> : null}
      {message === "Employee ID assets saved to Supabase Storage." ? (
        <p className="form-success export-message">ID saved to cloud.</p>
      ) : null}
    </div>
  );
}
