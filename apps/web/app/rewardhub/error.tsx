"use client";

import * as React from "react";

import { RouteErrorState } from "@/components/web-ui/route-error-state";

export interface RewardHubErrorProps {
	readonly error: Error & { readonly digest?: string };
	readonly retry: () => void;
}

/**
 * Error boundary for every `/rewardhub` page. It renders inside the Reward Hub
 * shell (the layout above it stays mounted), so a failed page keeps the
 * navigation. Server failures reach it from `settleServerQuery`, which has
 * already logged them on the server.
 */
export default function RewardHubError({ error, retry }: RewardHubErrorProps): React.JSX.Element {
	return <RouteErrorState digest={error.digest} onRetry={retry} className="my-8" />;
}
