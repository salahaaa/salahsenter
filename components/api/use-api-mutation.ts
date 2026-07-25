"use client";

import { useCallback, useState } from "react";
import { ApiClientError } from "@/lib/client/api-client";

/** Standard loading/error/retry state for client mutations. */
export function useApiMutation<TArgs extends unknown[], TResult>(operation: (...args: TArgs) => Promise<TResult>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [lastArgs, setLastArgs] = useState<TArgs | null>(null);

  const run = useCallback(async (...args: TArgs) => {
    setLoading(true); setError(null); setLastArgs(args);
    try { return await operation(...args); }
    catch (caught) {
      const normalized = caught instanceof ApiClientError ? caught : new ApiClientError({ message: caught instanceof Error ? caught.message : "تعذر تنفيذ العملية", status: 0 });
      setError(normalized);
      throw normalized;
    } finally { setLoading(false); }
  }, [operation]);

  const retry = useCallback(async () => {
    if (!lastArgs) return null;
    return run(...lastArgs);
  }, [lastArgs, run]);

  return { run, retry, loading, error, clearError: () => setError(null) };
}
