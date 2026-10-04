"use client";

import * as React from "react";

import { RouteErrorState } from "@/components/web-ui/route-error-state";

export interface WebErrorProps {
	readonly error: Error & { readonly digest?: string };
	readonly retry: () => void;
}

/**
 * Error boundary for the pages outside `/rewardhub` (the landing page, the
 * public reward detail, the auth pages). `/rewardhub` has its own boundary
 * inside its shell; errors in the root layout reach `global-error.tsx`.
 */
export default function WebError({ error, retry }: WebErrorProps): React.JSX.Element {
	return (
		<main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
			<RouteErrorState digest={error.digest} onRetry={retry} />
		</main>
	);
}
