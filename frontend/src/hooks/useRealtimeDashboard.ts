"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiEnvelope, DashboardSummary } from "@pos-bus/shared";
import { api } from "@/services/api";
import { realtimeClient } from "@/services/realtimeClient";

export function useRealtimeDashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [source, setSource] = useState<ApiEnvelope<DashboardSummary>["source"]>("demo");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const result = await api.getDashboardSummary();
      setData(result.data);
      setSource(result.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard summary failed to load.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const close = realtimeClient.streamDashboard({
      onData(payload) {
        setData(payload.data);
        setSource(payload.source);
        setIsLoading(false);
        setError(null);
      },
      onError(message) {
        setError(message);
      }
    });

    return close;
  }, [refresh]);

  return { data, source, isLoading, isRefreshing, error, refresh };
}
