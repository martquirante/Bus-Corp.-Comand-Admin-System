import type { ApiEnvelope } from "@pos-bus/shared";

export const envelope = <T>(data: T, source: ApiEnvelope<T>["source"]): ApiEnvelope<T> => ({
  data,
  source,
  generatedAt: new Date().toISOString()
});
