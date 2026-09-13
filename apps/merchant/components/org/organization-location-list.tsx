"use client";

import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import type { OrganizationLocationResponse, OrganizationLocationScopeType } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { MapPin, Phone } from "lucide-react";
import * as React from "react";

const CITY_LABELS: Record<NonNullable<OrganizationLocationResponse["city"]>, string> = {
	KUALA_LUMPUR: "Kuala Lumpur",
	MELAKA: "Melaka",
};

export interface OrganizationLocationListProps {
	readonly locations: readonly OrganizationLocationResponse[];
	readonly membershipLocationScopeType?: OrganizationLocationScopeType;
	readonly membershipLocationIds?: readonly string[];
	readonly showAccessHints?: boolean;
}

function isLocationAccessible(locationId: string, scopeType: OrganizationLocationScopeType | undefined, scopedLocationIds: readonly string[]): boolean {
	if (scopeType === undefined || scopeType === "ALL_LOCATIONS") {
		return true;
	}

	return scopedLocationIds.includes(locationId);
}

export function OrganizationLocationList({
	locations,
	membershipLocationScopeType,
	membershipLocationIds = [],
	showAccessHints = false,
}: OrganizationLocationListProps): React.JSX.Element {
	if (locations.length === 0) {
		return (
			<MerchantSurfacePanel className="p-6">
				<p className="text-sm text-muted-foreground">No locations have been added to this organization yet.</p>
			</MerchantSurfacePanel>
		);
	}

	return (
		<div className="grid gap-4 md:grid-cols-2">
			{locations.map((location) => {
				const accessible = isLocationAccessible(location.id, membershipLocationScopeType, membershipLocationIds);

				return (
					<MerchantSurfacePanel key={location.id} className="flex h-full flex-col gap-4 p-5">
						<div className="flex items-start justify-between gap-3">
							<div className="flex min-w-0 items-start gap-3">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
									<MapPin className="size-5" aria-hidden="true" />
								</div>
								<div className="min-w-0 space-y-1">
									<p className="font-medium text-foreground">{location.name}</p>
									<p className="font-mono text-xs text-muted-foreground">{location.code}</p>
								</div>
							</div>
							<div className="flex shrink-0 flex-wrap justify-end gap-2">
								{location.isPrimary ? <Badge>Primary</Badge> : null}
								{showAccessHints && membershipLocationScopeType === "SELECTED" ? (
									<Badge variant={accessible ? "default" : "outline"}>{accessible ? "Your access" : "No access"}</Badge>
								) : null}
							</div>
						</div>

						<div className="space-y-2 text-sm text-muted-foreground">
							{location.addressText !== null ? <p>{location.addressText}</p> : null}
							{location.city !== null ? <p>{CITY_LABELS[location.city]}</p> : null}
							{location.contactPhone !== null ? (
								<p className="flex items-center gap-2">
									<Phone className="size-3.5 shrink-0" aria-hidden="true" />
									{location.contactPhone}
								</p>
							) : null}
						</div>
					</MerchantSurfacePanel>
				);
			})}
		</div>
	);
}
