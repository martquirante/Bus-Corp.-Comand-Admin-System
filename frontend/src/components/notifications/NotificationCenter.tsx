"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LegacyNotification } from "@pos-bus/shared";
import { AlertTriangle, Bell, Check, CheckCheck, Inbox, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { formatDateTime } from "@/utils/format";

const severityIcon = (severity: LegacyNotification["severity"]) =>
  severity === "critical" ? <AlertTriangle size={16} /> : severity === "warning" ? <Bell size={16} /> : <Inbox size={16} />;

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<LegacyNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const result = await api.getUnreadNotificationCount();
      setUnreadCount(result.data.count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.getNotifications();
      setNotifications(result.data);
      setUnreadCount(result.data.filter((notification) => !notification.read).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 5000);
    return () => window.clearInterval(timer);
  }, [refreshUnread]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setInterval(refreshNotifications, 5000);
    return () => window.clearInterval(timer);
  }, [isOpen, refreshNotifications]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const openPanel = async () => {
    setIsOpen((current) => !current);
    if (!isOpen) await refreshNotifications();
  };

  const markRead = async (notification: LegacyNotification) => {
    await api.markNotificationRead(notification.id);
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
    );
    setUnreadCount((current) => Math.max(0, current - (notification.read ? 0 : 1)));
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="notification-center" ref={panelRef}>
      <button
        type="button"
        className="icon-button"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={openPanel}
      >
        <Bell size={18} />
        {unreadCount > 0 ? <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <section className="notification-panel" aria-label="Command center notifications">
          <div className="notification-panel-header">
            <div>
              <span>Command alerts</span>
              <strong>{unreadCount ? `${unreadCount} unread` : "All clear"}</strong>
            </div>
            <button type="button" className="soft-button compact-button" onClick={markAllRead} disabled={!notifications.length}>
              <CheckCheck size={14} /> Read all
            </button>
          </div>

          {isLoading ? (
            <div className="notification-state">
              <Loader2 size={18} className="spin-icon" /> Loading alerts...
            </div>
          ) : error ? (
            <div className="notification-state error-state">
              <AlertTriangle size={18} /> {error}
              <button type="button" className="soft-button compact-button" onClick={refreshNotifications}>
                Retry
              </button>
            </div>
          ) : notifications.length ? (
            <div className="notification-list">
              {notifications.slice(0, 12).map((notification) => (
                <article
                  key={notification.id}
                  className={`notification-item severity-${notification.severity} ${notification.read ? "read" : "unread"}`}
                >
                  <div className="notification-icon">{severityIcon(notification.severity)}</div>
                  <div className="notification-copy">
                    <strong>{notification.title}</strong>
                    <p>{notification.body}</p>
                    <span>{formatDateTime(notification.timestamp)}</span>
                  </div>
                  {!notification.read ? (
                    <button
                      type="button"
                      className="notification-read-button"
                      aria-label={`Mark ${notification.title} as read`}
                      onClick={() => markRead(notification)}
                    >
                      <Check size={14} />
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="notification-state">
              <Inbox size={18} /> No command alerts yet.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
