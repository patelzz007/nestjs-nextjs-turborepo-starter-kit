"use client";

import * as React from "react";

import { MerchantRouteErrorState } from "@/components/merchant-ui/route-error-state";

export interface MerchantOrgPageErrorProps {
	readonly error: Error & { readonly digest?: string };
	readonly retry: () => void;
}

/**
 * Error boundary for every organization page. It renders inside the org shell
 * (the layout stays mounted), so a failed page keeps the navigation. Server
 * failures arrive here from `settleServerQuery`, already logged on the server.
 */
export default function MerchantOrgPageError({ error, retry }: MerchantOrgPageErrorProps): React.JSX.Element {
	return <MerchantRouteErrorState digest={error.digest} onRetry={retry} className="my-8" />;
}
