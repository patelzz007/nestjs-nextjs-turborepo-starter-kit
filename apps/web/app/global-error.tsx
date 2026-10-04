"use client";

import "@workspace/ui/globals.css";
import "./web-theme.css";

import * as React from "react";

import { RouteErrorState } from "@/components/web-ui/route-error-state";

export interface WebGlobalErrorProps {
	readonly error: Error & { readonly digest?: string };
	readonly retry: () => void;
}

/**
 * Last-resort boundary for errors thrown by the root layout itself (e.g. the
 * session-permissions prefetch failing for an unexpected reason). It replaces
 * the root layout, so it renders its own document and imports the global styles.
 */
export default function WebGlobalError({ error, retry }: WebGlobalErrorProps): React.JSX.Element {
	return (
		<html lang="en">
			<body className="web-app font-sans antialiased">
				<title>Something went wrong · Reward Hub</title>
				<main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
					<RouteErrorState digest={error.digest} onRetry={retry} />
				</main>
			</body>
		</html>
	);
}
