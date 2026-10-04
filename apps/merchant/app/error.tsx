"use client";

import * as React from "react";

import { MerchantRouteErrorState } from "@/components/merchant-ui/route-error-state";

export interface MerchantRootErrorProps {
	readonly error: Error & { readonly digest?: string };
	readonly retry: () => void;
}

/**
 * Error boundary below the root layout: catches failures of the entry pages
 * (`/`, `/account`) and of the `/orgs/[orgSlug]` layout itself — e.g. the
 * memberships read failing during an API outage, which must never be mistaken
 * for "no organization". Server failures arrive here from `settleServerQuery`,
 * which already logged them on the server.
 */
export default function MerchantRootError({ error, retry }: MerchantRootErrorProps): React.JSX.Element {
	return (
		<main className="mx-auto flex min-h-svh max-w-xl items-center px-4">
			<MerchantRouteErrorState digest={error.digest} onRetry={retry} className="w-full" />
		</main>
	);
}
