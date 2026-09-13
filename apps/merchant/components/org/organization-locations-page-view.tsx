"use client";

import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { OrganizationLocationList } from "@/components/org/organization-location-list";
import { organizationPath } from "@/lib/org/slug";
import { useAuth } from "@workspace/client/lib/auth";
import Link from "next/link";
import * as React from "react";

export interface OrganizationLocationsPageViewProps {
	readonly orgSlug: string;
}

export function OrganizationLocationsPageView({ orgSlug }: OrganizationLocationsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const contextQuery = api.organizations.context.useQuery({ orgSlug });
	const context = contextQuery.data?.data;

	return (
		<div className="space-y-8">
			<MerchantPageHeader
				title="Store locations"
				description="One organization can operate multiple stores. Membership access can cover every location or selected sites only."
			/>

			{contextQuery.isError ? (
				<MerchantSurfacePanel className="border-destructive/30 bg-destructive/5 p-5">
					<p className="font-medium text-foreground">Could not load locations</p>
					<p className="mt-1 text-sm text-muted-foreground">Verify you have access to this organization workspace.</p>
				</MerchantSurfacePanel>
			) : null}

			{contextQuery.isLoading ? (
				<MerchantSurfacePanel className="p-6">
					<p className="text-sm text-muted-foreground">Loading locations…</p>
				</MerchantSurfacePanel>
			) : null}

			{context !== undefined ? (
				<>
					<MerchantSurfacePanel className="space-y-3 p-5 sm:p-6">
						<p className="text-sm text-muted-foreground">
							<strong className="font-medium text-foreground">{context.organization.displayName}</strong> currently has{" "}
							<strong className="font-medium text-foreground">{String(context.locations.length)}</strong> active location
							{context.locations.length === 1 ? "" : "s"}.
						</p>
						<p className="text-sm text-muted-foreground">
							Your membership scope:{" "}
							<span className="font-medium text-foreground">
								{context.membership.locationScopeType === "ALL_LOCATIONS"
									? "All locations"
									: `${String(context.membership.locationIds.length)} selected location${context.membership.locationIds.length === 1 ? "" : "s"}`}
							</span>
						</p>
					</MerchantSurfacePanel>

					<OrganizationLocationList
						locations={context.locations}
						membershipLocationScopeType={context.membership.locationScopeType}
						membershipLocationIds={context.membership.locationIds}
						showAccessHints
					/>
				</>
			) : null}

			<Link href={organizationPath(orgSlug, "dashboard")} className="text-sm text-muted-foreground hover:text-foreground">
				Back to dashboard
			</Link>
		</div>
	);
}
