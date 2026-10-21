"use client";

import * as React from "react";

import { MerchantRouteErrorState } from "@/components/merchant-ui/route-error-state";

export interface MerchantTenantPageErrorProps {
	readonly error: Error & { readonly digest?: string };
	readonly retry: () => void;
}

/**
 * Error boundary for every tenant page. It renders inside the tenant shell
 * (the layout stays mounted), so a failed page keeps the navigation. Server
 * failures arrive here from `settleServerQuery`, already logged on the server.
 */
export default function MerchantTenantPageError({ error, retry }: MerchantTenantPageErrorProps): React.JSX.Element {
	return <MerchantRouteErrorState digest={error.digest} onRetry={retry} className="my-8" />;
}
