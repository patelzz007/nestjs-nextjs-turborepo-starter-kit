"use client";

import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { OrganizationLocationList } from "@/components/org/organization-location-list";
import { OrganizationLocationRequestForm } from "@/components/org/organization-location-request-form";
import { resolveActiveOrganizationLocations, resolveAllOrganizationLocations } from "@/lib/org/location-access";
import { organizationPath } from "@/lib/org/slug";
import { useAuth } from "@workspace/client/lib/auth";
import type { OrganizationLocationResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import Link from "next/link";
import * as React from "react";

export interface OrganizationLocationsPageViewProps {
	readonly orgSlug: string;
}

export function OrganizationLocationsPageView({ orgSlug }: OrganizationLocationsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const contextQuery = api.organizations.context.useQuery({ orgSlug });
	const context = contextQuery.data?.data;
	const [showCreateForm, setShowCreateForm] = React.useState(false);
	const [editingLocation, setEditingLocation] = React.useState<OrganizationLocationResponse | undefined>(undefined);

	const allLocations = context !== undefined ? resolveAllOrganizationLocations(context) : [];
	const activeLocations = context !== undefined ? resolveActiveOrganizationLocations(context) : [];

	const handleMutationSuccess = React.useCallback((): void => {
		setShowCreateForm(false);
		setEditingLocation(undefined);
		void contextQuery.refetch();
	}, [contextQuery]);

	const handleEditRejected = React.useCallback((location: OrganizationLocationResponse): void => {
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
				description="Manage stores under this organization. New locations require RewardHub approval before they appear to customers or POS integrations."
				actions={
					<Button type="button" onClick={handleToggleCreateForm} disabled={contextQuery.isLoading}>
						{showCreateForm ? "Close form" : "Add store"}
					</Button>
				}
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

			{showCreateForm ? (
				<MerchantSurfacePanel className="space-y-4 p-5 sm:p-6">
					<div>
						<p className="font-medium text-foreground">Request a new store</p>
						<p className="mt-1 text-sm text-muted-foreground">Ops will review the address before the store becomes active.</p>
					</div>
					<OrganizationLocationRequestForm orgSlug={orgSlug} mode="create" onSuccess={handleMutationSuccess} onCancel={handleCancelCreate} />
				</MerchantSurfacePanel>
			) : null}

			{editingLocation !== undefined ? (
				<MerchantSurfacePanel className="space-y-4 p-5 sm:p-6">
					<div>
						<p className="font-medium text-foreground">Resubmit rejected store</p>
						<p className="mt-1 text-sm text-muted-foreground">Update the details and send the request back to RewardHub ops.</p>
					</div>
					<OrganizationLocationRequestForm
						key={editingLocation.id}
						orgSlug={orgSlug}
						mode="resubmit"
						location={editingLocation}
						onSuccess={handleMutationSuccess}
						onCancel={handleCancelResubmit}
					/>
				</MerchantSurfacePanel>
			) : null}

			{context !== undefined ? (
				<>
					<MerchantSurfacePanel className="space-y-3 p-5 sm:p-6">
						<p className="text-sm text-muted-foreground">
							<strong className="font-medium text-foreground">{context.organization.displayName}</strong> has{" "}
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
					</MerchantSurfacePanel>

					<OrganizationLocationList
						locations={allLocations}
						membershipLocationScopeType={context.membership.locationScopeType}
						membershipLocationIds={context.membership.locationIds}
						showAccessHints
						onEditRejected={handleEditRejected}
					/>
				</>
			) : null}

			<Link href={organizationPath(orgSlug, "dashboard")} className="text-sm text-muted-foreground hover:text-foreground">
				Back to dashboard
			</Link>
		</div>
	);
}
