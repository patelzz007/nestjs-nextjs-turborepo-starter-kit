// ============================================
// lib/query-provider.tsx - QueryClient Provider
// ============================================
"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type JSX, type ReactNode } from "react"

export interface QueryProviderProps {
  readonly children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps): JSX.Element {
  const [queryClient] = useState<QueryClient>(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
