"use client";

import { useMerchantAuthorizationStatus } from "@/contexts/tenancy/components/access/merchant-authorization-provider";
import { MerchantReadOnlyNotice } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { MERCHANT_LOCATIONS_LOADING_LABELS, LocationsSkeleton } from "@/components/loading/merchant-page-skeletons";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { LocationList } from "@/contexts/tenancy/components/org/tenant-location-list";
import { LocationRequestForm } from "@/contexts/tenancy/components/org/tenant-location-request-form";
import { resolveActiveLocations, resolveAllLocations } from "@/contexts/tenancy/lib/org/location-access";
import { tenantRoutes } from "@/lib/routes";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { MERCHANT_CAPABILITY, type LocationResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { Card } from "@workspace/ui/components/card";
import Link from "next/link";
import * as React from "react";

export interface LocationsPageViewProps {
	readonly tenantSlug: string;
}

/** Store locations route — `merchant:view_locations` (every member); request/resubmit need `merchant:manage_locations` (enforced by the API). */
export function LocationsPageView({ tenantSlug }: LocationsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const canManageLocations = can(MERCHANT_CAPABILITY.manageLocations);
	const { isLoading: isAuthorizationLoading } = useMerchantAuthorizationStatus();
	const contextQuery = api.tenants.context.useQuery({ tenantSlug });
	const context = contextQuery.data?.data;
	const [showCreateForm, setShowCreateForm] = React.useState(false);
	const [editingLocation, setEditingLocation] = React.useState<LocationResponse | undefined>(undefined);

	const allLocations = context !== undefined ? resolveAllLocations(context) : [];
	const activeLocations = context !== undefined ? resolveActiveLocations(context) : [];

	const handleMutationSuccess = React.useCallback((): void => {
		setShowCreateForm(false);
		setEditingLocation(undefined);
		void contextQuery.refetch();
	}, [contextQuery]);

	const handleEditRejected = React.useCallback((location: LocationResponse): void => {
		setEditingLocation(location);
		setShowCreateForm(false);
	}, []);

	const handleToggleCreateForm = React.useCallback((): void => {
		setShowCreateForm((current) => !current);
	}, []);

	const handleCancelCreate = React.useCallback((): void => {
		setShowCreateForm(false);
	}, []);

	const handleCancelResubmit = React.useCallback((): void => {
		setEditingLocation(undefined);
	}, []);

	return (
		<div className="space-y-8">
			<MerchantPageHeader
				title="Store locations"
				description="Manage stores under this tenant. New locations require platform approval before they appear to customers or POS integrations."
				actions={
					canManageLocations ? (
						<Button type="button" onClick={handleToggleCreateForm} disabled={contextQuery.isLoading}>
							{showCreateForm ? "Close form" : "Add store"}
						</Button>
					) : undefined
				}
			/>

			{canManageLocations || isAuthorizationLoading ? null : (
				<MerchantReadOnlyNotice>Your role can view store locations but not request new stores or resubmit rejected ones.</MerchantReadOnlyNotice>
			)}

			{contextQuery.isError ? (
				<Card className="gap-0 bg-destructive/5 p-5 ring-destructive/30">
					<p className="font-medium text-foreground">Could not load locations</p>
					<p className="mt-1 text-sm text-muted-foreground">Verify you have access to this tenant workspace.</p>
				</Card>
			) : null}

			{contextQuery.isLoading ? (
				<SkeletonRegion labels={MERCHANT_LOCATIONS_LOADING_LABELS} className="flex flex-col gap-8">
					<LocationsSkeleton />
				</SkeletonRegion>
			) : null}

			{canManageLocations && showCreateForm ? (
				<Card className="gap-4 p-5 sm:p-6">
					<div>
						<p className="font-medium text-foreground">Request a new store</p>
						<p className="mt-1 text-sm text-muted-foreground">Ops will review the address before the store becomes active.</p>
					</div>
					<LocationRequestForm tenantSlug={tenantSlug} mode="create" onSuccess={handleMutationSuccess} onCancel={handleCancelCreate} />
				</Card>
			) : null}

			{canManageLocations && editingLocation !== undefined ? (
				<Card className="gap-4 p-5 sm:p-6">
					<div>
						<p className="font-medium text-foreground">Resubmit rejected store</p>
						<p className="mt-1 text-sm text-muted-foreground">Update the details and send the request back to the platform team.</p>
					</div>
					<LocationRequestForm
						key={editingLocation.id}
						tenantSlug={tenantSlug}
						mode="resubmit"
						location={editingLocation}
						onSuccess={handleMutationSuccess}
						onCancel={handleCancelResubmit}
					/>
				</Card>
			) : null}

			{context !== undefined ? (
				<>
					<Card className="gap-3 p-5 sm:p-6">
						<p className="text-sm text-muted-foreground">
							<strong className="font-medium text-foreground">{context.tenant.displayName}</strong> has{" "}
							<strong className="font-medium text-foreground">{String(activeLocations.length)}</strong> active store
							{activeLocations.length === 1 ? "" : "s"} and <strong className="font-medium text-foreground">{String(allLocations.length)}</strong> total recorded location
							{allLocations.length === 1 ? "" : "s"}.
						</p>
						<p className="text-sm text-muted-foreground">
							Your membership scope:{" "}
							<span className="font-medium text-foreground">
								{context.membership.locationScopeType === "ALL_LOCATIONS"
									? "All locations"
									: `${String(context.membership.locationIds.length)} selected location${context.membership.locationIds.length === 1 ? "" : "s"}`}
							</span>
						</p>
					</Card>

					<LocationList
						locations={allLocations}
						membershipLocationScopeType={context.membership.locationScopeType}
						membershipLocationIds={context.membership.locationIds}
						showAccessHints
						onEditRejected={canManageLocations ? handleEditRejected : undefined}
					/>
				</>
			) : null}

			<Link href={tenantRoutes(tenantSlug).dashboard} className="text-sm text-muted-foreground hover:text-foreground">
				Back to dashboard
			</Link>
		</div>
	);
}
