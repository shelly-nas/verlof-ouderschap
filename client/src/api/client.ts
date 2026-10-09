import { useCallback, useEffect, useState } from "react";
import type { MutationResult } from "./types";

/** Een fout van de API, met de meldingen zoals de server ze formuleert. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly errors: string[],
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(errors[0] ?? `Verzoek mislukt (${status})`);
  }
}

// Altijd een relatief pad: lokaal proxyt nginx (of Vite) /api naar de server,
// in productie routeert Traefik het.
async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, ["De server is niet bereikbaar. Controleer je verbinding en probeer het opnieuw."]);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.errors ?? [`De server gaf een fout (${response.status}).`],
      payload?.fieldErrors ?? {},
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal),
  post: <T = undefined>(path: string, body?: unknown) => request<MutationResult<T>>("POST", path, body ?? {}),
  put: <T = undefined>(path: string, body: unknown) => request<MutationResult<T>>("PUT", path, body),
  delete: (path: string) => request<MutationResult>("DELETE", path),
};

export type Resource<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** Opnieuw ophalen; de huidige data blijft staan tot het nieuwe antwoord er is. */
  reload: () => void;
};

/** Haalt `path` op en opnieuw zodra het pad verandert; `null` haalt niets op. */
export function useApi<T>(path: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .get<T>(path, controller.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((caught: Error) => {
        if (caught.name === "AbortError") return;
        setError(caught instanceof ApiError ? caught : new ApiError(0, [caught.message]));
        setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, error, loading, reload };
}

/** Een foutmelding voor in een alert of toast. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.errors.join(" ");
  return error instanceof Error ? error.message : String(error);
}
