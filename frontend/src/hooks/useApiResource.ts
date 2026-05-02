"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiEnvelope } from "@pos-bus/shared";

export function useApiResource<T>(loader: () => Promise<ApiEnvelope<T>>) {
  const [data, setData] = useState<T | null>(null);
  const [source, setSource] = useState<ApiEnvelope<T>["source"]>("demo");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await loader();
      setData(result.data);
      setSource(result.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resource.");
    } finally {
      setIsLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, source, isLoading, error, refresh };
}
