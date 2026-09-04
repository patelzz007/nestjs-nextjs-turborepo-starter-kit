"use client";

import { useMerchantCapabilities } from "@/lib/merchant-capabilities";
import type { MerchantCapability } from "@workspace/shared";
import { ShieldAlert } from "lucide-react";
import * as React from "react";

export interface MerchantAccessDeniedProps {
	readonly title?: string;
	readonly description?: string;
}

/** Standard forbidden state for merchant capability gates. */
export function MerchantAccessDenied({
	title = "You don't have access to this page",
	description = "Your role doesn't include permission for this feature. Contact your store owner if you need access.",
}: MerchantAccessDeniedProps): React.JSX.Element {
	return (
		<div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
			<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
				<ShieldAlert className="size-6 text-muted-foreground" aria-hidden="true" />
			</div>
			<h1 className="text-lg font-semibold text-foreground">{title}</h1>
			<p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
		</div>
	);
}

export interface MerchantCapabilityGateProps {
	readonly capability: MerchantCapability;
	readonly children: React.ReactNode;
	readonly fallback?: React.ReactNode;
}

/** Renders children only when the active membership has the required capability. */
export function MerchantCapabilityGate({ capability, children, fallback }: MerchantCapabilityGateProps): React.JSX.Element {
	const { hasCapability, isLoading } = useMerchantCapabilities();

	if (isLoading) {
		return <p className="text-sm text-muted-foreground">Checking access…</p>;
	}

	if (!hasCapability(capability)) {
		return <>{fallback ?? <MerchantAccessDenied />}</>;
	}

	return <>{children}</>;
}
