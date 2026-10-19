"use client";

import { useMerchantAuthorizationStatus } from "@/contexts/organizations/components/access/merchant-authorization-provider";
import { MERCHANT_ACCESS_LOADING_LABELS, MerchantPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { Can } from "@workspace/client/lib/contexts/authorization";
import type { CapabilitySlug } from "@workspace/shared";
import { Eye, ShieldAlert } from "lucide-react";
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

/**
 * Placeholder while the active membership resolves — avoids flashing a denied
 * state. A page passes its own skeleton as the gate's `loading`; this generic
 * page silhouette ("Checking access…") is the fallback for a section without one.
 */
export function MerchantAccessLoading(): React.JSX.Element {
	return <MerchantPageSkeleton labels={MERCHANT_ACCESS_LOADING_LABELS} />;
}

export interface MerchantReadOnlyNoticeProps {
	readonly children: React.ReactNode;
}

/** Inline notice for sections a role can view but not change. */
export function MerchantReadOnlyNotice({ children }: MerchantReadOnlyNoticeProps): React.JSX.Element {
	return (
		<div role="note" className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
			<Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<p>{children}</p>
		</div>
	);
}

export interface MerchantCapabilityGateProps {
	readonly capability: CapabilitySlug;
	readonly children: React.ReactNode;
	/** Rendered when denied. Defaults to {@link MerchantAccessDenied}. */
	readonly fallback?: React.ReactNode;
	/** Rendered while the membership resolves — the page's own skeleton, so its content lands where it stood. Defaults to {@link MerchantAccessLoading}. */
	readonly loading?: React.ReactNode;
}

/** Page/section gate: `<Can>` with the merchant loading state and access-denied fallback. */
export function MerchantCapabilityGate({ capability, children, fallback, loading }: MerchantCapabilityGateProps): React.JSX.Element {
	const { isLoading } = useMerchantAuthorizationStatus();

	if (isLoading) {
		return <>{loading ?? <MerchantAccessLoading />}</>;
	}

	return (
		<Can permission={capability} fallback={fallback ?? <MerchantAccessDenied />}>
			{children}
		</Can>
	);
}
