import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Helper for Express proxy mode on local/Perplexity
export const PROXY_BASE = '__PORT_5000__'

export async function apiRequest(method: string, path: string, body?: unknown) {
  const url = PROXY_BASE ? `${PROXY_BASE}${path}` : path
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) options.body = JSON.stringify(body)
  return fetch(url, options)
}
