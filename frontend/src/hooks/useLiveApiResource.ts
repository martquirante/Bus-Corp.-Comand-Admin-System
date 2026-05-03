"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiEnvelope } from "@pos-bus/shared";

type LiveResourceOptions = {
  intervalMs?: number;
  enabled?: boolean;
};

export function useLiveApiResource<T>(
  loader: () => Promise<ApiEnvelope<T>>,
  { intervalMs = 5000, enabled = true }: LiveResourceOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [source, setSource] = useState<ApiEnvelope<T>["source"]>("demo");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);

  const refresh = useCallback(
    async (isBackground = false) => {
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      if (isBackground) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const result = await loader();
        setData(result.data);
        setSource(result.source);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load live resource.");
      } finally {
        inFlightRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [loader]
  );

  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;
    refresh(false);

    const timer = window.setInterval(() => {
      if (mountedRef.current) void refresh(true);
    }, intervalMs);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, refresh]);

  return { data, source, isLoading, isRefreshing, error, refresh: () => refresh(false) };
}
