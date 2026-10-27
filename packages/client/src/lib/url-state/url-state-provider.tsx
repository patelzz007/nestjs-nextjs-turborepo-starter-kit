"use client";

// ============================================
// lib/url-state/url-state-provider.tsx - the URL-state engine for a Next.js app
// ============================================
// Mounts nuqs's App Router adapter, which every `useUrlState` reads and writes
// through. Each Next.js app mounts it ONCE, in its root layout, around
// everything that may read URL state.

import { NuqsAdapter } from "nuqs/adapters/next/app";
import type * as React from "react";

export interface UrlStateProviderProps {
	readonly children: React.ReactNode;
}

/** The app-wide URL-state engine (nuqs on the Next.js App Router). */
export function UrlStateProvider({ children }: UrlStateProviderProps): React.JSX.Element {
	return <NuqsAdapter>{children}</NuqsAdapter>;
}
