import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * API routing strategy:
 * - In the Perplexity Computer sandbox: requests go to the local Express server via __PORT_5000__
 * - In GitHub Pages static deployment: requests go directly to external APIs
 *   (GovTrack.us, Congress.gov) or to pre-built /data/*.json files
 *
 * The `apiRequest` function handles the routing transparently.
 */

// When deployed via Perplexity Computer, this gets rewritten to the proxy path.
// When deployed statically (GitHub Pages), this is an empty string (relative URLs).
const PROXY_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Detect if we're running as a static site (no Express backend).
// VITE_STATIC=true is set at build time for all static deployments (GitHub Pages, local http.server).
export const IS_STATIC =
  import.meta.env.VITE_STATIC === "true" ||
  (PROXY_BASE === "" &&
    typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1"));

// External API base URLs (called directly from browser in static mode)
export const GOVTRACK_API = "https://www.govtrack.us/api/v2";
export const CONGRESS_API = "https://api.congress.gov/v3";
export const CONGRESS_API_KEY = "SaE2is72peVUEN1dvkJVMNofrE9FvnxeeaaQa2st";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const res = await fetch(`${PROXY_BASE}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${PROXY_BASE}${queryKey.join("/")}`);
    if (unauthorizedBehavior === "returnNull" && res.status === 401) return null;
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
    mutations: { retry: false },
  },
});
