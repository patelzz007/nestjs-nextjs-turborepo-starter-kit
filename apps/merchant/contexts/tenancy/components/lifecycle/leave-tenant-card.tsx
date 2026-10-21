"use client";

import * as React from "react";

import { useActiveMembership, useActiveTenantName } from "@/features/tenant-context/facade";

import { LeaveTenantButton } from "./leave-tenant-button";

export interface LeaveTenantCardProps {
	readonly tenantSlug: string;
}

/** The settings card that lets a member leave the active tenant. Never shown to the owner (the API refuses them) or a non-member. */
export const LeaveTenantCard = React.forwardRef<HTMLDivElement, LeaveTenantCardProps>(function LeaveTenantCard({ tenantSlug }, ref): React.JSX.Element | null {
	const { membership } = useActiveMembership();
	const tenantName = useActiveTenantName();
	if (membership === undefined || membership.role === "OWNER") {
		return null;
	}
	return (
		<div ref={ref} className="rounded-xl border bg-card p-4">
			<div className="space-y-3">
				<div className="space-y-1">
					<p className="font-medium">Leave this tenant</p>
					<p className="text-sm text-muted-foreground">Give up your membership. Your account stays; only your access to this tenant ends.</p>
				</div>
				<LeaveTenantButton tenantSlug={tenantSlug} tenantName={tenantName ?? tenantSlug} />
			</div>
		</div>
	);
});
