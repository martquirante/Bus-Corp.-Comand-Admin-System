"use client";

import { useCallback, useState, useEffect } from "react";
import {
  Fingerprint,
  ShieldCheck,
  ShieldAlert,
  Boxes,
  Database,
  Link as LinkIcon,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  KeyRound,
  ShieldAlert as ShieldIcon,
  FileCheck,
  Send,
  Sparkles
} from "lucide-react";
import { api } from "@/services/api";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { formatNumber } from "@/utils/format";

type BlockchainStats = {
  enabled: boolean;
  network: string;
  contractAddress: string;
  rpcUrl: string;
  stats: {
    total: number;
    verified: number;
    pending: number;
    failed: number;
    local_only: number;
    mismatch: number;
  };
};

export function BlockchainSecurityPage() {
  const [activeTab, setActiveTab] = useState<"audits" | "security">("audits");
  const [stats, setStats] = useState<BlockchainStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Detailed view & manual check states
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [isVerifyingSingle, setIsVerifyingSingle] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, logsRes, secLogsRes] = await Promise.all([
        api.blockchainStatus(),
        api.blockchainLogs(),
        api.blockchainSecurityLogs()
      ]);

      if (statsRes?.data) setStats(statsRes.data);
      if (logsRes?.data) setAuditLogs(logsRes.data);
      if (secLogsRes?.data) setSecurityLogs(secLogsRes.data);
    } catch (error) {
      console.error("[blockchain-page] Error loading ledger data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Bulk recalulation & integrity check across all operational records
  const handleBulkVerify = async () => {
    setIsActionLoading(true);
    try {
      const res = await api.verifyAllPendingAudits();
      alert(`Integrity Scan Complete!\nChecked pending audits.\nVerified: ${res.data.verified}\nMismatches/Tampered: ${res.data.mismatches}`);
      await loadData();
    } catch (err: any) {
      alert(`Integrity check failed: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Retry pending anchors
  const handleRetryPending = async () => {
    setIsActionLoading(true);
    try {
      const res = await api.retryPendingAudits();
      alert(`Anchoring retry complete!\nAttempted: ${res.data.attemptedCount}\nSuccess: ${res.data.successCount}\nFailed: ${res.data.failedCount}`);
      await loadData();
    } catch (err: any) {
      alert(`Anchoring retry failed: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Manual recalculation of a single record
  const handleVerifySingle = async (log: any) => {
    setIsVerifyingSingle(true);
    setVerificationResult(null);
    try {
      const res = await api.verifyBlockchainRecord(log.recordType, log.recordId);
      setVerificationResult(res.data);
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setIsVerifyingSingle(false);
    }
  };

  // Force anchor single record
  const handleAnchorSingle = async (log: any) => {
    setIsActionLoading(true);
    try {
      const res = await api.anchorBlockchainRecord(log.recordType, log.recordId);
      alert(`Anchoring request submitted on-chain!\nTx Hash: ${res.data.txHash || "Pending"}`);
      await loadData();
      if (selectedAudit && selectedAudit.id === log.id) {
        setSelectedAudit(null);
      }
    } catch (err: any) {
      alert(`Anchoring failed: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Filters mapping
  const filteredAudits = auditLogs
    .filter((log) => {
      const matchSearch =
        log.recordId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.recordHash && log.recordHash.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.blockchainTxHash && log.blockchainTxHash.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = typeFilter === "all" || log.recordType === typeFilter;
      const matchStatus = statusFilter === "all" || log.blockchainStatus === statusFilter;
      return matchSearch && matchType && matchStatus;
    });

  const filteredSecurity = securityLogs
    .filter((log) => {
      return (
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.actorId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <span className="badge badge-green"><CheckCircle2 size={13} /> Verified</span>;
      case "pending":
        return <span className="badge badge-orange"><Clock size={13} /> Pending Anchor</span>;
      case "failed":
        return <span className="badge badge-red"><AlertCircle size={13} /> Sync Failed</span>;
      case "local_only":
        return <span className="badge badge-blue"><Database size={13} /> Local Only</span>;
      case "mismatch":
        return <span className="badge badge-red font-bold animate-pulse"><ShieldAlert size={13} /> Tampered!</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  const getLogTypeBadge = (type: string) => {
    switch (type) {
      case "ticket":
        return <span className="text-violet-400 bg-violet-950/40 px-2 py-0.5 rounded text-xs font-mono font-medium border border-violet-800/30">Ticket</span>;
      case "remittance":
        return <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded text-xs font-mono font-medium border border-emerald-800/30">Remittance</span>;
      case "violation":
        return <span className="text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded text-xs font-mono font-medium border border-amber-800/30">Violation</span>;
      case "file_upload":
        return <span className="text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded text-xs font-mono font-medium border border-sky-800/30">File Upload</span>;
      case "report_export":
        return <span className="text-pink-400 bg-pink-950/40 px-2 py-0.5 rounded text-xs font-mono font-medium border border-pink-800/30">Report export</span>;
      default:
        return <span className="text-gray-400 bg-gray-950/40 px-2 py-0.5 rounded text-xs font-mono border border-gray-800/30">{type}</span>;
    }
  };

  const formatHash = (hash: string) => {
    if (!hash) return "N/A";
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <AppShell title="Security Ledger" kicker="Tamper-proof blockchain audits and security tracking">
      {/* Configuration Status Card */}
      <section className="command-card relative overflow-hidden bg-gradient-to-r from-slate-950/90 via-slate-900/60 to-indigo-950/20 border-indigo-900/40 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Fingerprint size={120} className="text-indigo-400" />
        </div>
        <div className="flex gap-4 items-center">
          <div className={`p-4 rounded-xl ${stats?.enabled ? "bg-emerald-950/50 border border-emerald-500/30 text-emerald-400" : "bg-blue-950/50 border border-blue-500/30 text-blue-400"} shadow-inner`}>
            <Boxes size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">Drive&Go Blockchain Audit</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${stats?.enabled ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30" : "bg-blue-950 text-blue-400 border border-blue-500/30"}`}>
                {stats?.enabled ? "BLOCKCHAIN ACTIVE" : "LOCAL MODE (TAMPER-PROOF)"}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              All transactions, remittances, employee records, uploads, and reports are protected by cryptographically linked block hashes using SHA-256 local proofs and optional Polygon/Amoy blockchain anchoring.
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isActionLoading || isLoading}
            onClick={handleBulkVerify}
            className="soft-button flex items-center gap-2 hover:bg-slate-800 transition-all border border-indigo-800/30 px-4 py-2 rounded-lg text-sm text-indigo-300 font-medium"
          >
            <FileCheck size={16} /> Bulk Scan Integrity
          </button>
          {stats?.enabled && (
            <button
              type="button"
              disabled={isActionLoading || isLoading}
              onClick={handleRetryPending}
              className="soft-button flex items-center gap-2 hover:bg-slate-800 transition-all border border-indigo-800/30 px-4 py-2 rounded-lg text-sm text-indigo-300 font-medium"
            >
              <Send size={16} /> Retry On-Chain Anchors
            </button>
          )}
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading || isActionLoading}
            className="soft-button p-2 text-slate-400 hover:text-white"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </section>

      {/* Network Config Panel */}
      {stats && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="command-card p-4 rounded-xl border-slate-800 bg-slate-950/40">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Target Audit Network</span>
            <strong className="text-lg text-white mt-1 block flex items-center gap-2">
              <Boxes size={16} className="text-indigo-400" />
              {stats.network || "Offline Local Storage"}
            </strong>
          </div>
          <div className="command-card p-4 rounded-xl border-slate-800 bg-slate-950/40 col-span-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Smart Contract Address</span>
            <strong className="text-sm font-mono text-indigo-300 mt-1 block break-all">
              {stats.contractAddress || "N/A (Local Proof Hashes Only)"}
            </strong>
          </div>
        </section>
      )}

      {/* Statistics Cards */}
      <section className="stats-grid mt-6">
        <StatCard
          label="Total Cryptographic Proofs"
          value={stats ? formatNumber(stats.stats.total) : "0"}
          detail="Combined local and chain proofs"
          tone="violet"
          icon={Fingerprint}
        />
        <StatCard
          label="On-Chain Anchored"
          value={stats ? formatNumber(stats.stats.verified) : "0"}
          detail="Polygon verification absolute proof"
          tone="green"
          icon={CheckCircle2}
        />
        <StatCard
          label="Pending Anchorage"
          value={stats ? formatNumber(stats.stats.pending) : "0"}
          detail="Queued in backend scheduler"
          tone="amber"
          icon={Clock}
        />
        <StatCard
          label="Local Offline Proofs"
          value={stats ? formatNumber(stats.stats.local_only) : "0"}
          detail="Tamper-proof local ledger only"
          tone="blue"
          icon={Database}
        />
        <StatCard
          label="Tamper Alarm Mismatches"
          value={stats ? formatNumber(stats.stats.mismatch) : "0"}
          detail="Integrity check failures"
          tone={stats && stats.stats.mismatch > 0 ? "red" : "blue"}
          icon={ShieldAlert}
        />
      </section>

      {/* Control Tabs */}
      <div className="flex border-b border-slate-800/80 mt-8 gap-4">
        <button
          type="button"
          onClick={() => {
            setActiveTab("audits");
            setSearchTerm("");
          }}
          className={`py-3 px-4 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${activeTab === "audits" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
        >
          <Boxes size={16} /> Operational Audit Trail
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("security");
            setSearchTerm("");
          }}
          className={`py-3 px-4 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${activeTab === "security" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
        >
          <KeyRound size={16} /> System Security Logs
        </button>
      </div>

      {/* Search and Filters */}
      <section className="command-card mt-6 p-4 rounded-xl bg-slate-950/20 border-slate-900/60 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder={activeTab === "audits" ? "Search Record ID, cryptographic hash or tx hash..." : "Search action, email, IP address..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-600 transition-colors"
          />
        </div>

        {activeTab === "audits" && (
          <div className="flex gap-2 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-800/80 px-3 py-1.5 rounded-lg">
              <Filter size={14} className="text-slate-500" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="ticket">Tickets</option>
                <option value="remittance">Remittances</option>
                <option value="violation">Violations</option>
                <option value="file_upload">File Uploads</option>
                <option value="report_export">Report Exports</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-800/80 px-3 py-1.5 rounded-lg">
              <ShieldIcon size={14} className="text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="local_only">Local Only</option>
                <option value="mismatch">Mismatches</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* Main Tables */}
      <section className="command-card mt-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw size={24} className="animate-spin text-indigo-500 mb-2" />
            <span>Decrypting ledger indexes...</span>
          </div>
        ) : activeTab === "audits" ? (
          <DataTable
            rows={filteredAudits}
            getRowKey={(row) => row.id}
            columns={[
              { header: "Type", cell: (row) => getLogTypeBadge(row.recordType) },
              { header: "Record ID", cell: (row) => <strong className="text-white font-mono text-xs">{row.recordId}</strong> },
              { header: "Record Hash (SHA-256)", cell: (row) => <span className="font-mono text-xs text-indigo-200">{formatHash(row.recordHash)}</span> },
              { header: "On-Chain Status", cell: (row) => getStatusBadge(row.blockchainStatus) },
              { header: "Anchor Tx Hash", cell: (row) => row.blockchainTxHash ? (
                <span className="font-mono text-xs text-slate-400 flex items-center gap-1">
                  <LinkIcon size={12} className="text-indigo-500" />
                  {formatHash(row.blockchainTxHash)}
                </span>
              ) : <span className="text-xs text-slate-600">None</span> },
              { header: "Created At", cell: (row) => <span className="text-xs text-slate-400">{new Date(row.createdAt).toLocaleString("en-PH")}</span> },
              {
                header: "Actions",
                cell: (row) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAudit(row);
                      setVerificationResult(null);
                    }}
                    className="soft-button flex items-center gap-1.5 bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-400 hover:text-indigo-300 border border-indigo-900/50 px-2.5 py-1 rounded text-xs transition-all"
                  >
                    <Eye size={12} /> Inspect
                  </button>
                )
              }
            ]}
          />
        ) : (
          <DataTable
            rows={filteredSecurity}
            getRowKey={(row) => row.id}
            columns={[
              { header: "Actor", cell: (row) => <strong className="text-white text-xs">{row.actorId}</strong> },
              { header: "Role", cell: (row) => <span className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-semibold">{row.actorRole}</span> },
              {
                header: "Action Trigger",
                cell: (row) => {
                  const isSuccess = row.action.includes("success");
                  const isFail = row.action.includes("failed") || row.action.includes("lockout");
                  return (
                    <span className={`text-xs font-semibold ${isSuccess ? "text-emerald-400" : isFail ? "text-red-400 font-bold" : "text-slate-300"}`}>
                      {row.action.toUpperCase()}
                    </span>
                  );
                }
              },
              { header: "Resource Target", cell: (row) => row.resourceType ? <span className="text-xs font-mono bg-slate-900/80 px-1.5 py-0.5 rounded text-slate-400">{row.resourceType}:{row.resourceId || "N/A"}</span> : <span className="text-xs text-slate-600">None</span> },
              { header: "IP Address", cell: (row) => <span className="font-mono text-xs text-slate-400">{row.ipAddress || "::1"}</span> },
              { header: "Details Logged", cell: (row) => <span className="text-xs text-slate-400 truncate max-w-xs block">{JSON.stringify(row.details || {})}</span> },
              { header: "Timestamp", cell: (row) => <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString("en-PH")}</span> }
            ]}
          />
        )}
      </section>

      {/* Cryptographic Inspector Modal */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="command-card w-full max-w-2xl bg-slate-950 border border-slate-800/80 rounded-2xl shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Fingerprint className="text-indigo-400" />
              Cryptographic Audit Proof Inspector
            </h3>

            <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 font-semibold block uppercase">Audit Log ID</span>
                  <span className="text-sm font-mono text-slate-300">{selectedAudit.id}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-semibold block uppercase">Record Key</span>
                  <span className="text-sm font-mono text-slate-300 flex items-center gap-1.5">
                    {getLogTypeBadge(selectedAudit.recordType)}
                    {selectedAudit.recordId}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-semibold block uppercase">Linked Record SHA-256 Hash</span>
                <span className="text-xs font-mono text-indigo-300 bg-slate-950 border border-slate-900 rounded p-2 block break-all leading-relaxed shadow-inner">
                  {selectedAudit.recordHash}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-semibold block uppercase">Previous Ledger Block Hash Link</span>
                <span className="text-xs font-mono text-slate-500 bg-slate-950/40 border border-slate-900 rounded p-2 block break-all leading-relaxed">
                  {selectedAudit.previousHash || "0x0000000000000000000000000000000000000000000000000000000000000000 (Genesis Root)"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 font-semibold block uppercase">Anchor Status</span>
                  <div className="mt-1">{getStatusBadge(selectedAudit.blockchainStatus)}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-semibold block uppercase">Created By</span>
                  <span className="text-sm text-slate-300 mt-1 block">{selectedAudit.createdById || "System"} ({selectedAudit.createdByRole || "N/A"})</span>
                </div>
              </div>

              {selectedAudit.blockchainTxHash && (
                <div>
                  <span className="text-xs text-slate-500 font-semibold block uppercase">On-Chain Transaction Reference</span>
                  <a
                    href={`https://amoy.polygonscan.com/tx/${selectedAudit.blockchainTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-indigo-400 hover:text-indigo-300 mt-1 block break-all hover:underline"
                  >
                    {selectedAudit.blockchainTxHash}
                  </a>
                </div>
              )}

              {selectedAudit.metadata && Object.keys(selectedAudit.metadata).length > 0 && (
                <div>
                  <span className="text-xs text-slate-500 font-semibold block uppercase">Ledger Payload Metadata</span>
                  <pre className="text-xs text-slate-400 bg-slate-950 border border-slate-900 rounded p-3 block overflow-x-auto max-h-32 font-mono">
                    {JSON.stringify(selectedAudit.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Integrity Recalculator Panel */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/60 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-200 font-bold flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    Cryptographic Integrity Verification
                  </span>
                  <button
                    type="button"
                    disabled={isVerifyingSingle}
                    onClick={() => handleVerifySingle(selectedAudit)}
                    className="soft-button bg-indigo-950 text-indigo-400 border border-indigo-900 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-900 transition-all flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={isVerifyingSingle ? "animate-spin" : ""} />
                    {isVerifyingSingle ? "Re-Hashing..." : "Run Re-Hash Integrity Check"}
                  </button>
                </div>

                {verificationResult && (
                  <div className="mt-3 space-y-2 border-t border-slate-800/80 pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Database Current Hash:</span>
                      <span className="font-mono text-indigo-300 break-all ml-4 text-right max-w-xs">{verificationResult.computedHash.slice(0, 16)}...</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Audit Ledger Saved Hash:</span>
                      <span className="font-mono text-indigo-300 break-all ml-4 text-right max-w-xs">{verificationResult.savedHash.slice(0, 16)}...</span>
                    </div>
                    <div className={`flex items-center gap-2 mt-3 p-3 rounded-lg border text-xs font-medium ${verificationResult.tampered ? "bg-red-950/60 border-red-500/30 text-red-400" : "bg-emerald-950/60 border-emerald-500/30 text-emerald-400"}`}>
                      {verificationResult.tampered ? (
                        <>
                          <ShieldAlert size={16} />
                          <span>WARNING: Cryptographic mismatch! Database records have been tampered with or edited outside the app!</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          <span>SUCCESS: Cryptographic hashes match. Data integrity verified! No unauthorized edits detected.</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-between gap-3 border-t border-slate-800 pt-4">
              {stats?.enabled && selectedAudit.blockchainStatus === "local_only" && (
                <button
                  type="button"
                  onClick={() => handleAnchorSingle(selectedAudit)}
                  disabled={isActionLoading}
                  className="soft-button flex items-center gap-1 bg-emerald-950 border border-emerald-900/60 hover:bg-emerald-900 text-emerald-400 hover:text-emerald-300 px-4 py-2 rounded-lg text-sm transition-all"
                >
                  <Sparkles size={14} /> Anchor to Blockchain
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => {
                  setSelectedAudit(null);
                  setVerificationResult(null);
                }}
                className="soft-button bg-slate-800 text-slate-200 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
